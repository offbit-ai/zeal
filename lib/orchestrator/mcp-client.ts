/**
 * MCP Client for interacting with Zeal MCP servers
 * This client makes HTTP requests to API endpoints that proxy to the MCP servers
 */

export class MCPClient {
  private apiBase: string

  constructor() {
    this.apiBase = process.env.NEXT_PUBLIC_API_BASE || ''
  }

  async callTool(
    server: 'workflow_manager' | 'node_template_repository' | 'embed_orchestrator',
    toolName: string,
    args: Record<string, any>
  ): Promise<string> {
    try {
      // Map MCP server to API endpoint
      const { endpoint, method, transformArgs } = this.getEndpointForTool(server, toolName)

      const requestArgs = transformArgs ? transformArgs(args) : args

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      }

      if (method !== 'GET') {
        options.body = JSON.stringify(requestArgs)
      }

      let url = `${this.apiBase}${endpoint}`

      if (method === 'GET') {
        if (args.workflowId) {
          url = `${this.apiBase}${endpoint}/${args.workflowId}`
        } else if (args.templateId && server === 'node_template_repository' && toolName === 'get_template') {
          // Special handling for get_template - use path parameter
          url = `${this.apiBase}${endpoint}/${args.templateId}`
        } else if (Object.keys(requestArgs).length > 0) {
          const params = new URLSearchParams()
          Object.entries(requestArgs).forEach(([key, value]) => {
            if (value !== undefined && value !== null && key !== 'templateId') {
              params.append(key, String(value))
            }
          })
          url = `${this.apiBase}${endpoint}?${params.toString()}`
        }
      }

      console.log(`MCP API call: ${method} ${url}`)
      if (method !== 'GET') {
        console.log('Request body:', JSON.stringify(requestArgs, null, 2))
      }

      const response = await fetch(url, options)

      if (!response.ok) {
        console.error(`API error for ${method} ${url}: ${response.status} ${response.statusText}`)
        const errorText = await response.text()
        console.error('Error response:', errorText)
        throw new Error(`API error: ${response.statusText}`)
      }

      // Check if response has content
      const responseText = await response.text()
      if (!responseText) {
        console.warn(`Empty response from ${method} ${url}`)
        return JSON.stringify([]) // Return empty array for search endpoints
      }

      try {
        const data = JSON.parse(responseText)
        // Return the full response including success field for proper error handling
        return JSON.stringify(data)
      } catch (e) {
        console.error(`Failed to parse response from ${method} ${url}:`, e)
        console.error('Response text:', responseText)
        // If it's not valid JSON, return it as-is
        return responseText
      }
    } catch (error) {
      console.error(`Error calling ${server}.${toolName}:`, error)
      throw error
    }
  }

  private getEndpointForTool(
    server: string,
    toolName: string
  ): {
    endpoint: string
    method: string
    transformArgs?: (args: any) => any
  } {
    // Map MCP tools to existing API endpoints
    const mappings: Record<
      string,
      { endpoint: string; method: string; transformArgs?: (args: any) => any }
    > = {
      // Workflow Manager mappings
      'workflow_manager.create_workflow': {
        endpoint: '/api/workflows',
        method: 'POST',
        transformArgs: args => ({
          name: args.name,
          description: args.description,
          graphs: [
            {
              id: 'main',
              name: 'Main',
              nodes: [],
              connections: [],
              groups: [],
            },
          ],
          activeGraphId: 'main',
        }),
      },
      'workflow_manager.list_workflows': {
        endpoint: '/api/workflows',
        method: 'GET',
      },
      'workflow_manager.get_workflow': {
        endpoint: '/api/workflows',
        method: 'GET',
      },
      'workflow_manager.update_workflow': {
        endpoint: '/api/workflows',
        method: 'PUT',
      },
      'workflow_manager.delete_workflow': {
        endpoint: '/api/workflows',
        method: 'DELETE',
      },

      // Node Template Repository mappings
      'node_template_repository.search_templates': {
        endpoint: '/api/templates',
        method: 'GET',
      },
      'node_template_repository.get_template': {
        endpoint: '/api/templates',
        method: 'GET',
      },
      'node_template_repository.get_categories': {
        endpoint: '/api/templates/categories',
        method: 'GET',
      },

      // Embed Orchestrator mappings
      'embed_orchestrator.create_node': {
        endpoint: '/api/orchestrator/nodes',
        method: 'POST',
        transformArgs: args => {
          const { apiKey, useCRDT, ...rest } = args
          return rest
        },
      },
      'embed_orchestrator.add_node': {
        endpoint: '/api/orchestrator/nodes',
        method: 'POST',
        transformArgs: args => {
          // Remove apiKey from the args sent to API
          const { apiKey, ...rest } = args
          return rest
        },
      },
      'embed_orchestrator.add_nodes_batch': {
        endpoint: '/api/orchestrator/nodes/batch',
        method: 'POST',
        transformArgs: args => {
          // Remove apiKey from the args sent to API
          const { apiKey, ...rest } = args
          return rest
        },
      },
      'embed_orchestrator.list_workflow_nodes': {
        endpoint: '/api/orchestrator/nodes/list',
        method: 'POST',
        transformArgs: args => {
          // Remove apiKey from the args sent to API
          const { apiKey, ...rest } = args
          return rest
        },
      },
      'embed_orchestrator.add_node_from_template': {
        endpoint: '/api/orchestrator/nodes/from-template',
        method: 'POST',
        transformArgs: args => {
          // Remove apiKey from the args sent to API
          const { apiKey, templateQuery, ...rest } = args
          return {
            ...rest,
            query: templateQuery, // Transform templateQuery to query
          }
        },
      },
      'embed_orchestrator.search_node_templates': {
        endpoint: '/api/templates',
        method: 'GET',
      },
      'embed_orchestrator.create_node_group': {
        endpoint: '/api/orchestrator/groups',
        method: 'POST',
        transformArgs: args => {
          // Remove apiKey from the args sent to API
          const { apiKey, ...rest } = args
          return rest
        },
      },
      'embed_orchestrator.create_subgraph': {
        endpoint: '/api/orchestrator/subgraphs',
        method: 'POST',
      },
      'embed_orchestrator.connect_nodes': {
        endpoint: '/api/orchestrator/connections',
        method: 'POST',
        transformArgs: args => {
          // Remove apiKey from the args sent to API
          const { apiKey, ...rest } = args
          return rest
        },
      },
      'embed_orchestrator.update_node_properties': {
        endpoint: '/api/orchestrator/nodes/properties',
        method: 'PUT',
        transformArgs: args => {
          // Remove apiKey from the args sent to API
          const { apiKey, ...rest } = args
          return rest
        },
      },
      'embed_orchestrator.update_node_position': {
        endpoint: '/api/orchestrator/nodes/position',
        method: 'PUT',
        transformArgs: args => {
          // Remove apiKey from the args sent to API
          const { apiKey, ...rest } = args
          return rest
        },
      },
      'embed_orchestrator.update_group_properties': {
        endpoint: '/api/orchestrator/groups',
        method: 'PUT',
        transformArgs: args => {
          // Remove apiKey from the args sent to API
          const { apiKey, ...rest } = args
          return rest
        },
      },
    }

    const key = `${server}.${toolName}`
    const config = mappings[key]

    if (!config) {
      throw new Error(`No endpoint mapping for ${key}`)
    }

    return config
  }
}
