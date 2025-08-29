/**
 * AI-powered Workflow Designer
 * Analyzes requirements and creates workflow structures
 */

import { ZIPBridge, NodeDefinition, ConnectionDefinition } from '../../../shared/zip-bridge';
import { GraphRAGIntegration } from './graphrag-integration';

interface DesignRequirements {
  description: string;
  complexity?: 'simple' | 'moderate' | 'complex';
  includeErrorHandling?: boolean;
  includeValidation?: boolean;
  includeLogging?: boolean;
}

interface WorkflowDesign {
  nodes: NodeDefinition[];
  connections: ConnectionDefinition[];
  metadata: {
    designRationale: string;
    estimatedDuration: number;
    requiredNodeTypes: string[];
  };
}

export class WorkflowDesigner {
  // Common workflow patterns
  private patterns = {
    etl: ['data_source', 'transform', 'validate', 'data_sink'],
    api: ['http_trigger', 'auth', 'api_call', 'response_transform', 'http_response'],
    processing: ['input', 'validate', 'process', 'output'],
    monitoring: ['scheduler', 'check', 'condition', 'alert'],
    integration: ['webhook', 'transform', 'api_call', 'store', 'notify']
  };

  // Template search cache for performance
  private templateCache = new Map<string, any[]>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private lastCacheTime = 0;
  private graphragIntegration: GraphRAGIntegration | null = null;

  constructor(
    private zipBridge: ZIPBridge,
    private llm?: any,
    private embeddings?: any
  ) {
    // Initialize GraphRAG if LLM is available
    if (this.llm) {
      this.graphragIntegration = new GraphRAGIntegration(
        this.zipBridge,
        this.llm,
        this.embeddings
      );
    }
  }

  /**
   * Design a workflow based on natural language requirements
   */
  async designWorkflow(requirements: DesignRequirements): Promise<WorkflowDesign> {
    const { description, complexity = 'moderate', includeErrorHandling = true } = requirements;
    
    // Try to use GraphRAG if available
    if (this.graphragIntegration && this.graphragIntegration.isAvailable()) {
      try {
        console.log('🤖 Using GraphRAG for intelligent workflow design');
        const graphragDesign = await this.graphragIntegration.designWorkflow({
          description,
          complexity,
          includeErrorHandling,
          includeValidation: requirements.includeValidation
        });
        
        if (graphragDesign.nodes.length > 0) {
          return {
            nodes: graphragDesign.nodes,
            connections: graphragDesign.connections,
            metadata: {
              ...graphragDesign.metadata,
              designRationale: `AI-designed workflow using GraphRAG: ${description}`,
              estimatedDuration: this.estimateExecutionTime(graphragDesign.nodes),
              requiredNodeTypes: [...new Set(graphragDesign.nodes.map(n => n.type))]
            }
          };
        }
      } catch (error) {
        console.warn('⚠️ GraphRAG design failed, falling back to template search:', error);
      }
    }
    
    // Fallback to template-based approach
    console.log('📝 Using template search for workflow design');
    
    // Extract key tasks from description
    const tasks = this.extractTasks(description);
    
    // Identify workflow pattern
    const pattern = this.identifyPattern(description);
    
    // Generate nodes based on tasks
    const nodes = await this.generateNodes(tasks, complexity);
    
    // Add system nodes if needed
    if (includeErrorHandling) {
      nodes.push(this.createErrorHandlerNode(nodes.length));
    }
    
    if (requirements.includeValidation) {
      // Insert validation nodes after input nodes
      const validationNodes = this.createValidationNodes(nodes);
      nodes.push(...validationNodes);
    }
    
    if (requirements.includeLogging) {
      nodes.push(this.createLoggingNode(nodes.length));
    }
    
    // Generate connections
    const connections = this.generateConnections(nodes, pattern);
    
    return {
      nodes,
      connections,
      metadata: {
        designRationale: `Workflow designed for: ${description}. Pattern: ${pattern}. Complexity: ${complexity}.`,
        estimatedDuration: this.estimateExecutionTime(nodes),
        requiredNodeTypes: [...new Set(nodes.map(n => n.type))]
      }
    };
  }

