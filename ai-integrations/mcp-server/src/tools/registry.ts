/**
 * Tool Registry for MCP Server
 * Defines all available tools with their schemas
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ZIPBridge } from '../../../shared/zip-bridge';
import { z } from 'zod';
import { WorkflowDesigner } from '../ai/workflow-designer';
import { WorkflowOptimizer } from '../ai/workflow-optimizer';
import { GraphRAGIntegration } from '../ai/graphrag-integration';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private executors: Map<string, (args: any) => Promise<any>> = new Map();
  private workflowDesigner: WorkflowDesigner | null = null;
  private workflowOptimizer: WorkflowOptimizer | null = null;
  private graphragIntegration: GraphRAGIntegration | null = null;

  constructor(
    private zipBridge: ZIPBridge,
    private llm?: any,
    private embeddings?: any
  ) {
    this.initializeAIModules();
    this.registerAllTools();
  }

  private initializeAIModules() {
    if (this.llm) {
      this.workflowDesigner = new WorkflowDesigner(this.zipBridge, this.llm, this.embeddings);
      this.workflowOptimizer = new WorkflowOptimizer(this.zipBridge, this.llm, this.embeddings);
      this.graphragIntegration = new GraphRAGIntegration(this.zipBridge, this.llm, this.embeddings);
    }
  }

  private registerAllTools() {
    // Workflow Management Tools
    this.registerTool({
      name: 'workflow_create',
      description: 'Create a new workflow with optional AI-assisted design',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the workflow'
          },
          description: {
            type: 'string',
            description: 'Description of the workflow'
          },
          requirements: {
            type: 'string',
            description: 'Natural language requirements for the workflow'
          },
          auto_design: {
            type: 'boolean',
            description: 'Let AI design the initial workflow structure',
            default: false
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorization'
          }
        },
        required: ['name']
      }
    }, async (args) => {
      const workflow = await this.zipBridge.createWorkflow({
        name: args.name,
        description: args.description || args.requirements,
        tags: args.tags,
        metadata: {
          requirements: args.requirements,
          auto_designed: args.auto_design
        }
      });

      if (args.auto_design && args.requirements && this.workflowDesigner) {
        // Use AI-based workflow design with GraphRAG
        const design = await this.workflowDesigner.designWorkflow({
          description: args.requirements,
          complexity: 'moderate',
          includeErrorHandling: true
        });
        
        // Add nodes and connections to the workflow
        for (const node of design.nodes) {
          await this.zipBridge.addNode(workflow.id, node);
        }
        
        for (const connection of design.connections) {
          await this.zipBridge.connectNodes(workflow.id, connection);
        }
        
        workflow.metadata = {
          ...workflow.metadata,
          ...design.metadata
        };
      }

      return workflow;
    });

    this.registerTool({
      name: 'workflow_optimize',
      description: 'Analyze and optimize workflow performance',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow to optimize'
          },
          optimization_goals: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['speed', 'reliability', 'cost', 'simplicity']
            },
            description: 'Goals for optimization'
          },
          apply_changes: {
            type: 'boolean',
            description: 'Automatically apply suggested optimizations',
            default: false
          }
        },
        required: ['workflow_id']
      }
    }, async (args) => {
      const workflow = await this.zipBridge.getWorkflow(args.workflow_id);
      const analytics = await this.zipBridge.getAnalytics(args.workflow_id);
      
      const suggestions = [];
      
      // Analyze for speed optimization
      if (args.optimization_goals?.includes('speed')) {
        // Find slow nodes
        for (const [nodeId, metrics] of Object.entries(analytics.nodeMetrics)) {
          if (metrics.averageDuration > 5000) {
            suggestions.push({
              type: 'performance',
              node: nodeId,
              issue: 'Slow execution',
              suggestion: 'Consider parallel execution or caching',
              impact: 'high'
            });
          }
        }
      }
      
      // Analyze for reliability
      if (args.optimization_goals?.includes('reliability')) {
        for (const [nodeId, metrics] of Object.entries(analytics.nodeMetrics)) {
          if (metrics.errorRate > 0.1) {
            suggestions.push({
              type: 'reliability',
              node: nodeId,
              issue: 'High error rate',
              suggestion: 'Add error handling or retry logic',
              impact: 'high'
            });
          }
        }
      }
      
      // Apply changes if requested
      if (args.apply_changes && suggestions.length > 0 && this.workflowOptimizer) {
        // Apply automatic optimizations
        const result = await this.workflowOptimizer.applyOptimizations(
          args.workflow_id,
          suggestions
        );
        
        return {
          workflow_id: args.workflow_id,
          current_metrics: analytics,
          suggestions,
          optimization_potential: suggestions.length > 0 ? 'high' : 'low',
          applied: result.applied,
          changes: result.changes
        };
      }
      
      return {
        workflow_id: args.workflow_id,
        current_metrics: analytics,
        suggestions,
        optimization_potential: suggestions.length > 0 ? 'high' : 'low'
      };
    });

    this.registerTool({
      name: 'workflow_from_description',
      description: 'Create a complete workflow from natural language description',
      inputSchema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'Natural language description of what the workflow should do'
          },
          complexity: {
            type: 'string',
            enum: ['simple', 'moderate', 'complex'],
            description: 'Desired complexity level',
            default: 'moderate'
          },
          include_error_handling: {
            type: 'boolean',
            description: 'Include error handling nodes',
            default: true
          }
        },
        required: ['description']
      }
    }, async (args) => {
      // Create base workflow
      const workflow = await this.zipBridge.createWorkflow({
        name: `Generated: ${args.description.substring(0, 50)}`,
        description: args.description,
        metadata: {
          generated: true,
          complexity: args.complexity
        }
      });

      // Implement NLP-based workflow generation with GraphRAG
      if (this.workflowDesigner) {
        const design = await this.workflowDesigner.designWorkflow({
          description: args.description,
          complexity: args.complexity,
          includeErrorHandling: args.include_error_handling,
          includeValidation: false,
          includeLogging: false
        });
        
        // Add nodes to the workflow
        for (const node of design.nodes) {
          await this.zipBridge.addNode(workflow.id, node);
        }
        
        // Add connections
        for (const connection of design.connections) {
          await this.zipBridge.connectNodes(workflow.id, connection);
        }
        
        return {
          workflow_id: workflow.id,
          message: 'Workflow structure created based on description',
          nodes_added: design.nodes.length,
          connections_added: design.connections.length,
          metadata: design.metadata
        };
      }

      return {
        workflow_id: workflow.id,
        message: 'Workflow structure created based on description',
        nodes_added: 0, // Will be updated when implemented
        connections_added: 0
      };
    });

    // Node Operations Tools
    this.registerTool({
      name: 'node_suggest',
      description: 'Suggest the best node type for a specific task',
      inputSchema: {
        type: 'object',
        properties: {
          task_description: {
            type: 'string',
            description: 'Description of what the node should do'
          },
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow (for context)'
          },
          connected_nodes: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of nodes this will connect to'
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of suggestions',
            default: 5
          }
        },
        required: ['task_description']
      }
    }, async (args) => {
      // Search for matching templates
      const templates = await this.zipBridge.searchTemplates({
        query: args.task_description,
        limit: args.limit || 5
      });

      // Analyze context if workflow provided
      let contextScore = {};
      if (args.workflow_id) {
        const workflow = await this.zipBridge.getWorkflow(args.workflow_id);
        // Analyze workflow context with GraphRAG to improve suggestions
      if (this.graphragIntegration && this.graphragIntegration.isAvailable()) {
        const contextualSuggestions = await this.graphragIntegration.suggestNodeImprovements(args.workflow_id);
        
        // Merge with template search results
        templates.forEach((template, index) => {
          const contextual = contextualSuggestions.find(s => s.suggested === template.id);
          if (contextual) {
            templates[index] = {
              ...template,
              confidence: Math.max(0.8, contextual.confidence || 0.5),
              reasoning: contextual.reason
            };
          }
        });
      }
      }

      return {
        suggestions: templates.map(t => ({
          template_id: t.id,
          name: t.name,
          description: t.description,
          confidence: 0.8, // TODO: Calculate actual confidence
          reasoning: `Matches task: ${args.task_description}`
        })),
        task: args.task_description
      };
    });

    // Execution Tools
    this.registerTool({
      name: 'debug_execution',
      description: 'Debug a failed workflow execution with AI assistance',
      inputSchema: {
        type: 'object',
        properties: {
          execution_id: {
            type: 'string',
            description: 'ID of the failed execution'
          },
          include_suggestions: {
            type: 'boolean',
            description: 'Include fix suggestions',
            default: true
          },
          auto_fix: {
            type: 'boolean',
            description: 'Attempt to automatically fix issues',
            default: false
          }
        },
        required: ['execution_id']
      }
    }, async (args) => {
      const status = await this.zipBridge.getExecutionStatus(args.execution_id);
      
      if (status.status !== 'failed') {
        return {
          execution_id: args.execution_id,
          status: status.status,
          message: 'Execution did not fail'
        };
      }

      const traces = await this.zipBridge.getFlowTraces({
        sessionId: args.execution_id,
        status: 'failed'
      });

      const issues = [];
      const suggestions = [];

      // Analyze failure traces
      for (const trace of traces) {
        if (trace.errorMessage) {
          issues.push({
            node: trace.targetNodeId,
            error: trace.errorMessage,
            timestamp: trace.timestamp
          });

          if (args.include_suggestions) {
            // Generate suggestions based on error type
            if (trace.errorMessage.includes('timeout')) {
              suggestions.push({
                node: trace.targetNodeId,
                suggestion: 'Increase timeout or optimize node performance',
                type: 'configuration'
              });
            } else if (trace.errorMessage.includes('connection')) {
              suggestions.push({
                node: trace.targetNodeId,
                suggestion: 'Check network connectivity and API endpoints',
                type: 'connectivity'
              });
            }
            // Add more error pattern matching
          }
        }
      }

      return {
        execution_id: args.execution_id,
        failure_reason: status.error,
        issues,
        suggestions,
        can_retry: suggestions.some(s => s.type === 'configuration')
      };
    });

    this.registerTool({
      name: 'generate_test_data',
      description: 'Generate test data for workflow testing',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow'
          },
          test_scenarios: {
            type: 'integer',
            description: 'Number of test scenarios to generate',
            default: 5
          },
          include_edge_cases: {
            type: 'boolean',
            description: 'Include edge cases',
            default: true
          }
        },
        required: ['workflow_id']
      }
    }, async (args) => {
      const workflow = await this.zipBridge.getWorkflow(args.workflow_id);
      
      // Analyze workflow input requirements using GraphRAG
      if (this.graphragIntegration && this.graphragIntegration.isAvailable()) {
        const analysis = await this.graphragIntegration.analyzeForOptimization(args.workflow_id);
        
        // Generate test data based on missing capabilities
        if (analysis.missingCapabilities.length > 0) {
          testData.push({
            scenario: 'Missing Capability Test',
            input: {
              testFor: analysis.missingCapabilities.map(m => m.capability)
            },
            expected_behavior: 'Should handle missing capabilities gracefully'
          });
        }
      }
      
      const testData = [];
      for (let i = 0; i < args.test_scenarios; i++) {
        testData.push({
          scenario: `Test Scenario ${i + 1}`,
          input: {
            // Generated based on workflow requirements
            sample: 'data',
            index: i
          },
          expected_behavior: 'Workflow completes successfully'
        });
      }

      if (args.include_edge_cases) {
        testData.push({
          scenario: 'Empty Input',
          input: {},
          expected_behavior: 'Graceful handling of empty input'
        });
        testData.push({
          scenario: 'Large Dataset',
          input: { size: 'large', items: 10000 },
          expected_behavior: 'Performance within acceptable limits'
        });
      }

      return {
        workflow_id: args.workflow_id,
        test_data: testData,
        scenarios_generated: testData.length
      };
    });

    // Analysis Tools
    this.registerTool({
      name: 'explain_workflow',
      description: 'Explain what a workflow does in simple terms',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'string',
            description: 'ID of the workflow to explain'
          },
          detail_level: {
            type: 'string',
            enum: ['simple', 'detailed', 'technical'],
            description: 'Level of detail',
            default: 'simple'
          }
        },
        required: ['workflow_id']
      }
    }, async (args) => {
      const workflow = await this.zipBridge.getWorkflow(args.workflow_id);
      
      // Implement workflow analysis and explanation generation
      if (this.graphragIntegration && this.graphragIntegration.isAvailable()) {
        const analysis = await this.graphragIntegration.analyzeForOptimization(args.workflow_id);
        
        if (args.detail_level === 'technical') {
          explanation += `\n\nTechnical Analysis:\n`;
          explanation += `- Redundancies found: ${analysis.redundancies.length}\n`;
          explanation += `- Missing capabilities: ${analysis.missingCapabilities.map(m => m.capability).join(', ')}\n`;
          explanation += `- Optimization potential: ${analysis.redundancies.length > 0 || analysis.missingCapabilities.length > 0 ? 'Yes' : 'No'}`;
        }
      }
      
      let explanation = `Workflow "${workflow.name}" `;
      
      if (args.detail_level === 'simple') {
        explanation += `processes data through a series of connected steps. `;
        explanation += workflow.description || 'It automates a specific task.';
      } else if (args.detail_level === 'detailed') {
        explanation += `consists of ${workflow.graph?.nodes?.length || 0} nodes `;
        explanation += `connected by ${workflow.graph?.connections?.length || 0} connections. `;
        explanation += `Each node performs a specific operation, and data flows between them.`;
      } else {
        explanation += `implements a directed acyclic graph (DAG) with `;
        explanation += `${workflow.graph?.nodes?.length || 0} processing nodes. `;
        explanation += `Data transformation and routing logic is defined by the connection topology.`;
      }

      return {
        workflow_id: args.workflow_id,
        name: workflow.name,
        explanation,
        node_count: workflow.graph?.nodes?.length || 0,
        connection_count: workflow.graph?.connections?.length || 0
      };
    });

    this.registerTool({
      name: 'compare_workflows',
      description: 'Compare two workflows and suggest improvements',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_a: {
            type: 'string',
            description: 'First workflow ID'
          },
          workflow_b: {
            type: 'string',
            description: 'Second workflow ID'
          },
          comparison_aspects: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['structure', 'performance', 'complexity', 'reliability']
            },
            description: 'Aspects to compare'
          }
        },
        required: ['workflow_a', 'workflow_b']
      }
    }, async (args) => {
      const [workflowA, workflowB] = await Promise.all([
        this.zipBridge.getWorkflow(args.workflow_a),
        this.zipBridge.getWorkflow(args.workflow_b)
      ]);

      const [analyticsA, analyticsB] = await Promise.all([
        this.zipBridge.getAnalytics(args.workflow_a),
        this.zipBridge.getAnalytics(args.workflow_b)
      ]);

      const comparison = {
        workflow_a: {
          id: workflowA.id,
          name: workflowA.name,
          nodes: workflowA.graph?.nodes?.length || 0,
          connections: workflowA.graph?.connections?.length || 0,
          success_rate: analyticsA.successRate,
          avg_duration: analyticsA.averageDuration
        },
        workflow_b: {
          id: workflowB.id,
          name: workflowB.name,
          nodes: workflowB.graph?.nodes?.length || 0,
          connections: workflowB.graph?.connections?.length || 0,
          success_rate: analyticsB.successRate,
          avg_duration: analyticsB.averageDuration
        },
        differences: [],
        recommendations: []
      };

      // Compare structure
      if (comparison.workflow_a.nodes > comparison.workflow_b.nodes * 1.5) {
        comparison.differences.push('Workflow A is significantly more complex');
        comparison.recommendations.push('Consider simplifying Workflow A');
      }

      // Compare performance
      if (comparison.workflow_a.avg_duration > comparison.workflow_b.avg_duration * 1.5) {
        comparison.differences.push('Workflow A is slower');
        comparison.recommendations.push('Optimize Workflow A for better performance');
      }

      // Compare reliability
      if (comparison.workflow_a.success_rate < comparison.workflow_b.success_rate - 0.1) {
        comparison.differences.push('Workflow A is less reliable');
        comparison.recommendations.push('Improve error handling in Workflow A');
      }

      return comparison;
    });
  }

  private registerTool(
    definition: Tool,
    executor: (args: any) => Promise<any>
  ) {
    this.tools.set(definition.name, definition);
    this.executors.set(definition.name, executor);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  async executeTool(name: string, args: any): Promise<any> {
    const executor = this.executors.get(name);
    if (!executor) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    return await executor(args);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}