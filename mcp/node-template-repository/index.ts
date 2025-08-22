#!/usr/bin/env node

/**
 * MCP Server for Node Template Repository
 *
 * Provides AI agents with access to node template search, discovery,
 * and composition capabilities.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { getTemplateOperations } from '../../lib/database-template-operations'
import { SearchService } from '../../services/node-template-repository/search/search-service'
import { EmbeddingService } from '../../services/node-template-repository/search/embedding-service'
import { FileIngestionService } from '../../services/node-template-repository/ingestion/file-ingestion-service'
import { InMemoryIngestionService } from '../../services/node-template-repository/ingestion/ingest-from-memory'
import { MetadataExtractor } from '../../services/node-template-repository/ingestion/metadata-extractor'
import type { TemplateOperations } from '../../services/node-template-repository/core/database-operations'

// Initialize services
let searchService: SearchService | null = null
let templateOps: TemplateOperations | null = null

async function initializeServices() {
  if (!searchService || !templateOps) {
    templateOps = await getTemplateOperations()
    const embeddingService = EmbeddingService.fromEnvironment()
    searchService = new SearchService(templateOps, embeddingService)

    // Log template count for debugging
    try {
      const results = await templateOps.searchTemplates({ query: '' })
      const templateCount = Array.isArray(results) ? results.length : 0
      console.log(`[MCP] Node template repository initialized with ${templateCount} templates`)
    } catch (error) {
      console.error('[MCP] Failed to get template count:', error)
    }
  }

  return { searchService, templateOps }
}

// Create MCP server
const server = new Server(
  {
    name: 'node-template-repository',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Tool definitions
const tools: Tool[] = [
  {
    name: 'search_templates',
    description: 'Search for node templates using natural language queries',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query',
        },
        category: {
          type: 'string',
          description: 'Filter by category (optional)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (optional)',
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by capabilities (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20)',
          default: 20,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_template',
    description: 'Get detailed information about a specific template',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: {
          type: 'string',
          description: 'The ID of the template',
        },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'find_similar_templates',
    description: 'Find templates similar to a given template',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: {
          type: 'string',
          description: 'The ID of the reference template',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
          default: 10,
        },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'get_recommendations',
    description: 'Get template recommendations based on context',
    inputSchema: {
      type: 'object',
      properties: {
        recentlyUsed: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of recently used templates',
        },
        workflowCategory: {
          type: 'string',
          description: 'Category of the current workflow',
        },
        currentNodes: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of templates already in the workflow',
        },
      },
    },
  },
  {
    name: 'compose_workflow',
    description: 'Compose a workflow from templates based on requirements',
    inputSchema: {
      type: 'object',
      properties: {
        requirements: {
          type: 'string',
          description: 'Natural language description of workflow requirements',
        },
        constraints: {
          type: 'object',
          properties: {
            maxNodes: {
              type: 'number',
              description: 'Maximum number of nodes in the workflow',
            },
            requiredCapabilities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Required capabilities the workflow must have',
            },
            preferredTemplates: {
              type: 'array',
              items: { type: 'string' },
              description: 'Template IDs to prefer in the composition',
            },
          },
        },
      },
      required: ['requirements'],
    },
  },
  {
    name: 'validate_template_compatibility',
    description: 'Check if two templates are compatible for connection',
    inputSchema: {
      type: 'object',
      properties: {
        sourceTemplateId: {
          type: 'string',
          description: 'ID of the source template',
        },
        targetTemplateId: {
          type: 'string',
          description: 'ID of the target template',
        },
        sourcePortId: {
          type: 'string',
          description: 'ID of the output port on source template',
        },
        targetPortId: {
          type: 'string',
          description: 'ID of the input port on target template',
        },
      },
      required: ['sourceTemplateId', 'targetTemplateId'],
    },
  },
  {
    name: 'get_categories',
    description: 'Get the category tree of available templates',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'ingest_templates',
    description: 'Ingest templates from the file system (admin operation)',
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Paths to scan for templates',
        },
        force: {
          type: 'boolean',
          description: 'Force re-ingestion of existing templates',
          default: false,
        },
      },
    },
  },
]

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}))

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params
  const { searchService, templateOps } = await initializeServices()

  try {
    switch (name) {
      case 'search_templates': {
        const { query, category, tags, capabilities, limit = 20 } = args as any

        const results = await searchService.search({
          query,
          category,
          tags,
          capabilities,
          limit,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  count: results.length,
                  results: results.map(r => ({
                    template: {
                      id: r.template.id,
                      title: r.template.title,
                      description: r.template.description,
                      category: r.template.category,
                      tags: r.template.tags,
                      icon: r.template.icon,
                      ports: r.template.ports,
                    },
                    score: r.score,
                    highlights: r.highlights,
                  })),
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_template': {
        const { templateId } = args as any

        const template = await templateOps.getTemplate(templateId)
        const repository = await templateOps.getRepository(templateId)

        if (!template) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Template not found',
                }),
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  template,
                  metadata: repository
                    ? {
                        capabilities: repository.capabilities,
                        inputTypes: repository.inputTypes,
                        outputTypes: repository.outputTypes,
                        useCases: repository.useCases,
                        stats: repository.stats,
                      }
                    : null,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'find_similar_templates': {
        const { templateId, limit = 10 } = args as any

        const similar = await searchService.getSimilarTemplates(templateId, limit)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  count: similar.length,
                  similar: similar.map(r => ({
                    template: {
                      id: r.template.id,
                      title: r.template.title,
                      description: r.template.description,
                      category: r.template.category,
                    },
                    similarity: r.score,
                  })),
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_recommendations': {
        const { recentlyUsed, workflowCategory, currentNodes } = args as any

        const recommendations = await searchService.getRecommendations({
          recentlyUsed,
          workflowCategory,
          currentNodes,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  count: recommendations.length,
                  recommendations: recommendations.map(r => ({
                    template: {
                      id: r.template.id,
                      title: r.template.title,
                      description: r.template.description,
                      category: r.template.category,
                    },
                    score: r.score,
                  })),
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'compose_workflow': {
        const { requirements, constraints } = args as any

        // This is a complex operation that would require workflow composition logic
        // For now, we'll search for relevant templates and suggest a composition
        const searchResults = await searchService.search({
          query: requirements,
          limit: constraints?.maxNodes || 10,
        })

        // Simple composition: suggest templates that could work together
        const composition = {
          nodes: searchResults.map((r, index) => ({
            id: `node-${index}`,
            templateId: r.template.id,
            position: { x: index * 200, y: 100 },
            metadata: {
              title: r.template.title,
              category: r.template.category,
            },
          })),
          connections: [], // Would need logic to determine connections
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  composition,
                  explanation: `Found ${searchResults.length} relevant templates for "${requirements}"`,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'validate_template_compatibility': {
        const { sourceTemplateId, targetTemplateId, sourcePortId, targetPortId } = args as any

        const [sourceTemplate, targetTemplate] = await Promise.all([
          templateOps.getTemplate(sourceTemplateId),
          templateOps.getTemplate(targetTemplateId),
        ])

        if (!sourceTemplate || !targetTemplate) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'One or both templates not found',
                }),
              },
            ],
          }
        }

        // Simple compatibility check based on port types
        const sourcePort = sourceTemplate.ports.find(p => p.id === sourcePortId)
        const targetPort = targetTemplate.ports.find(p => p.id === targetPortId)

        const compatible = sourcePort?.type === 'output' && targetPort?.type === 'input'

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  compatible,
                  details: {
                    sourcePort: sourcePort
                      ? {
                          id: sourcePort.id,
                          label: sourcePort.label,
                          type: sourcePort.type,
                        }
                      : null,
                    targetPort: targetPort
                      ? {
                          id: targetPort.id,
                          label: targetPort.label,
                          type: targetPort.type,
                        }
                      : null,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_categories': {
        const categoryTree = await searchService.getCategoryTree()

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  categories: categoryTree,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'ingest_templates': {
        const { paths, force } = args as any

        const embeddingService = EmbeddingService.fromEnvironment()

        const metadataExtractor = new MetadataExtractor()

        const ingestionService = new FileIngestionService(
          {
            sourcePaths: paths || ['data/nodeTemplates'],
            includePatterns: ['*.ts', '*.js', '*.json'],
            excludePatterns: ['*.test.*', '*.spec.*'],
            watchMode: false,
            batchSize: 5,
            parallelism: 2,
            validateSchema: true,
            validateReferences: false,
            strictMode: false,
            onStartup: false,
          },
          templateOps,
          embeddingService,
          metadataExtractor
        )

        const result = await ingestionService.ingestTemplates()

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  result,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
    }
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Node Template Repository MCP Server started')
}

main().catch(error => {
  console.error('Server error:', error)
  process.exit(1)
})