  /**
   * Extract tasks from natural language description
   */
  private extractTasks(description: string): string[] {
    const tasks: string[] = [];
    const lowerDesc = description.toLowerCase();
    
    // Common task patterns
    const taskPatterns = [
      /fetch(?:es|ing)?\s+(\w+)/g,
      /read(?:s|ing)?\s+(\w+)/g,
      /process(?:es|ing)?\s+(\w+)/g,
      /transform(?:s|ing)?\s+(\w+)/g,
      /validate(?:s|ing)?\s+(\w+)/g,
      /store(?:s|ing)?\s+(?:in|to)?\s+(\w+)/g,
      /save(?:s|ing)?\s+(?:to)?\s+(\w+)/g,
      /send(?:s|ing)?\s+(?:to)?\s+(\w+)/g,
      /check(?:s|ing)?\s+(\w+)/g,
      /monitor(?:s|ing)?\s+(\w+)/g
    ];
    
    for (const pattern of taskPatterns) {
      const matches = lowerDesc.matchAll(pattern);
      for (const match of matches) {
        tasks.push(match[0]);
      }
    }
    
    // If no specific tasks found, use generic pattern
    if (tasks.length === 0) {
      if (lowerDesc.includes('etl') || lowerDesc.includes('pipeline')) {
        tasks.push('extract', 'transform', 'load');
      } else if (lowerDesc.includes('api')) {
        tasks.push('receive', 'process', 'respond');
      } else {
        tasks.push('input', 'process', 'output');
      }
    }
    
    return tasks;
  }

  /**
   * Identify workflow pattern from description
   */
  private identifyPattern(description: string): string {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('etl') || lowerDesc.includes('extract')) {
      return 'etl';
    } else if (lowerDesc.includes('api') || lowerDesc.includes('endpoint')) {
      return 'api';
    } else if (lowerDesc.includes('monitor') || lowerDesc.includes('alert')) {
      return 'monitoring';
    } else if (lowerDesc.includes('integrate') || lowerDesc.includes('sync')) {
      return 'integration';
    }
    
