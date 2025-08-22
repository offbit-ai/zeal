#!/usr/bin/env node

/**
 * Build-time script to ingest node templates into the database
 * This loads templates directly from TypeScript sources
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const { Pool } = require('pg')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

// Parse database URL from environment or use default
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://zeal_user:zeal_password@localhost:5432/zeal_db?schema=public'

// Extract connection details from URL
const parseDatabaseUrl = (url) => {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/)
  if (!match) {
    throw new Error('Invalid database URL format')
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
  }
}

const dbConfig = parseDatabaseUrl(DATABASE_URL)

async function ingestTemplates() {
  console.log('🔄 Starting node template ingestion...')
  
  const pool = new Pool(dbConfig)
  
  try {
    // Check if we should force re-ingestion
    const force = process.argv.includes('--force')
    
    // Check if templates are already ingested
    if (!force) {
      const countResult = await pool.query('SELECT COUNT(*) FROM node_templates')
      const templateCount = parseInt(countResult.rows[0].count)
      if (templateCount > 0) {
        console.log(`✅ ${templateCount} templates already ingested. Use --force to re-ingest.`)
        return
      }
    }

    // If force flag is set, clear existing templates and repository entries
    if (force) {
      console.log('🗑️  Clearing existing templates...')
      await pool.query('DELETE FROM template_repository')
      await pool.query('DELETE FROM node_templates')
    }

    // Compile templates from TypeScript sources
    console.log('🔨 Compiling TypeScript templates...')
    execSync('node scripts/compile-templates.js', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    // Read the compiled templates
    const compiledPath = path.join(__dirname, '../data/compiled-templates.json')
    const templates = JSON.parse(fs.readFileSync(compiledPath, 'utf8'))
    
    console.log(`📥 Ingesting ${templates.length} templates from TypeScript sources...`)
    
    // First, ensure categories exist
    const categories = new Set()
    const subcategories = new Map() // category -> Set of subcategories
    
    templates.forEach(template => {
      if (template.category) {
        categories.add(template.category)
        if (template.subcategory) {
          if (!subcategories.has(template.category)) {
            subcategories.set(template.category, new Set())
          }
          subcategories.get(template.category).add(template.subcategory)
        }
      }
    })
    
    // Insert categories
    const categoryIds = new Map()
    for (const category of categories) {
      const result = await pool.query(`
        INSERT INTO node_categories (name, display_name, description, icon, is_active)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (name) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [
        category,
        category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        `Templates for ${category}`,
        'folder'
      ])
      categoryIds.set(category, result.rows[0].id)
    }
    
    // Insert subcategories
    const subcategoryIds = new Map()
    for (const [category, subs] of subcategories) {
      const categoryId = categoryIds.get(category)
      for (const sub of subs) {
        const result = await pool.query(`
          INSERT INTO node_subcategories (category_id, name, display_name, description)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (category_id, name) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `, [
          categoryId,
          sub,
          sub.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          `${sub} templates`
        ])
        subcategoryIds.set(`${category}:${sub}`, result.rows[0].id)
      }
    }
    
    let successful = 0
    let failed = 0
    
    // Check if pgvector extension is available
    const pgvectorResult = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
    const hasPgVector = pgvectorResult.rows.length > 0
    
    for (const template of templates) {
      try {
        const categoryId = categoryIds.get(template.category)
        const subcategoryId = template.subcategory ? 
          subcategoryIds.get(`${template.category}:${template.subcategory}`) : null
        
        // Insert into node_templates table
        await pool.query(`
          INSERT INTO node_templates (
            template_id, version, status, template_data, source_type, source_location,
            title, category, subcategory, tags, category_id, subcategory_id,
            created_by, updated_by
          ) VALUES (
            $1, $2, 'active', $3, 'file', 'data/nodeTemplates.json',
            $4, $5, $6, $7, $8, $9, 'system', 'system'
          ) ON CONFLICT (template_id, version) DO UPDATE SET
            template_data = EXCLUDED.template_data,
            title = EXCLUDED.title,
            category = EXCLUDED.category,
            subcategory = EXCLUDED.subcategory,
            tags = EXCLUDED.tags,
            category_id = EXCLUDED.category_id,
            subcategory_id = EXCLUDED.subcategory_id,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = 'system'
        `, [
          template.id,
          template.version || '1.0.0',
          JSON.stringify(template),
          template.title,
          template.category,
          template.subcategory || null,
          template.tags || [],
          categoryId,
          subcategoryId
        ])
        
        // Generate mock embeddings
        const mockEmbedding = Array(1536).fill(0).map(() => Math.random() * 0.1)
        
        // Insert into template_repository table
        if (hasPgVector) {
          // Use pgvector format
          await pool.query(`
            INSERT INTO template_repository (
              template_id, capabilities, keywords, search_text,
              title_embedding, description_embedding, combined_embedding
            ) VALUES (
              $1, $2, $3, to_tsvector('english', $4),
              $5::vector, $6::vector, $7::vector
            ) ON CONFLICT (template_id) DO UPDATE SET
              capabilities = EXCLUDED.capabilities,
              keywords = EXCLUDED.keywords,
              search_text = EXCLUDED.search_text,
              title_embedding = EXCLUDED.title_embedding,
              description_embedding = EXCLUDED.description_embedding,
              combined_embedding = EXCLUDED.combined_embedding,
              indexed_at = CURRENT_TIMESTAMP
          `, [
            template.id,
            extractCapabilities(template),
            template.tags || [],
            `${template.title} ${template.description} ${(template.tags || []).join(' ')}`,
            `[${mockEmbedding.join(',')}]`,
            `[${mockEmbedding.join(',')}]`,
            `[${mockEmbedding.join(',')}]`
          ])
        } else {
          // Use JSONB fallback
          await pool.query(`
            INSERT INTO template_repository (
              template_id, capabilities, keywords, search_text,
              title_embedding, description_embedding, combined_embedding
            ) VALUES (
              $1, $2, $3, to_tsvector('english', $4),
              $5::jsonb, $6::jsonb, $7::jsonb
            ) ON CONFLICT (template_id) DO UPDATE SET
              capabilities = EXCLUDED.capabilities,
              keywords = EXCLUDED.keywords,
              search_text = EXCLUDED.search_text,
              title_embedding = EXCLUDED.title_embedding,
              description_embedding = EXCLUDED.description_embedding,
              combined_embedding = EXCLUDED.combined_embedding,
              indexed_at = CURRENT_TIMESTAMP
          `, [
            template.id,
            extractCapabilities(template),
            template.tags || [],
            `${template.title} ${template.description} ${(template.tags || []).join(' ')}`,
            JSON.stringify(mockEmbedding),
            JSON.stringify(mockEmbedding),
            JSON.stringify(mockEmbedding)
          ])
        }
        
        successful++
      } catch (error) {
        console.error(`   ❌ Failed to ingest ${template.id}: ${error.message}`)
        failed++
      }
    }
    
    console.log('✅ Ingestion complete!')
    console.log(`   - Total templates: ${templates.length}`)
    console.log(`   - Successful: ${successful}`)
    console.log(`   - Failed: ${failed}`)
    
    process.exit(failed > 0 ? 1 : 0)
  } catch (error) {
    console.error('❌ Failed to ingest templates:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Extract capabilities from template
function extractCapabilities(template) {
  const capabilities = []
  
  // Extract from description
  if (template.description) {
    if (template.description.toLowerCase().includes('send')) capabilities.push('send')
    if (template.description.toLowerCase().includes('receive')) capabilities.push('receive')
    if (template.description.toLowerCase().includes('process')) capabilities.push('process')
    if (template.description.toLowerCase().includes('transform')) capabilities.push('transform')
    if (template.description.toLowerCase().includes('store')) capabilities.push('store')
    if (template.description.toLowerCase().includes('query')) capabilities.push('query')
    if (template.description.toLowerCase().includes('analyze')) capabilities.push('analyze')
  }
  
  // Add category-based capabilities
  if (template.category === 'communication') capabilities.push('communicate')
  if (template.category === 'data-processing') capabilities.push('process_data')
  if (template.category === 'storage-memory') capabilities.push('store_data')
  if (template.category === 'ai-models') capabilities.push('ai_processing')
  
  return [...new Set(capabilities)] // Remove duplicates
}

// Run if executed directly
if (require.main === module) {
  ingestTemplates()
}

module.exports = { ingestTemplates }