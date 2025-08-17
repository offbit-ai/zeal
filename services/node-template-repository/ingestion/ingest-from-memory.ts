/**
 * Ingest templates from in-memory data
 * This allows us to ingest the existing allNodeTemplates array
 */

import { allNodeTemplates } from '@/data/nodeTemplates'
import { NodeTemplate as DataNodeTemplate } from '@/data/nodeTemplates/types'
import { NodeTemplate, TemplateStatus, NodeShape } from '../core/models'
import { TemplateOperations } from '../core/database-operations'
import { EmbeddingService } from '../search/embedding-service'
import { MetadataExtractor } from './metadata-extractor'

export class InMemoryIngestionService {
  constructor(
    private repository: TemplateOperations,
    private embeddingService: EmbeddingService,
    private metadataExtractor: MetadataExtractor
  ) {}

  async ingestAllTemplates(): Promise<{
    total: number
    succeeded: number
    failed: number
    errors: Array<{ templateId: string; error: string }>
  }> {
    const result = {
      total: allNodeTemplates.length,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ templateId: string; error: string }>,
    }

    for (const dataTemplate of allNodeTemplates) {
      try {
        const template = this.convertDataTemplate(dataTemplate)

        // Generate embeddings
        const embeddings = await this.embeddingService.generateEmbeddings(template)

        // Extract metadata
        const metadata = await this.metadataExtractor.extractMetadata(template)

        // Store in repository
        await this.repository.upsertRepository({
          template,
          embeddings,
          metadata,
          source: {
            type: 'file',
            location: 'data/nodeTemplates',
          },
        })

        result.succeeded++
      } catch (error) {
        result.failed++
        result.errors.push({
          templateId: dataTemplate.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return result
  }

  private convertDataTemplate(dataTemplate: DataNodeTemplate): NodeTemplate {
    return {
      id: dataTemplate.id,
      version: dataTemplate.version || '1.0.0',
      status: dataTemplate.isActive !== false ? TemplateStatus.ACTIVE : TemplateStatus.DEPRECATED,

      title: dataTemplate.title,
      subtitle: dataTemplate.subtitle,
      description: dataTemplate.description,
      category: dataTemplate.category,
      subcategory: dataTemplate.subcategory,
      tags: dataTemplate.tags || [],

      icon: dataTemplate.icon,
      variant: dataTemplate.variant,
      shape: (dataTemplate.shape as NodeShape) || NodeShape.RECTANGLE,
      size: dataTemplate.size || 'medium',

      ports: dataTemplate.ports || [],
      properties: Object.entries(dataTemplate.properties || {}).reduce(
        (acc, [key, value]) => {
          acc[key] = {
            ...value,
            label: value.label || key, // Ensure label is always present
          }
          return acc
        },
        {} as Record<string, any>
      ),
      propertyRules: dataTemplate.propertyRules,

      requiredEnvVars: dataTemplate.requiredEnvVars,
      dependencies: [],

      source: {
        type: 'file',
        location: 'data/nodeTemplates',
      },

      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      updatedBy: 'system',
      isActive: dataTemplate.isActive !== false,
    }
  }
}