    return 'processing';
  }

  /**
   * Generate nodes based on tasks
   */
  private async generateNodes(tasks: string[], complexity: string): Promise<NodeDefinition[]> {
    const nodes: NodeDefinition[] = [];
    let yPosition = 100;
    const xSpacing = 250;
    
    for (let index = 0; index < tasks.length; index++) {
      const task = tasks[index];
      const nodeType = await this.getNodeTypeForTask(task);
      const node: NodeDefinition = {
        id: `node_${index + 1}`,
        type: nodeType,
        position: {
          x: 100 + (index * xSpacing),
          y: yPosition
        },
        config: this.getDefaultConfigForNodeType(nodeType),
        metadata: {
          task: task,
          autoGenerated: true
        }
      };
      
      nodes.push(node);
      
      // Add complexity variations
      if (complexity === 'complex' && index % 2 === 0) {
        // Add parallel branches for complex workflows
        const parallelNode: NodeDefinition = {
          id: `node_${index + 1}_parallel`,
          type: nodeType,
          position: {
            x: 100 + (index * xSpacing),
            y: yPosition + 150
          },
          config: this.getDefaultConfigForNodeType(nodeType),
          metadata: {
            task: task,
            autoGenerated: true,
            parallel: true
          }
        };
        nodes.push(parallelNode);
      }
    }
    
    return nodes;
  }

  /**
   * Get node type for a task using template search
   */
  private async getNodeTypeForTask(task: string): Promise<string> {
    const taskLower = task.toLowerCase();
    
    // Check cache first
    const cacheKey = `task:${taskLower}`;
    if (this.templateCache.has(cacheKey) && 
        Date.now() - this.lastCacheTime < this.cacheTimeout) {
      const cached = this.templateCache.get(cacheKey);
      if (cached && cached.length > 0) {
        return cached[0].type || cached[0].id || 'generic_processor';
      }
    }
    
    try {
      // Search for templates matching the task
      const templates = await this.zipBridge.searchTemplates({
        query: task,
        limit: 5
      });
      
      // Cache the results
      this.templateCache.set(cacheKey, templates);
      this.lastCacheTime = Date.now();
      
      if (templates && templates.length > 0) {
        // Use the best matching template
        return templates[0].type || templates[0].id || 'generic_processor';
      }
    } catch (error) {
      console.error(`Error searching templates for task '${task}':`, error);
    }
    
    // Fallback to generic patterns if search fails
    if (taskLower.includes('fetch') || taskLower.includes('read') || taskLower.includes('get')) {
      return 'data_source';
    } else if (taskLower.includes('transform') || taskLower.includes('process') || taskLower.includes('convert')) {
      return 'data_transform';
    } else if (taskLower.includes('save') || taskLower.includes('store') || taskLower.includes('write')) {
      return 'data_sink';
    } else if (taskLower.includes('validate') || taskLower.includes('check') || taskLower.includes('verify')) {
      return 'data_validator';
    } else if (taskLower.includes('if') || taskLower.includes('condition') || taskLower.includes('when')) {
      return 'condition';
    }
    
    return 'generic_processor';
  }

  /**
   * Get default configuration for node type
   */
  private getDefaultConfigForNodeType(nodeType: string): Record<string, any> {
    const configs: Record<string, any> = {
      'http_request': {
        method: 'GET',
        headers: {},
        timeout: 30000
      },
      'database_query': {
        query: 'SELECT * FROM table',
        timeout: 30000
      },
      'data_transform': {
        transformation: 'passthrough',
        rules: []
      },
      'condition': {
        expression: 'true',
        operator: 'equals'
      },
      'data_validator': {
        schema: {},
        strict: false
      },
      'file_reader': {
        encoding: 'utf8',
        format: 'json'
      },
      'file_writer': {
        encoding: 'utf8',
        format: 'json',
        append: false
      }
    };
    
    return configs[nodeType] || {};
  }

  /**
   * Generate connections between nodes
   */
  private generateConnections(nodes: NodeDefinition[], pattern: string): ConnectionDefinition[] {
    const connections: ConnectionDefinition[] = [];
    
    // Sequential connections for main flow
    const mainNodes = nodes.filter(n => !n.metadata?.parallel);
    for (let i = 0; i < mainNodes.length - 1; i++) {
      connections.push({
        sourceNodeId: mainNodes[i].id!,
        sourcePort: 'output',
        targetNodeId: mainNodes[i + 1].id!,
        targetPort: 'input'
      });
    }
    
    // Connect parallel nodes
    const parallelNodes = nodes.filter(n => n.metadata?.parallel);
    for (const parallelNode of parallelNodes) {
      const baseNodeId = parallelNode.id!.replace('_parallel', '');
      const baseNode = nodes.find(n => n.id === baseNodeId);
      
      if (baseNode) {
        // Find previous and next nodes
        const baseIndex = mainNodes.indexOf(baseNode);
        
        if (baseIndex > 0) {
          // Connect from previous node
          connections.push({
            sourceNodeId: mainNodes[baseIndex - 1].id!,
            sourcePort: 'output',
            targetNodeId: parallelNode.id!,
            targetPort: 'input'
          });
        }
        
        if (baseIndex < mainNodes.length - 1) {
          // Connect to next node
          connections.push({
            sourceNodeId: parallelNode.id!,
            sourcePort: 'output',
            targetNodeId: mainNodes[baseIndex + 1].id!,
            targetPort: 'input'
          });
        }
      }
    }
    
    // Add error handler connections if present
    const errorHandler = nodes.find(n => n.type === 'error_handler');
    if (errorHandler) {
      // Connect all processing nodes to error handler
      for (const node of nodes) {
        if (node.id !== errorHandler.id && !node.type.includes('trigger')) {
          connections.push({
            sourceNodeId: node.id!,
            sourcePort: 'error',
            targetNodeId: errorHandler.id!,
            targetPort: 'input'
          });
        }
      }
    }
    
    return connections;
  }

  /**
   * Create error handler node
   */
  private createErrorHandlerNode(index: number): NodeDefinition {
    return {
      id: `error_handler`,
      type: 'error_handler',
      position: {
        x: 100,
        y: 400
      },
      config: {
        retryAttempts: 3,
        retryDelay: 1000,
        fallbackAction: 'log'
      },
      metadata: {
        autoGenerated: true,
        purpose: 'error_handling'
      }
    };
  }

  /**
   * Create validation nodes
   */
  private createValidationNodes(existingNodes: NodeDefinition[]): NodeDefinition[] {
    const validationNodes: NodeDefinition[] = [];
    let validationIndex = 0;
    
    for (const node of existingNodes) {
      if (node.type.includes('input') || node.type.includes('source')) {
        validationNodes.push({
          id: `validator_${validationIndex++}`,
          type: 'data_validator',
          position: {
            x: node.position.x + 125,
            y: node.position.y
          },
          config: {
            schema: {},
            strict: true
          },
          metadata: {
            autoGenerated: true,
            validatesNode: node.id
          }
        });
      }
    }
    
    return validationNodes;
  }

  /**
   * Create logging node
   */
  private createLoggingNode(index: number): NodeDefinition {
    return {
      id: `logger`,
      type: 'logger',
      position: {
        x: 100,
        y: 500
      },
      config: {
        level: 'info',
        includeTimestamp: true,
        includeNodeId: true
      },
      metadata: {
        autoGenerated: true,
        purpose: 'logging'
      }
    };
  }

  /**
   * Estimate execution time based on nodes
   */
  private estimateExecutionTime(nodes: NodeDefinition[]): number {
    const nodeTimings: Record<string, number> = {
      'http_request': 2000,
      'database_query': 1000,
      'data_transform': 500,
      'file_reader': 1000,
      'file_writer': 1000,
      'condition': 100,
      'data_validator': 200,
      'generic_processor': 500
    };
    
    let totalTime = 0;
    for (const node of nodes) {
      totalTime += nodeTimings[node.type] || 500;
    }
    
    return totalTime;
  }
}