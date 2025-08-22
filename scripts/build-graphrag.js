#!/usr/bin/env node

/**
 * GraphRAG builder using LLM for intelligent analysis
 * This script builds a knowledge graph from node templates
 * and saves it as a snapshot for use in the application.
 * It requires OPENROUTER_API_KEY to be set for LLM analysis.
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const { Pool } = require('pg')
const path = require('path')
const fs = require('fs').promises
const Graph = require('graphology')

// Parse database URL
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

/**
 * Inline LLMGraphBuilder implementation
 */
class LLMGraphBuilder {
  constructor(llm, snapshotPath) {
    this.graph = new Graph({ multi: true, type: 'directed' })
    this.llm = llm
    this.snapshotPath = snapshotPath || path.join(process.cwd(), 'data', 'graphrag-snapshot.json')
  }

  extractPorts(ports, type) {
    if (!ports || !Array.isArray(ports)) return {}
    
    const filteredPorts = ports.filter(p => p.type === type)
    const result = {}
    
    filteredPorts.forEach(port => {
      result[port.id] = {
        label: port.label,
        position: port.position,
        multiple: port.multiple || false,
        required: port.required || false
      }
    })
    
    return result
  }

  async buildFromTemplates(templates, forceRebuild = false) {
    // Try to load from snapshot first
    if (!forceRebuild) {
      const loaded = await this.loadSnapshot()
      if (loaded) {
        console.log('✅ Loaded GraphRAG from snapshot')
        return this.graph
      }
    }

    console.log(`🔨 Building knowledge graph from ${templates.length} templates using LLM...`)
    
    // Step 1: Batch analyze all templates with LLM
    const analysisResults = await this.batchAnalyzeTemplates(templates)
    
    // Step 2: Extract unique services and capabilities
    const { services, capabilities } = await this.extractEntities(analysisResults)
    
    // Step 3: Create nodes
    await this.createNodes(templates, analysisResults, services, capabilities)
    
    // Step 4: Build relationships using LLM
    await this.buildRelationships(templates, analysisResults)
    
    // Step 5: Save snapshot
    await this.saveSnapshot()
    
    console.log(`✅ Graph built with ${this.graph.order} nodes and ${this.graph.size} edges`)
    return this.graph
  }

  async batchAnalyzeTemplates(templates) {
    console.log('🤖 Analyzing templates with LLM...')
    
    const results = new Map()
    const batchSize = 5 // Reduced batch size to avoid token limits and JSON errors
    
    for (let i = 0; i < templates.length; i += batchSize) {
      const batch = templates.slice(i, i + batchSize)
      const batchAnalysis = await this.analyzeBatch(batch)
      
      batchAnalysis.forEach((analysis, index) => {
        results.set(batch[index].id, analysis)
      })
      
      console.log(`  Analyzed ${Math.min(i + batchSize, templates.length)}/${templates.length} templates`)
    }
    
    return results
  }

