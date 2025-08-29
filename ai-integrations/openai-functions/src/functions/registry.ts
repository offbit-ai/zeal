/**
 * Function Registry for OpenAI Functions
 * Defines all available functions with their schemas
 */

import { z } from 'zod';
import { ZIPBridge } from '../../../shared/zip-bridge';

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  category?: string;
  returns?: {
    type: string;
    description?: string;
  };
}

export class FunctionRegistry {
  private functions: Map<string, FunctionDefinition> = new Map();
  private categories: Map<string, FunctionDefinition[]> = new Map();

  constructor(private zipBridge: ZIPBridge) {
    this.registerAllFunctions();
  }

  private registerAllFunctions() {
    // Workflow Management Functions
    this.registerFunction({
      name: 'create_workflow',
      description: 'Create a new workflow in Zeal',
      category: 'workflow',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the workflow'
          },
          description: {
            type: 'string',
            description: 'Description of what the workflow does'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorizing the workflow'
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata for the workflow'
          }
        },
        required: ['name']
      },
      returns: {
        type: 'object',
        description: 'Created workflow object with ID'
      }
    });

    this.registerFunction({
      name: 'update_workflow',
      description: 'Update an existing workflow',
      category: 'workflow',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow to update'
          },
          name: {
            type: 'string',
            description: 'New name for the workflow'
          },
          description: {
            type: 'string',
            description: 'New description'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Updated tags'
          },
          metadata: {
            type: 'object',
            description: 'Updated metadata'
          }
        },
        required: ['workflow_id']
      }
    });

    this.registerFunction({
      name: 'delete_workflow',
      description: 'Delete a workflow',
      category: 'workflow',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow to delete'
          }
        },
        required: ['workflow_id']
      }
    });

    this.registerFunction({
      name: 'get_workflow',
      description: 'Get detailed information about a workflow',
      category: 'workflow',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          }
        },
        required: ['workflow_id']
      }
    });

    this.registerFunction({
      name: 'list_workflows',
      description: 'List all workflows with optional filters',
      category: 'workflow',
      parameters: {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags'
          },
          search: {
            type: 'string',
            description: 'Search term for workflow names'
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of results',
            default: 20
          },
          offset: {
            type: 'integer',
            description: 'Offset for pagination',
            default: 0
          }
        }
      }
    });

    // Node Operations Functions
    this.registerFunction({
      name: 'add_node',
      description: 'Add a node to a workflow',
      category: 'node',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          node_type: {
            type: 'string',
            description: 'Type of node (e.g., http_request, transform, condition)'
          },
          position: {
            type: 'object',
            properties: {
              x: { type: 'number', description: 'X coordinate' },
              y: { type: 'number', description: 'Y coordinate' }
            },
            required: ['x', 'y'],
            description: 'Position on the canvas'
          },
          config: {
            type: 'object',
            description: 'Node-specific configuration'
          },
          metadata: {
            type: 'object',
            description: 'Additional node metadata'
          }
        },
        required: ['workflow_id', 'node_type', 'position']
      }
    });

    this.registerFunction({
      name: 'update_node',
      description: 'Update a node in a workflow',
      category: 'node',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          node_id: {
            type: 'string',
            description: 'ID of the node to update'
          },
          position: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' }
            },
            description: 'New position'
          },
          config: {
            type: 'object',
            description: 'Updated configuration'
          },
          metadata: {
            type: 'object',
            description: 'Updated metadata'
          }
        },
        required: ['workflow_id', 'node_id']
      }
    });

    this.registerFunction({
      name: 'delete_node',
      description: 'Remove a node from a workflow',
      category: 'node',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          node_id: {
            type: 'string',
            description: 'ID of the node to delete'
          }
        },
        required: ['workflow_id', 'node_id']
      }
    });

    this.registerFunction({
      name: 'connect_nodes',
      description: 'Create a connection between two nodes',
      category: 'node',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          source_node_id: {
            type: 'string',
            description: 'ID of the source node'
          },
          source_port: {
            type: 'string',
            description: 'Output port of the source node',
            default: 'output'
          },
          target_node_id: {
            type: 'string',
            description: 'ID of the target node'
          },
          target_port: {
            type: 'string',
            description: 'Input port of the target node',
            default: 'input'
          }
        },
        required: ['workflow_id', 'source_node_id', 'target_node_id']
      }
    });

    this.registerFunction({
      name: 'disconnect_nodes',
      description: 'Remove a connection between nodes',
      category: 'node',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          connection_id: {
            type: 'string',
            description: 'ID of the connection to remove'
          }
        },
        required: ['workflow_id', 'connection_id']
      }
    });

    // Execution Functions
    this.registerFunction({
      name: 'execute_workflow',
      description: 'Execute a workflow with optional input data',
      category: 'execution',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow to execute'
          },
          input_data: {
            type: 'object',
            description: 'Input data for the workflow'
          },
          execution_mode: {
            type: 'string',
            enum: ['sync', 'async', 'debug'],
            description: 'Execution mode',
            default: 'async'
          },
          timeout: {
            type: 'integer',
            description: 'Timeout in milliseconds (sync mode only)',
            default: 30000
          }
        },
        required: ['workflow_id']
      }
    });

    this.registerFunction({
      name: 'get_execution_status',
      description: 'Get the status of a workflow execution',
      category: 'execution',
      parameters: {
        type: 'object',
        properties: {
          execution_id: {
            type: 'string',
            description: 'ID of the execution'
          },
          include_traces: {
            type: 'boolean',
            description: 'Include detailed trace information',
            default: false
          },
          include_node_outputs: {
            type: 'boolean',
            description: 'Include outputs from each node',
            default: false
          }
        },
        required: ['execution_id']
      }
    });

    this.registerFunction({
      name: 'cancel_execution',
      description: 'Cancel a running workflow execution',
      category: 'execution',
      parameters: {
        type: 'object',
        properties: {
          execution_id: {
            type: 'string',
            description: 'ID of the execution to cancel'
          }
        },
        required: ['execution_id']
      }
    });

    this.registerFunction({
      name: 'stream_execution_events',
      description: 'Stream real-time execution events',
      category: 'execution',
      parameters: {
        type: 'object',
        properties: {
          execution_id: {
            type: 'string',
            description: 'ID of the execution'
          },
          event_types: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['node_started', 'node_completed', 'node_failed', 'data_flow', 'error']
            },
            description: 'Types of events to stream'
          }
        },
        required: ['execution_id']
      }
    });

    // Template Functions
    this.registerFunction({
      name: 'search_node_templates',
      description: 'Search available node templates using semantic search',
      category: 'template',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for finding relevant node templates'
          },
          category: {
            type: 'string',
            description: 'Filter by category (e.g., data, api, logic, ai)'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags'
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of results',
            default: 10
          }
        },
        required: ['query']
      }
    });

    this.registerFunction({
      name: 'get_template_details',
      description: 'Get detailed information about a node template',
      category: 'template',
      parameters: {
        type: 'object',
        properties: {
          template_id: {
            type: 'string',
            description: 'ID of the template'
          }
        },
        required: ['template_id']
      }
    });

    // Analytics Functions
    this.registerFunction({
      name: 'query_flow_traces',
      description: 'Query historical flow trace data for analysis',
      category: 'analytics',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          session_id: {
            type: 'string',
            description: 'Specific session ID'
          },
          time_range: {
            type: 'object',
            properties: {
              start: {
                type: 'string',
                format: 'date-time',
                description: 'Start time (ISO 8601)'
              },
              end: {
                type: 'string',
                format: 'date-time',
                description: 'End time (ISO 8601)'
              }
            },
            description: 'Time range for the query'
          },
          status_filter: {
            type: 'string',
            enum: ['success', 'failed', 'warning', 'all'],
            description: 'Filter by execution status',
            default: 'all'
          },
          node_id: {
            type: 'string',
            description: 'Filter by specific node'
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of results',
            default: 100
          }
        }
      }
    });

    this.registerFunction({
      name: 'get_workflow_analytics',
      description: 'Get performance analytics for a workflow',
      category: 'analytics',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          time_period: {
            type: 'string',
            enum: ['hour', 'day', 'week', 'month'],
            description: 'Time period for analytics',
            default: 'day'
          }
        },
        required: ['workflow_id']
      }
    });

    // Utility Functions
    this.registerFunction({
      name: 'validate_workflow',
      description: 'Validate a workflow configuration',
      category: 'utility',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow to validate'
          }
        },
        required: ['workflow_id']
      }
    });

    this.registerFunction({
      name: 'export_workflow',
      description: 'Export a workflow as JSON',
      category: 'utility',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow to export'
          },
          include_metadata: {
            type: 'boolean',
            description: 'Include metadata in export',
            default: true
          }
        },
        required: ['workflow_id']
      }
    });

    this.registerFunction({
      name: 'import_workflow',
      description: 'Import a workflow from JSON',
      category: 'utility',
      parameters: {
        type: 'object',
        properties: {
          workflow_json: {
            type: 'object',
            description: 'Workflow definition in JSON format'
          },
          name_suffix: {
            type: 'string',
            description: 'Suffix to add to the workflow name'
          }
        },
        required: ['workflow_json']
      }
    });
  }

  private registerFunction(definition: FunctionDefinition) {
    this.functions.set(definition.name, definition);
    
    if (definition.category) {
      if (!this.categories.has(definition.category)) {
        this.categories.set(definition.category, []);
      }
      this.categories.get(definition.category)!.push(definition);
    }
  }

  getAllFunctions(): FunctionDefinition[] {
    return Array.from(this.functions.values());
  }

  getFunction(name: string): FunctionDefinition | undefined {
    return this.functions.get(name);
  }

  getFunctionsByCategory(category: string): FunctionDefinition[] {
    return this.categories.get(category) || [];
  }

  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  hasFunction(name: string): boolean {
    return this.functions.has(name);
  }
}