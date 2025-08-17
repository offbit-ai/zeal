/**
 * File-based template ingestion service
 * Scans and imports node templates from the filesystem
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'
import * as chokidar from 'chokidar'
import {
  NodeTemplate,
  TemplateFile,
  IngestionResult,
  TemplateStatus,
  NodeShape,
  Port,
} from '../core/models'
import { TemplateOperations } from '../core/database-operations'
import { EmbeddingService } from '../search/embedding-service'
import { MetadataExtractor } from './metadata-extractor'

export interface IngestionConfig {
  // Source directories
  sourcePaths: string[]

  // File patterns
  includePatterns: string[]
  excludePatterns: string[]

  // Processing options
  watchMode: boolean
  batchSize: number
  parallelism: number

  // Validation
  validateSchema: boolean
  validateReferences: boolean
  strictMode: boolean

  // Scheduling
  schedule?: string
  onStartup: boolean
}

export class FileIngestionService {
  private watcher?: chokidar.FSWatcher

  constructor(
    private config: IngestionConfig,
    private repository: TemplateOperations,
    private embeddingService: EmbeddingService,
    private metadataExtractor: MetadataExtractor
  ) {}

  async ingestTemplates(): Promise<IngestionResult> {
    const result: IngestionResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    }

    try {
      // Scan template files
      const files = await this.scanTemplateFiles()
      console.log(`Found ${files.length} template files to process`)

      // Process in batches
      const batches = this.chunk(files, this.config.batchSize)

      for (const batch of batches) {
        await Promise.all(
          batch.map(async file => {
            result.processed++

            try {
              // Parse template
              const templates = await this.parseTemplateFile(file)

              for (const template of templates) {
                // Validate
                if (this.config.validateSchema) {
                  await this.validateTemplate(template)
                }

                // Check if already exists
                const existing = await this.repository.getTemplate(template.id)

                if (existing && !this.hasChanges(existing, template)) {
                  result.skipped++
                  continue
                }

                // Generate embeddings
                const embeddings = await this.embeddingService.generateEmbeddings(template)

                // Extract metadata
                const metadata = await this.metadataExtractor.extractMetadata(template)

                // Store or update
                await this.repository.upsertRepository({
                  template,
                  embeddings,
                  metadata,
                  source: {
                    type: 'file',
                    location: file.path,
                  },
                })

                result.succeeded++
              }
            } catch (error) {
              result.failed++
              result.errors.push({
                file: file.path,
                error: error instanceof Error ? error.message : 'Unknown error',
              })
              console.error(`Error processing ${file.path}:`, error)
            }
          })
        )
      }

      // Update relationships after all templates are loaded
      await this.updateAllRelationships()
    } catch (error) {
      console.error('Ingestion error:', error)
      throw error
    }

    return result
  }

  async watchTemplateFiles(): Promise<void> {
    this.watcher = chokidar.watch(this.config.sourcePaths, {
      ignored: this.config.excludePatterns,
      persistent: true,
      ignoreInitial: true,
    })

    this.watcher
      .on('add', (path: string) => this.handleFileAdded(path))
      .on('change', (path: string) => this.handleFileChanged(path))
      .on('unlink', (path: string) => this.handleFileRemoved(path))

    console.log('Watching template files for changes...')
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = undefined
    }
  }

  private async scanTemplateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = []

    for (const sourcePath of this.config.sourcePaths) {
      for (const pattern of this.config.includePatterns) {
        const matches = await glob(path.join(sourcePath, pattern), {
          ignore: this.config.excludePatterns,
        })

        for (const filePath of matches) {
          const stats = await fs.stat(filePath)
          const category = this.extractCategoryFromPath(filePath)

          files.push({
            path: filePath,
            category,
            lastModified: stats.mtime,
          })
        }
      }
    }

    return files
  }

  private async parseTemplateFile(file: TemplateFile): Promise<NodeTemplate[]> {
    const content = await fs.readFile(file.path, 'utf-8')
    const fileName = path.basename(file.path, path.extname(file.path))

    // Import the module
    if (file.path.endsWith('.ts') || file.path.endsWith('.js')) {
      // For TypeScript/JavaScript files, we need to import them
      const module = await import(file.path)

      // Extract templates from the module
      const templates: NodeTemplate[] = []

      // Handle different export patterns
      if (module.templates && Array.isArray(module.templates)) {
        // Export: { templates: NodeTemplate[] }
        templates.push(...this.normalizeTemplates(module.templates, file))
      } else if (module.default && Array.isArray(module.default)) {
        // Export default: NodeTemplate[]
        templates.push(...this.normalizeTemplates(module.default, file))
      } else {
        // Named exports - each export is a template or category
        for (const [key, value] of Object.entries(module)) {
          if (key === 'default' || key === 'templates') continue

          if (Array.isArray(value)) {
            templates.push(...this.normalizeTemplates(value, file))
          } else if (this.isTemplate(value)) {
            templates.push(this.normalizeTemplate(value as any, file))
          }
        }
      }

      return templates
    } else if (file.path.endsWith('.json')) {
      // For JSON files
      const data = JSON.parse(content)

      if (Array.isArray(data)) {
        return this.normalizeTemplates(data, file)
      } else if (data.templates && Array.isArray(data.templates)) {
        return this.normalizeTemplates(data.templates, file)
      } else if (this.isTemplate(data)) {
        return [this.normalizeTemplate(data, file)]
      }
    }

    return []
  }

  private normalizeTemplates(templates: any[], file: TemplateFile): NodeTemplate[] {
    return templates.map(t => this.normalizeTemplate(t, file))
  }

  private normalizeTemplate(template: any, file: TemplateFile): NodeTemplate {
    // Generate consistent ID
    const id =
      template.id || `tpl_${file.category}_${template.title?.toLowerCase().replace(/\s+/g, '_')}`

    return {
      id,
      version: template.version || '1.0.0',
      status: template.status || TemplateStatus.ACTIVE,

      title: template.title || template.name || 'Untitled',
      subtitle: template.subtitle,
      description: template.description || '',
      category: template.category || file.category,
      subcategory: template.subcategory,
      tags: template.tags || [],

      icon: template.icon || 'box',
      variant: template.variant,
      shape: template.shape || NodeShape.RECTANGLE,
      size: template.size || 'medium',

      ports: this.normalizePorts(template.inputs, template.outputs),
      properties: template.properties || {},
      propertyRules: template.propertyRules,

      requiredEnvVars: template.requiredEnvVars,
      dependencies: template.dependencies,

      source: {
        type: 'file',
        location: file.path,
      },

      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      updatedBy: 'system',
      isActive: true,
    }
  }

  private normalizePorts(inputs?: any[], outputs?: any[]): Port[] {
    const ports: Port[] = []

    // Normalize input ports
    if (inputs && Array.isArray(inputs)) {
      inputs.forEach((input, index) => {
        if (typeof input === 'string') {
          ports.push({
            id: `input-${index}`,
            label: input,
            type: 'input',
            position: 'left',
          })
        } else if (input && typeof input === 'object') {
          ports.push({
            id: input.id || `input-${index}`,
            label: input.label || input.name || 'Input',
            type: 'input',
            position: input.position || 'left',
            description: input.description,
            schema: input.schema || input.type,
            required: input.required,
            multiple: input.multiple,
          })
        }
      })
    }

    // Normalize output ports
    if (outputs && Array.isArray(outputs)) {
      outputs.forEach((output, index) => {
        if (typeof output === 'string') {
          ports.push({
            id: `output-${index}`,
            label: output,
            type: 'output',
            position: 'right',
          })
        } else if (output && typeof output === 'object') {
          ports.push({
            id: output.id || `output-${index}`,
            label: output.label || output.name || 'Output',
            type: 'output',
            position: output.position || 'right',
            description: output.description,
            schema: output.schema || output.type,
            required: output.required,
            multiple: output.multiple,
          })
        }
      })
    }

    return ports
  }

  private isTemplate(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      (obj.title || obj.name) &&
      (obj.inputs || obj.outputs || obj.ports)
    )
  }

  private async validateTemplate(template: NodeTemplate): Promise<void> {
    // Basic validation
    if (!template.id) {
      throw new Error('Template must have an ID')
    }

    if (!template.title) {
      throw new Error('Template must have a title')
    }

    if (!template.category) {
      throw new Error('Template must have a category')
    }

    // Validate ports
    if (template.ports.length === 0) {
      console.warn(`Template ${template.id} has no ports defined`)
    }

    // Validate property references in ports
    if (this.config.validateReferences) {
      for (const port of template.ports) {
        if (port.schema && typeof port.schema === 'object') {
          // TODO: Validate schema structure
        }
      }
    }
  }

  private hasChanges(existing: NodeTemplate, updated: NodeTemplate): boolean {
    // Compare key fields
    return (
      existing.version !== updated.version ||
      existing.title !== updated.title ||
      existing.description !== updated.description ||
      JSON.stringify(existing.ports) !== JSON.stringify(updated.ports) ||
      JSON.stringify(existing.properties) !== JSON.stringify(updated.properties)
    )
  }

  private extractCategoryFromPath(filePath: string): string {
    // Extract category from file path
    // e.g., /data/nodeTemplates/aiModels.ts -> aiModels
    const fileName = path.basename(filePath, path.extname(filePath))

    // Map file names to categories
    const categoryMap: Record<string, string> = {
      aiModels: 'ai-models',
      communication: 'communication',
      dataProcessing: 'data-processing',
      dataSources: 'data-sources',
      graphIO: 'graph-io',
      logicControl: 'logic-control',
      scripting: 'scripting',
      serverNodes: 'server',
      storageMemory: 'storage-memory',
      toolsUtilities: 'tools-utilities',
      userInputs: 'user-inputs',
    }

    return categoryMap[fileName] || 'uncategorized'
  }

  private async updateAllRelationships(): Promise<void> {
    // TODO: Implement relationship detection
    // This would analyze templates to find common usage patterns
    console.log('Updating template relationships...')
  }

  private async handleFileAdded(filePath: string): Promise<void> {
    console.log(`Template file added: ${filePath}`)
    const file: TemplateFile = {
      path: filePath,
      category: this.extractCategoryFromPath(filePath),
      lastModified: new Date(),
    }

    try {
      const templates = await this.parseTemplateFile(file)
      for (const template of templates) {
        const embeddings = await this.embeddingService.generateEmbeddings(template)
        const metadata = await this.metadataExtractor.extractMetadata(template)

        await this.repository.upsertRepository({
          template,
          embeddings,
          metadata,
          source: {
            type: 'file',
            location: file.path,
          },
        })
      }
    } catch (error) {
      console.error(`Error processing added file ${filePath}:`, error)
    }
  }

  private async handleFileChanged(filePath: string): Promise<void> {
    console.log(`Template file changed: ${filePath}`)
    await this.handleFileAdded(filePath) // Re-process the file
  }

  private async handleFileRemoved(filePath: string): Promise<void> {
    console.log(`Template file removed: ${filePath}`)
    // TODO: Mark templates from this file as inactive/removed
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}