  async analyzeBatch(templates) {
    const prompt = `Analyze these node templates and extract their services, capabilities, and relationships.
For each template, identify:
1. What external services it integrates with (e.g., Slack, GitHub, OpenAI)
2. What capabilities it provides (e.g., send_message, receive_webhook, transform_data)
3. What type of data it accepts and outputs
4. Potential connections with other templates
5. How properties affect behavior (e.g., "operation" property changing from "read" to "write" changes capabilities)
6. How rules create variants (e.g., different models, providers, or operations create different node behaviors)

IMPORTANT: Look for ALL capabilities, including:
- Filtering capabilities (e.g., if it has "filter" operations, dataOperations property, or conditional logic)
- Transformation capabilities (e.g., data mapping, formatting)
- Routing capabilities (e.g., conditional branching, switching)
- Processing capabilities (e.g., aggregation, sorting, joining)
- Any property-based capabilities (e.g., operation="filter" means it has filter capability)

Templates to analyze:
${templates.map((t, i) => `
Template ${i + 1}:
- ID: ${t.id}
- Title: ${t.title}
- Description: ${t.description}
- Category: ${t.category}
- Ports: ${JSON.stringify(t.ports || [])}
- Inputs: ${JSON.stringify(t.inputs || t.ports?.filter(p => p.type === 'input').map(p => ({id: p.id, label: p.label})) || [])}
- Outputs: ${JSON.stringify(t.outputs || t.ports?.filter(p => p.type === 'output').map(p => ({id: p.id, label: p.label})) || [])}
- Properties: ${JSON.stringify(t.properties || {})}
- Property Rules: ${JSON.stringify(t.propertyRules || t.rules || {})}
`).join('\n')}

Return a JSON array with one object per template:
[{
  "templateId": "template_id",
  "services": ["service1", "service2"],
  "serviceTypes": {"service1": "messaging", "service2": "vcs"},
  "capabilities": ["capability1", "capability2"],
  "capabilityDescriptions": {"capability1": "description"},
  "acceptsDataTypes": ["json", "text"],
  "outputsDataTypes": ["json"],
  "suggestedConnections": ["other_template_id"],
  "alternativeTo": ["competing_template_id"],
  "commonlyUsedWith": ["complementary_template_id"],
  "propertyBasedBehaviors": {
    "key_property": ["behavior1", "behavior2"]
  },
  "ruleBasedVariants": ["variant1", "variant2"]
}]

Be specific and consistent with naming. For example:
- Use "slack" not "Slack" or "slack-api"
- Use "send_message" not "send" or "message"
- Use "github" not "GitHub" or "gh"`

    try {
      const response = await this.llm.invoke(prompt)
      const content = typeof response === 'string' ? response : response.content
      
      // Try to extract and clean JSON
      let jsonStr = content
      
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      
      // Try to find JSON array
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('No JSON array found in response')
      }
      
      jsonStr = jsonMatch[0]
      
      // Clean common JSON issues
      // Remove trailing commas before closing brackets/braces
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1')
      // Fix escaped quotes that might break JSON
      jsonStr = jsonStr.replace(/\\'/g, "'")
      // Remove any control characters
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, '')
      
      try {
        return JSON.parse(jsonStr)
      } catch (parseError) {
        console.error('JSON parse error:', parseError)
        console.error('Attempted to parse:', jsonStr.substring(0, 500) + '...')
        
        // Try one more aggressive cleanup
        // Remove any text before the first [ and after the last ]
        const firstBracket = jsonStr.indexOf('[')
        const lastBracket = jsonStr.lastIndexOf(']')
        if (firstBracket !== -1 && lastBracket !== -1) {
          jsonStr = jsonStr.substring(firstBracket, lastBracket + 1)
          return JSON.parse(jsonStr)
        }
        
        throw parseError
      }
    } catch (error) {
      console.error('Failed to analyze batch:', error)
      console.error('Will retry with smaller batch size')
      
      // If batch is too large, try analyzing templates one by one
      if (templates.length > 1) {
        const results = []
        for (const template of templates) {
          try {
            const singleResult = await this.analyzeBatch([template])
            results.push(singleResult[0])
          } catch (singleError) {
            console.error(`Failed to analyze template ${template.id}:`, singleError)
            // Create a minimal analysis for failed templates
            results.push({
              templateId: template.id,
              services: [],
              serviceTypes: {},
              capabilities: [],
              capabilityDescriptions: {},
              acceptsDataTypes: ['any'],
              outputsDataTypes: ['any'],
              suggestedConnections: [],
              alternativeTo: [],
              commonlyUsedWith: [],
              propertyBasedBehaviors: {},
              ruleBasedVariants: []
            })
          }
        }
        return results
      }
      
      throw error
    }
  }

  async extractEntities(analysisResults) {
    const servicesMap = new Map() // service -> types
    const capabilitiesMap = new Map() // capability -> description
    
    for (const [templateId, analysis] of analysisResults) {
      // Collect services and their types
      analysis.services?.forEach((service, index) => {
        const serviceType = analysis.serviceTypes?.[service] || 'general'
        if (!servicesMap.has(service)) {
          servicesMap.set(service, new Set())
        }
        servicesMap.get(service).add(serviceType)
      })
      
      // Collect capabilities and descriptions
      analysis.capabilities?.forEach((capability) => {
        if (!capabilitiesMap.has(capability)) {
          const description = analysis.capabilityDescriptions?.[capability] || 
                            `Ability to ${capability.replace(/_/g, ' ')}`
          capabilitiesMap.set(capability, description)
        }
      })
    }
    
    return {
      services: servicesMap,
      capabilities: capabilitiesMap
    }
  }
  
  async generateSemanticTags(template, analysis) {
    const tags = []
    
    // Extract tags from title and description
    const titleWords = template.title.toLowerCase().split(/\s+/)
    const descWords = (template.description || '').toLowerCase().split(/\s+/)
    
    // Add meaningful words as tags
    const meaningfulWords = [...titleWords, ...descWords].filter(word => 
      word.length > 3 && !['with', 'from', 'into', 'using', 'data', 'node'].includes(word)
    )
    tags.push(...meaningfulWords)
    
    // Add capability-based tags
    if (analysis?.capabilities) {
      analysis.capabilities.forEach(cap => {
        // Add the capability itself
        tags.push(cap)
        
        // Add semantic variations
        if (cap.includes('filter')) tags.push('filter', 'filtering', 'where', 'condition', 'criteria')
        if (cap.includes('transform')) tags.push('transform', 'transformation', 'convert', 'map', 'mapping')
        if (cap.includes('send')) tags.push('send', 'sending', 'output', 'emit', 'notify')
        if (cap.includes('receive')) tags.push('receive', 'receiving', 'input', 'listen', 'webhook')
        if (cap.includes('aggregate')) tags.push('aggregate', 'aggregation', 'group', 'summarize')
        if (cap.includes('join')) tags.push('join', 'merge', 'combine', 'union')
        if (cap.includes('sort')) tags.push('sort', 'order', 'arrange')
      })
    }
    
    // Add property-based tags
    if (template.properties) {
      Object.entries(template.properties).forEach(([key, prop]) => {
        // If property has options that include filter/transform/etc operations
        if (prop.options && Array.isArray(prop.options)) {
          prop.options.forEach(option => {
            if (typeof option === 'string' && ['filter', 'transform', 'aggregate', 'join', 'sort'].includes(option)) {
              tags.push(option, `${option}ing`, `can_${option}`)
            }
          })
        }
        
        // Special handling for dataOperations property
        if (key === 'dataOperations') {
          tags.push('filter', 'transform', 'map', 'process', 'manipulate', 'filtering', 'transformation')
        }
      })
    }
    
    // Add behavior-based tags
    if (analysis?.propertyBasedBehaviors) {
      Object.values(analysis.propertyBasedBehaviors).forEach(behaviors => {
        if (Array.isArray(behaviors)) {
          behaviors.forEach(behavior => {
            if (behavior.includes('filter')) tags.push('filter', 'filtering', 'conditional')
            if (behavior.includes('transform')) tags.push('transform', 'transformation')
          })
        }
      })
    }
    
    // Remove duplicates and return
    return [...new Set(tags)]
  }

  async createNodes(templates, analysisResults, services, capabilities) {
    // Create template nodes
    for (const template of templates) {
      const analysis = analysisResults.get(template.id)
      
      // Generate exhaustive semantic tags
      const semanticTags = await this.generateSemanticTags(template, analysis)
      
      const node = {
        id: template.id,
        type: 'template',
        data: {
          title: template.title,
          description: template.description || '',
          category: template.category,
          subcategory: template.subcategory,
          tags: [...new Set([...(template.tags || []), ...semanticTags])], // Merge original and semantic tags
          capabilities: analysis?.capabilities || [],
          inputs: template.inputs || this.extractPorts(template.ports, 'input'),
          outputs: template.outputs || this.extractPorts(template.ports, 'output'),
          ports: template.ports || [],
          properties: template.properties || {},
          propertyRules: template.propertyRules || template.rules || {},
          propertyBasedBehaviors: analysis?.propertyBasedBehaviors || {},
          ruleBasedVariants: analysis?.ruleBasedVariants || []
        }
      }
      this.graph.addNode(node.id, node)
    }
    
    // Create service nodes
    for (const [serviceName, types] of services) {
      const serviceNode = {
        id: `service:${serviceName}`,
        type: 'service',
        data: {
          name: serviceName,
          serviceType: Array.from(types)[0], // Use most common type
          aliases: [serviceName]
        }
      }
      this.graph.addNode(serviceNode.id, serviceNode)
    }
    
    // Create capability nodes
    for (const [capabilityName, description] of capabilities) {
      const capabilityNode = {
        id: `capability:${capabilityName}`,
        type: 'capability',
        data: {
          name: capabilityName,
          description: description
        }
      }
      this.graph.addNode(capabilityNode.id, capabilityNode)
    }
  }

  async buildRelationships(templates, analysisResults) {
    console.log('🔗 Building relationships...')
    
    for (const template of templates) {
      const analysis = analysisResults.get(template.id)
      if (!analysis) continue
      
      // Connect to services
      analysis.services?.forEach((service) => {
        this.graph.addEdge(template.id, `service:${service}`, {
          type: 'INTEGRATES_WITH'
        })
      })
      
      // Connect to capabilities
      analysis.capabilities?.forEach((capability) => {
        this.graph.addEdge(template.id, `capability:${capability}`, {
          type: 'HAS_CAPABILITY'
        })
      })
      
      // Alternative relationships
      analysis.alternativeTo?.forEach((altId) => {
        if (this.graph.hasNode(altId)) {
          this.graph.addEdge(template.id, altId, {
            type: 'ALTERNATIVE_TO'
          })
        }
      })
      
      // Commonly used with relationships
      analysis.commonlyUsedWith?.forEach((commonId) => {
        if (this.graph.hasNode(commonId)) {
          this.graph.addEdge(template.id, commonId, {
            type: 'COMMONLY_USED_WITH',
            data: { confidence: 0.8 }
          })
        }
      })
    }
    
    // Build connection relationships using LLM
    await this.buildConnectionRelationships(templates, analysisResults)
  }

  async buildConnectionRelationships(templates, analysisResults) {
    console.log('🔌 Determining connection compatibility...')
    
    // Track analyzed connections to avoid duplicates
    this.analyzedConnections = new Set()
    
    // Group templates by category for more efficient analysis
    const templatesByCategory = new Map()
    templates.forEach(t => {
      const category = t.category || 'uncategorized'
      if (!templatesByCategory.has(category)) {
        templatesByCategory.set(category, [])
      }
      templatesByCategory.get(category).push(t)
    })
    
    // Get all categories
    const allCategories = Array.from(templatesByCategory.keys())
    
    // Analyze connections within categories first
    for (const [category, categoryTemplates] of templatesByCategory) {
      await this.analyzeConnectionsInBatch(categoryTemplates, analysisResults)
    }
    
    // Use LLM to determine which categories should be analyzed together
    const categoryPairsPrompt = `Given these workflow categories, which pairs are likely to have nodes that connect together?

Categories: ${allCategories.join(', ')}

Return a JSON array of category pairs that commonly work together:
[{"category1": "communication", "category2": "data-processing", "reason": "Messages often need processing"}]

Consider typical workflow patterns and data flow.`
    
    try {
      const response = await this.llm.invoke(categoryPairsPrompt)
      const content = typeof response === 'string' ? response : response.content
      const categoryPairs = JSON.parse(content.match(/\[.*\]/s)?.[0] || '[]')
      
      // Analyze cross-category connections based on LLM recommendations
      for (const pair of categoryPairs) {
        const templates1 = templatesByCategory.get(pair.category1) || []
        const templates2 = templatesByCategory.get(pair.category2) || []
        if (templates1.length > 0 && templates2.length > 0) {
          // Mix templates from both categories for cross-category analysis
          const mixedTemplates = [...templates1.slice(0, 5), ...templates2.slice(0, 5)]
          await this.analyzeConnectionsInBatch(mixedTemplates, analysisResults)
        }
      }
    } catch (error) {
      console.warn('Failed to analyze category relationships, analyzing all pairs:', error)
      // Fallback: analyze all adjacent categories
      for (let i = 0; i < allCategories.length - 1; i++) {
        const templates1 = templatesByCategory.get(allCategories[i]) || []
        const templates2 = templatesByCategory.get(allCategories[i + 1]) || []
        if (templates1.length > 0 && templates2.length > 0) {
          const mixedTemplates = [...templates1.slice(0, 5), ...templates2.slice(0, 5)]
          await this.analyzeConnectionsInBatch(mixedTemplates, analysisResults)
        }
      }
    }
  }

  async analyzeConnectionsInBatch(templates, analysisResults) {
    if (templates.length < 2) return
    
    const prompt = `Analyze which of these node templates can connect to each other.
Consider their inputs/outputs and data flow compatibility.

Templates:
${templates.map((t, i) => {
  const analysis = analysisResults.get(t.id)
  const inputPorts = t.ports?.filter(p => p.type === 'input').map(p => `${p.id}(${p.label})`).join(', ') || 'none'
  const outputPorts = t.ports?.filter(p => p.type === 'output').map(p => `${p.id}(${p.label})`).join(', ') || 'none'
  return `
${i + 1}. ${t.title} (${t.id})
   - Type: ${t.type} / ${t.category} / ${t.subcategory || 'none'}
   - Input Ports: ${inputPorts}
   - Output Ports: ${outputPorts}
   - Accepts: ${analysis?.acceptsDataTypes?.join(', ') || 'any'}
   - Outputs: ${analysis?.outputsDataTypes?.join(', ') || 'any'}
   - Capabilities: ${analysis?.capabilities?.join(', ') || 'none'}
`}).join('\n')}

ANALYZE CONNECTIONS SEMANTICALLY:
Look at the port labels and descriptions to understand what each port does:
1. Database connections: Identify which ports handle database connection pools vs data
2. Data flow: Match outputs that produce data with inputs that consume the same type of data  
3. Error handling: Identify which ports handle errors vs success cases based on their labels
4. Consider the logical flow: What makes sense in a real workflow?
   - Error outputs might go to error handlers or conditional nodes for routing
   - Success outputs should flow to nodes that process that specific data type
   - Avoid redundant connections unless nodes require multiple inputs for context

Don't make assumptions based on port IDs alone - consider the semantic meaning and purpose.

Return a JSON array of connections with specific port mappings:
[{
  "from": "template_id_1",
  "to": "template_id_2",
  "fromPort": "specific_output_port_id",
  "toPort": "specific_input_port_id",
  "confidence": 0.9,
  "reason": "Pool connection for database operations"
}]

Only include connections that make logical sense in a workflow.
Be specific about which ports connect - don't use generic mappings.`

    try {
      const response = await this.llm.invoke(prompt)
      const content = typeof response === 'string' ? response : response.content
      const connections = JSON.parse(content.match(/\[[\s\S]*\]/)?.[0] || '[]')
      
      connections.forEach((conn) => {
        if (this.graph.hasNode(conn.from) && this.graph.hasNode(conn.to)) {
          this.graph.addEdge(conn.from, conn.to, {
            type: 'CAN_CONNECT_TO',
            data: {
              confidence: conn.confidence || 0.5,
              reason: conn.reason
            }
          })
        }
      })
    } catch (error) {
      console.error('Failed to analyze connections:', error)
    }
  }

  async saveSnapshot() {
    const snapshot = {
      nodes: this.graph.nodes().map(nodeId => ({
        id: nodeId,
        attributes: this.graph.getNodeAttributes(nodeId)
      })),
      edges: this.graph.edges().map(edgeId => {
        const edge = this.graph.extremities(edgeId)
        return {
          source: edge[0],
          target: edge[1],
          attributes: this.graph.getEdgeAttributes(edgeId)
        }
      }),
      metadata: {
        createdAt: new Date().toISOString(),
        templateCount: this.graph.nodes().filter(n => 
          this.graph.getNodeAttributes(n).type === 'template'
        ).length,
        version: '1.0.0'
      }
    }
    
    // Ensure directory exists
    const dir = path.dirname(this.snapshotPath)
    await fs.mkdir(dir, { recursive: true })
    
    // Save snapshot
    await fs.writeFile(
      this.snapshotPath, 
      JSON.stringify(snapshot, null, 2),
      'utf-8'
    )
    
    console.log(`💾 Saved GraphRAG snapshot to ${this.snapshotPath}`)
    
    // Also copy to public directory for client access
    const publicPath = path.join(process.cwd(), 'public', 'graphrag-snapshot.json')
    await fs.mkdir(path.dirname(publicPath), { recursive: true })
    await fs.copyFile(this.snapshotPath, publicPath)
    console.log(`📁 Copied snapshot to public directory`)
  }

  async loadSnapshot() {
    try {
      const data = await fs.readFile(this.snapshotPath, 'utf-8')
      const snapshot = JSON.parse(data)
      
      // Rebuild graph from snapshot
      this.graph.clear()
      
      // Add nodes
      snapshot.nodes.forEach(node => {
        this.graph.addNode(node.id, node.attributes)
      })
      
      // Add edges
      snapshot.edges.forEach(edge => {
        this.graph.addEdge(edge.source, edge.target, edge.attributes)
      })
      
      console.log(`📂 Loaded GraphRAG snapshot (${snapshot.metadata.templateCount} templates)`)
      return true
    } catch (error) {
      // Snapshot doesn't exist or is invalid
      return false
    }
  }
}

