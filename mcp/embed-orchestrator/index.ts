#!/usr/bin/env node

/**
 * MCP Server for Zeal Embed Orchestration
 *
 * Provides tools for AI agents to orchestrate workflow creation and modification
 * through the embed API, including nodes, groups, subgraphs, and proxies.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { getDatabaseOperations } from '../../lib/database'
import { EmbedApiKeyService } from '../../services/embedApiKeyService'
import { generateId } from '../../lib/database'
import { WorkflowOperations } from './workflow-operations'
import { getTemplateOperations } from '../../lib/database-template-operations'
import { SearchService } from '../../services/node-template-repository/search/search-service'
import { EmbeddingService } from '../../services/node-template-repository/search/embedding-service'

// Tool schemas
const NodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

const NodeMetadataSchema = z.object({
  type: z.string(),
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  category: z.string().optional(),
  variant: z.string().optional(),
  shape: z.string().optional(),
  inputs: z.array(z.any()).optional(),
  outputs: z.array(z.any()).optional(),
  properties: z.record(z.any()).optional(),
  propertyValues: z.record(z.any()).optional(),
})

const NodeGroupSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  nodeIds: z.array(z.string()),
  color: z.string().optional(),
  collapsed: z.boolean().optional(),
})

const SubgraphSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputs: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
      })
    )
    .optional(),
  outputs: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
      })
    )
    .optional(),
})

// Create MCP server
const server = new Server(
  {
    name: 'zeal-embed-orchestrator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Helper function to validate API key and get permissions
async function validateApiKey(apiKey: string, workflowId: string) {
  const validKey = await EmbedApiKeyService.validateApiKey(apiKey, workflowId)
  if (!validKey) {
    throw new Error('Invalid API key or insufficient permissions')
  }
  return validKey
}

// Initialize template search service (shared with node-template-repository MCP)
let templateSearchService: SearchService | null = null

async function getTemplateSearchService(): Promise<SearchService> {
  if (!templateSearchService) {
    const templateOps = await getTemplateOperations()
    const embeddingService = EmbeddingService.fromEnvironment()
    templateSearchService = new SearchService(templateOps, embeddingService)
  }
  return templateSearchService
}

// Tool definitions
const tools: Tool[] = [
  {
    name: 'add_node',
    description: 'Add a new node to a workflow graph',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          description: 'Embed API key for authentication',
        },
        workflowId: {
          type: 'string',
          description: 'ID of the workflow to modify',
        },
        graphId: {
          type: 'string',
          description: 'ID of the graph (default: main)',
          default: 'main',
        },
        metadata: {
          type: 'object',
          description: 'Node metadata including type, title, etc',
          properties: {
            type: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            icon: { type: 'string' },
            category: { type: 'string' },
            variant: { type: 'string' },
            shape: { type: 'string' },
            propertyValues: { type: 'object' },
          },
          required: ['type', 'title'],
        },
        position: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          required: ['x', 'y'],
        },
      },
      required: ['apiKey', 'workflowId', 'metadata', 'position'],
    },
  },
  {
    name: 'create_node_group',
    description: 'Create a new node group in a workflow',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          description: 'Embed API key for authentication',
        },
        workflowId: {
          type: 'string',
          description: 'ID of the workflow to modify',
        },
        graphId: {
          type: 'string',
          description: 'ID of the graph (default: main)',
          default: 'main',
        },
        group: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            nodeIds: {
              type: 'array',
              items: { type: 'string' },
            },
            color: { type: 'string' },
            collapsed: { type: 'boolean' },
          },
          required: ['title', 'nodeIds'],
        },
      },
      required: ['apiKey', 'workflowId', 'group'],
    },
  },
  {
    name: 'create_subgraph',
    description: 'Create a new subgraph in a workflow',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          description: 'Embed API key for authentication',
        },
        workflowId: {
          type: 'string',
          description: 'ID of the workflow to modify',
        },
        subgraph: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            inputs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  type: { type: 'string' },
                },
                required: ['id', 'name', 'type'],
              },
            },
            outputs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  type: { type: 'string' },
                },
                required: ['id', 'name', 'type'],
              },
            },
          },
          required: ['name'],
        },
      },
      required: ['apiKey', 'workflowId', 'subgraph'],
    },
  },
  {
    name: 'create_node_proxy',
    description: 'Create a proxy node that references another node or subgraph',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          description: 'Embed API key for authentication',
        },
        workflowId: {
          type: 'string',
          description: 'ID of the workflow to modify',
        },
        graphId: {
          type: 'string',
          description: 'ID of the graph (default: main)',
          default: 'main',
        },
        proxyType: {
          type: 'string',
          enum: ['node', 'subgraph'],
          description: 'Type of proxy to create',
        },
        referenceId: {
          type: 'string',
          description: 'ID of the node or subgraph to reference',
        },
        position: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          required: ['x', 'y'],
        },
        title: {
          type: 'string',
          description: 'Title for the proxy node',
        },
      },
      required: ['apiKey', 'workflowId', 'proxyType', 'referenceId', 'position'],
    },
  },
  {
    name: 'search_node_templates',
    description: 'Search for node templates using semantic search',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Semantic search query for node templates',
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
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_node_from_template',
    description: 'Search for a template and add it as a node to the workflow in one step',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          description: 'Embed API key for authentication',
        },
        workflowId: {
          type: 'string',
          description: 'ID of the workflow to modify',
        },
        graphId: {
          type: 'string',
          description: 'ID of the graph (default: main)',
          default: 'main',
        },
        templateQuery: {
          type: 'string',
          description: 'Search query to find the template',
        },
        position: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          required: ['x', 'y'],
        },
        customTitle: {
          type: 'string',
          description: 'Custom title for the node (optional)',
        },
        propertyValues: {
          type: 'object',
          description: 'Property values to set on the node (optional)',
        },
      },
      required: ['apiKey', 'workflowId', 'templateQuery', 'position'],
    },
  },
  {
    name: 'list_workflow_nodes',
    description: 'List all nodes in a workflow graph',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          description: 'Embed API key for authentication',
        },
        workflowId: {
          type: 'string',
          description: 'ID of the workflow',
        },
        graphId: {
          type: 'string',
          description: 'ID of the graph (default: main)',
          default: 'main',
        },
      },
      required: ['apiKey', 'workflowId'],
    },
  },
  {
    name: 'connect_nodes',
    description: 'Create a connection between two nodes',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          description: 'Embed API key for authentication',
        },
        workflowId: {
          type: 'string',
          description: 'ID of the workflow to modify',
        },
        graphId: {
          type: 'string',
          description: 'ID of the graph (default: main)',
          default: 'main',
        },
        sourceNodeId: {
          type: 'string',
          description: 'ID of the source node',
        },
        sourcePortId: {
          type: 'string',
          description: 'ID of the source port',
        },
        targetNodeId: {
          type: 'string',
          description: 'ID of the target node',
        },
        targetPortId: {
          type: 'string',
          description: 'ID of the target port',
        },
      },
      required: [
        'apiKey',
        'workflowId',
        'sourceNodeId',
        'sourcePortId',
        'targetNodeId',
        'targetPortId',
      ],
    },
  },
]

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}))

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'add_node': {
        const { apiKey, workflowId, graphId = 'main', metadata, position } = args as any

        // Validate API key
        const validKey = await validateApiKey(apiKey, workflowId)
        if (!validKey.permissions.canAddNodes) {
          throw new Error('API key does not have permission to add nodes')
        }

        // Add node using WorkflowOperations
        const node = await WorkflowOperations.addNode(workflowId, graphId, {
          metadata,
          position,
          propertyValues: metadata.propertyValues,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                nodeId: node.id,
                message: 'Node added successfully',
                node,
              }),
            },
          ],
        }
      }

      case 'create_node_group': {
        const { apiKey, workflowId, graphId = 'main', group } = args as any

        // Validate API key
        const validKey = await validateApiKey(apiKey, workflowId)
        if (!validKey.permissions.canAddGroups) {
          throw new Error('API key does not have permission to create groups')
        }

        // Create group using WorkflowOperations
        const createdGroup = await WorkflowOperations.createNodeGroup(workflowId, graphId, group)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                groupId: createdGroup.id,
                message: 'Node group created successfully',
                group: createdGroup,
              }),
            },
          ],
        }
      }

      case 'create_subgraph': {
        const { apiKey, workflowId, subgraph } = args as any

        // Validate API key
        const validKey = await validateApiKey(apiKey, workflowId)
        if (!validKey.permissions.canAddNodes) {
          throw new Error('API key does not have permission to create subgraphs')
        }

        // Create subgraph using WorkflowOperations
        const subgraphId = await WorkflowOperations.createSubgraph(workflowId, subgraph)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                subgraphId,
                message: 'Subgraph created successfully',
              }),
            },
          ],
        }
      }

      case 'create_node_proxy': {
        const {
          apiKey,
          workflowId,
          graphId = 'main',
          proxyType,
          referenceId,
          position,
          title,
        } = args as any

        // Validate API key
        const validKey = await validateApiKey(apiKey, workflowId)
        if (!validKey.permissions.canAddNodes) {
          throw new Error('API key does not have permission to create proxy nodes')
        }

        // Create proxy metadata
        const proxyMetadata = {
          type: `proxy-${proxyType}`,
          title: title || `${proxyType} Proxy`,
          referenceId,
          referenceType: proxyType,
          icon: proxyType === 'subgraph' ? 'workflow' : 'link',
          category: 'proxy',
        }

        // Add proxy node using WorkflowOperations
        const proxyNode = await WorkflowOperations.addNode(workflowId, graphId, {
          metadata: proxyMetadata,
          position,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                proxyNodeId: proxyNode.id,
                message: 'Proxy node created successfully',
                proxyNode,
              }),
            },
          ],
        }
      }

      case 'search_node_templates': {
        const { query, category, limit = 10 } = args as any

        try {
          // Use the node template repository search service
          const searchService = await getTemplateSearchService()

          const searchResults = await searchService.search({
            query,
            category,
            limit,
          })

          // Format results for embed orchestrator use
          const formattedResults = searchResults.map(result => ({
            templateId: result.template.id,
            type: result.template.id,
            title: result.template.title,
            subtitle: result.template.subtitle,
            description: result.template.description,
            category: result.template.category,
            subcategory: result.template.subcategory,
            tags: result.template.tags,
            icon: result.template.icon,
            variant: result.template.variant,
            shape: result.template.shape,
            ports: result.template.ports,
            properties: result.template.properties,
            requiredEnvVars: result.template.requiredEnvVars,
            relevanceScore: result.score,
            version: result.template.version,
            isActive: result.template.isActive,
          }))

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  results: formattedResults,
                  totalCount: searchResults.length,
                  query,
                  searchType: 'semantic',
                  message: `Found ${formattedResults.length} matching templates`,
                }),
              },
            ],
          }
        } catch (error) {
          console.error('Template search error:', error)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Template search failed',
                  message: error instanceof Error ? error.message : 'Unknown error',
                  results: [],
                }),
              },
            ],
          }
        }
      }

      case 'add_node_from_template': {
        const {
          apiKey,
          workflowId,
          graphId = 'main',
          templateQuery,
          position,
          customTitle,
          propertyValues,
        } = args as any

        try {
          // Validate API key
          const validKey = await validateApiKey(apiKey, workflowId)
          if (!validKey.permissions.canAddNodes) {
            throw new Error('API key does not have permission to add nodes')
          }

          // Search for templates
          const searchService = await getTemplateSearchService()
          const searchResults = await searchService.search({
            query: templateQuery,
            limit: 1, // Get the best match
          })

          if (searchResults.length === 0) {
            throw new Error(`No templates found matching query: "${templateQuery}"`)
          }

          const template = searchResults[0].template

          // Create node metadata from template
          const nodeMetadata = {
            type: template.id,
            title: customTitle || template.title,
            subtitle: template.subtitle,
            description: template.description,
            icon: template.icon,
            category: template.category,
            variant: template.variant,
            shape: template.shape,
            ports: template.ports,
            properties: template.properties,
            propertyValues: {
              ...template.properties,
              ...propertyValues,
            },
            requiredEnvVars: template.requiredEnvVars,
            tags: template.tags,
          }

          // Add node using WorkflowOperations
          const node = await WorkflowOperations.addNode(workflowId, graphId, {
            metadata: nodeMetadata,
            position,
            propertyValues: nodeMetadata.propertyValues,
          })

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  nodeId: node.id,
                  templateId: template.id,
                  templateTitle: template.title,
                  relevanceScore: searchResults[0].score,
                  message: `Added node "${nodeMetadata.title}" from template "${template.title}"`,
                  node,
                }),
              },
            ],
          }
        } catch (error) {
          console.error('Add node from template error:', error)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Failed to add node from template',
                  message: error instanceof Error ? error.message : 'Unknown error',
                }),
              },
            ],
          }
        }
      }

      case 'list_workflow_nodes': {
        const { apiKey, workflowId, graphId = 'main' } = args as any

        // Validate API key
        const validKey = await validateApiKey(apiKey, workflowId)
        if (!validKey.permissions.canViewWorkflow) {
          throw new Error('API key does not have permission to view workflow')
        }

        // List nodes using WorkflowOperations
        const nodes = await WorkflowOperations.listNodes(workflowId, graphId)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                nodes,
                count: nodes.length,
              }),
            },
          ],
        }
      }

      case 'connect_nodes': {
        const {
          apiKey,
          workflowId,
          graphId = 'main',
          sourceNodeId,
          sourcePortId,
          targetNodeId,
          targetPortId,
        } = args as any

        // Validate API key
        const validKey = await validateApiKey(apiKey, workflowId)
        if (!validKey.permissions.canEditNodes) {
          throw new Error('API key does not have permission to create connections')
        }

        // Create connection using WorkflowOperations
        const connection = await WorkflowOperations.connectNodes(workflowId, graphId, {
          sourceNodeId,
          sourcePortId,
          targetNodeId,
          targetPortId,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                connectionId: connection.id,
                message: 'Connection created successfully',
                connection,
              }),
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
            error: true,
            message: error instanceof Error ? error.message : 'Unknown error',
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
  console.error('Zeal Embed Orchestrator MCP Server started')
}

main().catch(error => {
  console.error('Server error:', error)
  process.exit(1)
})
