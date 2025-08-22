#!/usr/bin/env node

/**
 * MCP Server for Zeal Workflow Management
 *
 * Provides tools for AI agents to create, manage, and orchestrate workflows
 * including workflow creation, listing, updating, and deletion.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { WorkflowService } from '../../services/workflowService'
import { WorkflowStorageService } from '../../services/workflowStorage'
import type { WorkflowSnapshot } from '../../types/snapshot'

// Tool schemas
const CreateWorkflowSchema = z.object({
  name: z.string().describe('Name of the workflow'),
  description: z.string().optional().describe('Description of the workflow'),
})

const UpdateWorkflowSchema = z.object({
  workflowId: z.string().describe('ID of the workflow to update'),
  name: z.string().optional().describe('New name for the workflow'),
  description: z.string().optional().describe('New description for the workflow'),
})

const ListWorkflowsSchema = z.object({
  limit: z.number().optional().default(20).describe('Maximum number of workflows to return'),
  status: z.enum(['draft', 'published']).optional().describe('Filter by workflow status'),
  search: z.string().optional().describe('Search workflows by name or description'),
})

const GetWorkflowSchema = z.object({
  workflowId: z.string().describe('ID of the workflow to retrieve'),
})

const DeleteWorkflowSchema = z.object({
  workflowId: z.string().describe('ID of the workflow to delete'),
})

const PublishWorkflowSchema = z.object({
  workflowId: z.string().describe('ID of the workflow to publish'),
})

// Create MCP server
const server = new Server(
  {
    name: 'zeal-workflow-manager',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Define available tools
const tools: Tool[] = [
  {
    name: 'create_workflow',
    description: 'Create a new workflow',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the workflow' },
        description: { type: 'string', description: 'Description of the workflow' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_workflows',
    description: 'List all workflows with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of workflows to return',
          default: 20,
        },
        status: {
          type: 'string',
          enum: ['draft', 'published'],
          description: 'Filter by workflow status',
        },
        search: { type: 'string', description: 'Search workflows by name or description' },
      },
    },
  },
  {
    name: 'get_workflow',
    description: 'Get details of a specific workflow',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'ID of the workflow to retrieve' },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'update_workflow',
    description: 'Update an existing workflow metadata',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'ID of the workflow to update' },
        name: { type: 'string', description: 'New name for the workflow' },
        description: { type: 'string', description: 'New description for the workflow' },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'delete_workflow',
    description: 'Delete a workflow',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'ID of the workflow to delete' },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'publish_workflow',
    description: 'Publish a draft workflow',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'ID of the workflow to publish' },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'get_workflow_url',
    description: 'Get the URL to access a workflow in the Zeal UI',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'ID of the workflow' },
        embedMode: { type: 'boolean', description: 'Whether to get embed URL', default: false },
      },
      required: ['workflowId'],
    },
  },
]

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  }
})

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'create_workflow': {
        const { name: workflowName, description } = CreateWorkflowSchema.parse(args)

        // Create a new draft workflow
        const workflow = await WorkflowStorageService.createDraftWorkflow(workflowName)

        // Update description if provided
        if (description) {
          const updated = await WorkflowService.updateWorkflow(workflow.id, {
            ...workflow,
            description,
          })
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    workflow: updated,
                    url: `/workflow?id=${updated.id}`,
                    message: `Created workflow "${workflowName}" with ID: ${updated.id}`,
                  },
                  null,
                  2
                ),
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
                  workflow,
                  url: `/workflow?id=${workflow.id}`,
                  message: `Created workflow "${workflowName}" with ID: ${workflow.id}`,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'list_workflows': {
        const { limit, status, search } = ListWorkflowsSchema.parse(args)

        const result = await WorkflowService.getWorkflows({
          limit,
          status,
          search,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  workflows: result.workflows,
                  pagination: result.pagination,
                  message: `Found ${result.workflows.length} workflows`,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_workflow': {
        const { workflowId } = GetWorkflowSchema.parse(args)

        const workflow = await WorkflowService.getWorkflow(workflowId)

        if (!workflow) {
          throw new Error('Failed to get workflow')
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  workflow,
                  url: `/workflow?id=${workflow.id}`,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'update_workflow': {
        const { workflowId, name, description } = UpdateWorkflowSchema.parse(args)

        // Get existing workflow
        const existing = await WorkflowService.getWorkflow(workflowId)

        if (!existing) {
          throw new Error('Workflow not found')
        }

        // Update with new values
        const updated = await WorkflowService.updateWorkflow(workflowId, {
          ...existing,
          name: name || existing.name,
          description: description !== undefined ? description : existing.description,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  workflow: updated,
                  message: `Updated workflow "${updated.name}"`,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'delete_workflow': {
        const { workflowId } = DeleteWorkflowSchema.parse(args)

        await WorkflowService.deleteWorkflow(workflowId)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Deleted workflow ${workflowId}`,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'publish_workflow': {
        const { workflowId } = PublishWorkflowSchema.parse(args)

        const published = await WorkflowService.publishWorkflow(workflowId)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  workflow: published,
                  message: `Published workflow "${published.name}"`,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_workflow_url': {
        const { workflowId, embedMode } = z
          .object({
            workflowId: z.string(),
            embedMode: z.boolean().default(false),
          })
          .parse(args)

        const baseUrl = process.env.ZEAL_BASE_URL || 'http://localhost:3000'
        const url = embedMode
          ? `${baseUrl}/embed?workflowId=${workflowId}`
          : `${baseUrl}/workflow?id=${workflowId}`

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  url,
                  workflowId,
                  embedMode,
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
    console.error(`Error executing tool ${name}:`, error)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            null,
            2
          ),
        },
      ],
    }
  }
})

// Start the server
async function main() {
  console.error('Starting Zeal Workflow Manager MCP Server...')

  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('Zeal Workflow Manager MCP Server running on stdio')
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