// Main build function
async function buildGraphRAG() {
  console.log('🚀 Building GraphRAG snapshot...')
  
  // Database configuration
  const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://zeal_user:zeal_password@localhost:5432/zeal_db?schema=public'
  const pool = new Pool(parseDatabaseUrl(DATABASE_URL))
  
  try {
    // Check if forced rebuild
    const forceRebuild = process.argv.includes('--force')
    
    // Check if snapshot already exists
    const snapshotPath = path.join(__dirname, '../data/graphrag-snapshot.json')
    if (!forceRebuild) {
      try {
        await fs.access(snapshotPath)
        const stats = await fs.stat(snapshotPath)
        const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60)
        
        if (ageInHours < 24) {
          console.log('✅ GraphRAG snapshot is recent (< 24 hours old). Use --force to rebuild.')
          return
        }
      } catch {
        // File doesn't exist, continue with build
      }
    }
    
    // Load templates from database
    const result = await pool.query(`
      SELECT 
        template_id,
        template_data
      FROM node_templates
      WHERE status = 'active'
      ORDER BY template_id
    `)
    
    const templates = result.rows.map(row => {
      const template = row.template_data
      if (!template.id) {
        template.id = row.template_id
      }
      return template
    })
    
    console.log(`📚 Loaded ${templates.length} templates from database`)
    
    if (templates.length === 0) {
      console.error('❌ No templates found. Run "npm run templates:ingest" first.')
      process.exit(1)
    }
    
    // Use real LLM if API key is available, otherwise use mock
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
    let llm
    
    if (OPENROUTER_API_KEY) {
      console.log('🤖 Using OpenRouter LLM for analysis...')
      llm = createOpenRouterLLM(OPENROUTER_API_KEY)
    } else {
      console.error('❌ No OpenRouter API key found. Set OPENROUTER_API_KEY environment variable to use LLM features.')
      process.exit(1)
    }
    
    // Build the graph
    const builder = new LLMGraphBuilder(llm, snapshotPath)
    await builder.buildFromTemplates(templates, forceRebuild)
    
    console.log('✅ GraphRAG snapshot built successfully!')
    
  } catch (error) {
    console.error('❌ Failed to build GraphRAG:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}




/**
 * Create OpenRouter LLM client
 */
function createOpenRouterLLM(apiKey) {
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku-20240307'
  
  return {
    invoke: async (prompt) => {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/offbit-ai/zeal',
            'X-Title': 'Zeal GraphRAG Builder'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: 'You are an expert at analyzing workflow node templates and their relationships. Always respond with valid JSON when requested.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3,
            max_tokens: 4000
          })
        })
        
        if (!response.ok) {
          const error = await response.text()
          throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
        }
        
        const data = await response.json()
        return data.choices[0].message.content
      } catch (error) {
        console.error('LLM invocation failed:', error)
        throw error
      }
    }
  }
}

// Run the build
buildGraphRAG().catch(console.error)