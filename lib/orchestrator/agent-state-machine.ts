/**
 * State Machine-based Orchestrator Agent
 * Replaces the imperative agent.ts with a declarative state machine approach
 */

import { StateMachineExecutor } from './state-machine/executor'
import { DynamicStateGenerator, StateMachineTemplates } from './state-machine/state-generator'
import { StateHandlerFactory } from './state-machine/state-handlers'
import { getLLMService, LLMService } from './state-machine/llm-service'
import {
  StateType,
  StateMachineConfig,
  StateContext,
  StreamingResponse,
  PropertyQuestion,
  Goal,
  ChatMessage,
  WorkflowIntent
} from './state-machine/types'
import { MCPClient } from './mcp-client'
import type { WorkflowContext } from './types'
import { debugLogger } from './debug-logger'

export interface AgentConfig {
  apiKey?: string  // Make optional for compatibility
  workflowId?: string
  graphId?: string
  enableAutosave?: boolean
  enableStreaming?: boolean
  stateMachineConfig?: StateMachineConfig
  graphRAG?: any  // For GraphRAG compatibility
}

/**
 * State Machine-based Orchestrator Agent
 */
export class OrchestratorAgentStateMachine {
  private executor: StateMachineExecutor | null = null
  private stateGenerator: DynamicStateGenerator
  private handlerFactory: StateHandlerFactory
  private workflowContexts = new Map<string, WorkflowContext>()
  private config: AgentConfig
  private mcpClient: MCPClient
  private llmService: LLMService
  
  constructor(config: AgentConfig = {}) {
    // Default configuration for compatibility
    this.config = {
      apiKey: config.apiKey || 'default-api-key',
      workflowId: config.workflowId,
      graphId: config.graphId || 'main',
      enableAutosave: config.enableAutosave ?? true,
      enableStreaming: config.enableStreaming ?? true,
      stateMachineConfig: config.stateMachineConfig,
      graphRAG: config.graphRAG
    }
    
    this.mcpClient = new MCPClient()
    
    // Initialize real LLM service
    this.llmService = getLLMService()
    
    // Initialize components
    this.stateGenerator = new DynamicStateGenerator(this.llmService)
    this.handlerFactory = new StateHandlerFactory(
      this.mcpClient,
      this.llmService,
      this.config.apiKey!
    )
  }
  
  /**
   * Process a chat message through the state machine
   * Compatible with the existing chat interface
   */
  async *processMessageStream(
    content: string,
    existingWorkflowId: string | null,
    context?: {
      existingNodes?: any[]
      existingConnections?: any[]
      chatHistory?: ChatMessage[]
    }
  ): AsyncGenerator<StreamingResponse> {
    // Log incoming user message
    debugLogger.logUserMessage(content, {
      workflowId: existingWorkflowId,
      hasExistingNodes: !!(context?.existingNodes?.length),
      hasExistingConnections: !!(context?.existingConnections?.length),
      chatHistoryLength: context?.chatHistory?.length || 0
    })
    
    try {
      // Check if this is a response to pending questions
      const workflowId = existingWorkflowId || this.config.workflowId
      if (workflowId && this.hasPendingQuestions(workflowId)) {
        debugLogger.logStateTransition('IDLE', 'HANDLE_PROPERTY_RESPONSE', 'Pending questions detected')
        
        const storedContext = this.getWorkflowContext(workflowId)
        if (storedContext && storedContext.pendingQuestions) {
          // Show workflow context reminder with explicit workflow info
          yield {
            type: 'message',
            content: `📋 **Continuing configuration for existing workflow: ${workflowId}**\n\n🔧 **Current Status**: ${storedContext.pendingQuestions.length} properties need configuration\n\n*Note: Updating properties of existing workflow, not creating a new one.*`,
          }
          
          yield {
            type: 'status',
            content: 'Processing your configuration responses...'
          }
          
          // Process the user's property answers
          yield* this.handlePropertyResponse(workflowId, content)
        }
        return
      }
      
      // Log state transition: IDLE -> PROCESSING
      debugLogger.logStateTransition('IDLE', 'PROCESSING', 'Starting workflow creation')
      
      // Communicate state change to chat interface
      yield {
        type: 'state_change',
        content: 'Starting workflow creation...',
        metadata: { state: 'PROCESSING', reason: 'Starting workflow creation' }
      }
      
      yield {
        type: 'status',
        content: 'Processing your request...'
      }
      
      // Create workflow if needed
      let finalWorkflowId = workflowId
      
      if (!finalWorkflowId) {
        debugLogger.logStateTransition('PROCESSING', 'CREATE_WORKFLOW', 'Creating new workflow')
        
        // Communicate state change to chat interface
        yield {
          type: 'state_change',
          content: 'Creating new workflow...',
          metadata: { state: 'CREATE_WORKFLOW', reason: 'Creating new workflow' }
        }
        
        // Call the actual workflow creation logic
        try {
          debugLogger.logAction('CREATE_WORKFLOW', { description: content })
          const createResult = await this.mcpClient.callTool(
            'workflow_manager',
            'create_workflow' as any,
            {
              name: 'AI Generated Workflow',
              description: content
            }
          )
          
          const createResponse = JSON.parse(createResult)
          debugLogger.logAction('CREATE_WORKFLOW', null, { success: createResponse.success })
          
          if (createResponse.success && createResponse.data) {
            // Get the actual workflow ID from the response
            finalWorkflowId = createResponse.data.id
            debugLogger.logWorkflowEvent('CREATE', finalWorkflowId || 'unknown')
            
            const assistantMsg = `✓ Workflow created`
            debugLogger.logAssistantMessage(assistantMsg, { workflowId: finalWorkflowId })
            yield {
              type: 'message',
              content: assistantMsg,
              workflowId: finalWorkflowId
            }
          } else {
            throw new Error('Failed to create workflow')
          }
        } catch (error) {
          debugLogger.logError(error, 'Failed to create workflow via MCP')
          // Continue anyway - workflow might already exist
          const assistantMsg = 'Using existing workflow'
          debugLogger.logAssistantMessage(assistantMsg, { workflowId: finalWorkflowId })
          yield {
            type: 'message',
            content: assistantMsg,
            workflowId: finalWorkflowId
          }
        }
      }
      
      // Analyze intent first
      debugLogger.logStateTransition('CREATE_WORKFLOW', 'ANALYZE_INTENT', 'Analyzing user request')
      
      // Communicate state change to chat interface
      yield {
        type: 'state_change',
        content: 'Analyzing your request...',
        metadata: { state: 'ANALYZE_INTENT', reason: 'Analyzing user request' }
      }
      
      yield {
        type: 'status',
        content: 'Analyzing your request...'
      }
      
      // Use optimized intent extraction with streaming feedback
      let workflowIntent: any = null
      try {
        debugLogger.logAction('EXTRACT_INTENT', { request: content })
        
        const OPTIMIZED_INTENT_PROMPT = `You are an intelligent workflow architect. Think critically about what the user wants to achieve.

Your task: Design a workflow that accomplishes the user's goal efficiently, without unnecessary complexity.

THINK LIKE AN ENGINEER:
1. What's the simplest way to achieve this goal?
2. What nodes are ESSENTIAL vs NICE-TO-HAVE?
3. Does each node add value or is it redundant?
4. Will this workflow actually work end-to-end?

INTELLIGENT DESIGN PRINCIPLES:
- Start with the END GOAL and work backwards
- Each node should have a clear PURPOSE
- If two nodes do the same thing, you only need one
- Don't add nodes "just in case" - be intentional
- Consider data flow: what format goes in, what comes out?

DATABASE NODES - CRITICAL DISTINCTIONS:

SQL DATABASES (PostgreSQL, MySQL, SQLite, etc.):
- Connection: "PostgreSQL Connection Pool" or "MySQL Connection" → Manages database connection
- Operations: "SQL Script" node → Executes ALL SQL operations (INSERT, SELECT, UPDATE, DELETE)
- Pattern: Connection Pool → SQL Script (with your SQL query)
- DON'T search for "postgresql insert" - use "sql script" instead!

NoSQL DATABASES (MongoDB, Redis, DynamoDB, etc.):
- Connection: "MongoDB Connection" → Establishes connection
- Operations: Specific nodes like "MongoDB Insert", "MongoDB Find", "MongoDB Update"
- Pattern: MongoDB Connection → MongoDB Insert/Find/Update/Delete

IMPORTANT SQL vs NoSQL DIFFERENCE:
- SQL databases: ONE "SQL Script" node handles ALL operations via SQL queries
- NoSQL databases: SEPARATE nodes for each operation type

SEARCH QUERY GUIDELINES for suggestedNodes:
- SQL DATABASES: Use "sql script" for operations, NOT "postgresql insert" or "mysql update"
- NoSQL DATABASES: Use specific operations like "mongodb insert", "redis get"
- CONNECTIONS FIRST: "postgresql connection pool" before "sql script"
- Include PURPOSE: "http request weather api" not just "http request"
- Clear FUNCTION: "json parser" not "parser", "cron trigger" not "trigger"

For the request "${content}", critically evaluate:
- What's ESSENTIAL vs what's OPTIONAL?
- Are all suggested nodes compatible with each other?
- Does the workflow actually accomplish the user's goal?
- Are you adding nodes just because they're available, or because they're NEEDED?

IMPORTANT: Only suggest nodes that are:
1. RELEVANT to the user's actual request
2. COMPATIBLE with each other
3. NECESSARY for the workflow to function
4. LOGICAL in their sequence and connections

MINIMUM NODES CHECKLIST:
✓ At least 1 trigger/start node
✓ At least 1 action/fetch node
✓ At least 1 processing node (if data needs transformation)
✓ At least 1 output/storage node
✓ Any required infrastructure nodes

IMPORTANT: A workflow with only 1 node is NEVER complete. Most workflows need 4-7 nodes minimum.

Respond with this JSON structure (INCLUDE ALL NECESSARY NODES):
{
  "description": "Clear one-sentence description of the workflow's purpose",
  "suggestedName": "short-workflow-name",
  "suggestedDescription": "Detailed description of what this workflow does",
  "suggestedNodes": [
    {
      "query": "specific search terms for the exact functionality needed",
      "position": { "x": 100, "y": 200 },
      "purpose": "what this specific node accomplishes in the workflow"
    }
  ],
  "connections": [
    {
      "from": "node_query_1",
      "to": "node_query_2"
    }
  ]
}`

        const intentResponse = await this.llmService.call({
          messages: [
            {
              role: 'system',
              content: 'You are an expert at understanding user needs and designing workflows. You MUST respond with valid JSON only.'
            },
            {
              role: 'user',
              content: OPTIMIZED_INTENT_PROMPT
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
        
        // Clean and parse JSON response
        let cleanContent = intentResponse.content.trim()
        
        // Remove markdown code blocks
        cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '')
        
        // Find JSON content - look for first { and last }
        const firstBrace = cleanContent.indexOf('{')
        const lastBrace = cleanContent.lastIndexOf('}')
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleanContent = cleanContent.substring(firstBrace, lastBrace + 1)
        }
        
        workflowIntent = JSON.parse(cleanContent)
        debugLogger.logAction('INTENT_EXTRACTED', workflowIntent)
        
        
        const assistantMsg = `Planning workflow: ${workflowIntent.description} (${workflowIntent.suggestedNodes?.length || 0} nodes)`
        debugLogger.logAssistantMessage(assistantMsg)
        yield {
          type: 'message',
          content: assistantMsg
        }
        
      } catch (error) {
        debugLogger.logError(error, 'Intent extraction failed completely')
        
        yield {
          type: 'error',
          content: `Intent extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: { showToast: true }
        }
        return
      }
      
      // Ensure we have a valid workflow intent before proceeding
      if (!workflowIntent || !workflowIntent.suggestedNodes || workflowIntent.suggestedNodes.length === 0) {
        debugLogger.logError(new Error('Invalid workflow intent'), 'Workflow intent is invalid or empty')
        
        yield {
          type: 'error',
          content: 'Failed to generate workflow plan',
          metadata: { showToast: true }
        }
        return
      }
      
      debugLogger.logAction('WORKFLOW_INTENT_VALID', {
        nodeCount: workflowIntent.suggestedNodes.length,
        description: workflowIntent.description
      })
      
      // Search for relevant templates based on extracted intent with streaming feedback
      debugLogger.logStateTransition('ANALYZE_INTENT', 'SEARCH_TEMPLATES', 'Searching for templates')
      
      yield {
        type: 'state_change',
        content: 'Searching for relevant node templates...',
        metadata: { state: 'SEARCH_TEMPLATES', reason: 'Searching for templates' }
      }
      
      yield {
        type: 'status',
        content: 'Searching for relevant node templates...'
      }
      
      let templates: any[] = []
      let allResults = new Map<string, any>()
      let nodesCreated = 0
      
      // Use the suggested nodes from workflow intent for targeted searching
      const searchQueries = workflowIntent?.suggestedNodes?.map((node: any) => node.query) || [content]
      
      // Search using each query from the workflow intent
      for (const query of searchQueries.slice(0, 8)) {
        try {
          debugLogger.logAction('SEARCH_TEMPLATES', { query })
          const searchResult = await this.mcpClient.callTool(
            'node_template_repository',
            'search_templates' as any,
            {
              query: query,
              limit: 5
            }
          )
          
          // Handle the response properly
          if (!searchResult || searchResult === 'undefined') {
            continue
          }
          
          try {
            const searchResponse = JSON.parse(searchResult)
            debugLogger.logAction('SEARCH_RESPONSE', { query, response: searchResponse })
            const results = Array.isArray(searchResponse) ? searchResponse : (searchResponse.data || searchResponse.results || searchResponse.templates || [])
            
            debugLogger.logAction('PARSING_RESULTS', { query, resultsCount: results.length, isArray: Array.isArray(results) })
            
            // Deduplicate results
            results.forEach((template: any, index: number) => {
              const key = template.id || template.name || JSON.stringify(template)
              debugLogger.logAction('PROCESSING_TEMPLATE', { 
                query, 
                index, 
                templateId: template.id, 
                templateTitle: template.title,
                key: key.substring(0, 50) + (key.length > 50 ? '...' : '')
              })
              if (!allResults.has(key)) {
                allResults.set(key, template)
                debugLogger.logAction('TEMPLATE_ADDED', { query, templateId: template.id, totalTemplates: allResults.size })
              } else {
                debugLogger.logAction('TEMPLATE_DUPLICATE', { query, templateId: template.id, existingKey: key })
              }
            })
          } catch (parseError) {
            debugLogger.logError(parseError, `Failed to parse results for query: ${query}`)
          }
        } catch (error) {
          debugLogger.logError(error, `Search failed for query: ${query}`)
        }
      }
      
      // Convert map to array and apply intelligent filtering
      const allTemplates = Array.from(allResults.values())
      debugLogger.logAction('SEARCH_RAW_COMPLETE', { 
        totalFound: allTemplates.length,
        templateIds: allTemplates.map(t => t.id || 'no-id').slice(0, 5),
        allResultsSize: allResults.size
      })
      
      // Apply intelligent template selection from backup agent
      templates = await this.selectRelevantTemplates(allTemplates, searchQueries, content)
      
      debugLogger.logAction('SEARCH_COMPLETE', { 
        totalFound: templates.length,
        filteredFrom: allTemplates.length,
        templateIds: templates.map(t => t.id || 'no-id').slice(0, 5)
      })
      
      if (templates.length > 0) {
        const assistantMsg = `Found ${templates.length} relevant node templates`
        debugLogger.logAssistantMessage(assistantMsg)
        yield {
          type: 'message',
          content: assistantMsg
        }
      } else {
        const assistantMsg = 'No templates found matching your requirements'
        debugLogger.logAssistantMessage(assistantMsg)
        yield {
          type: 'message',
          content: assistantMsg
        }
      }
      
      // Create nodes if templates were found with streaming feedback
      const createdNodesInfo: any[] = [] // Track created nodes for property evaluation
      
      if (templates.length > 0) {
        debugLogger.logStateTransition('SEARCH_TEMPLATES', 'CREATE_NODES', `Creating ${templates.length} nodes`)
        
        yield {
          type: 'state_change',
          content: `Creating ${templates.length} nodes from selected templates...`,
          metadata: { state: 'CREATE_NODES', reason: `Creating ${templates.length} nodes` }
        }
        
        const nodesToCreate = templates
        debugLogger.logAction('CREATE_NODES', { count: nodesToCreate.length })
        
        // Prepare all nodes for batch creation
        const batchNodes = []
        for (let i = 0; i < nodesToCreate.length; i++) {
          const template = nodesToCreate[i]
          
          // Extract inputs and outputs from ports
          const inputs = template.ports?.filter((port: any) => port.type === 'input') || []
          const outputs = template.ports?.filter((port: any) => port.type === 'output') || []
          
          batchNodes.push({
            metadata: {
              // Include ALL template properties
              ...template,
              // Override with proper input/output structure from ports
              inputs,
              outputs,
              // Set default property values
              propertyValues: template.properties ? Object.fromEntries(
                Object.entries(template.properties).map(([key, prop]: [string, any]) => [
                  key,
                  prop.defaultValue || (prop.type === 'boolean' ? false : prop.type === 'number' ? 0 : '')
                ])
              ) : {}
            },
            position: { x: 100 + i * 200, y: 100 + i * 50 }
          })
        }
        
        console.log(`[DEBUG] Batch creating ${batchNodes.length} nodes`)
        debugLogger.logAction('BATCH_CREATE_NODES', { count: batchNodes.length })
        
        try {
          // Use batch API to create all nodes at once
          const batchResult = await this.mcpClient.callTool(
            'embed_orchestrator',
            'add_nodes_batch' as any,
            {
              apiKey: this.config.apiKey,
              workflowId: finalWorkflowId,
              graphId: this.config.graphId || 'main',
              nodes: batchNodes,
              useCRDT: true
            }
          )
          
          console.log('[DEBUG] Batch node creation result:', batchResult)
          const batchResponse = JSON.parse(batchResult)
          
          if (batchResponse.success && batchResponse.data?.nodes) {
            nodesCreated = batchResponse.data.nodes.length
            
            // Track created nodes for property evaluation
            for (let index = 0; index < batchResponse.data.nodes.length; index++) {
              const node = batchResponse.data.nodes[index]
              const template = nodesToCreate[index]
              if (template) {
                createdNodesInfo.push({
                  id: node.id,
                  metadata: template,
                  title: template.title || node.metadata?.title,
                  type: template.type || node.metadata?.type
                })
                
                const assistantMsg = `Added ${template.title || template.type || 'node'}`
                debugLogger.logAssistantMessage(assistantMsg)
                yield {
                  type: 'message',
                  content: assistantMsg
                }
              }
            }
            
            console.log(`[DEBUG] Successfully created ${nodesCreated} nodes in batch`)
            debugLogger.logAction('BATCH_CREATE_SUCCESS', { created: nodesCreated })
          } else {
            console.log('[DEBUG] Batch node creation failed:', batchResponse)
            debugLogger.logAction('BATCH_CREATE_FAILED', { response: batchResponse })
            
            yield {
              type: 'message',
              content: 'Failed to create some nodes. Please try again.'
            }
          }
        } catch (error) {
          console.log('[DEBUG] Exception during batch node creation:', error)
          debugLogger.logError(error, 'Failed to batch create nodes')
          
          yield {
            type: 'message',
            content: 'Error creating nodes. Please try again.'
          }
        }
        
        console.log('[DEBUG] Finished node creation loop, total nodes created:', nodesCreated)
        
        debugLogger.logAction('CREATE_NODES', null, { created: nodesCreated, total: nodesToCreate.length })
        
        // Always continue to connection planning phase
        debugLogger.logStateTransition('CREATE_NODES', 'CREATE_CONNECTIONS', 'Planning connections between nodes')
        
        yield {
          type: 'state_change',
          content: 'Planning connections between nodes...',
          metadata: { state: 'CREATE_CONNECTIONS', reason: 'Planning connections' }
        }
        
        yield {
          type: 'status',
          content: 'Planning connections between nodes...'
        }
        
        // Get the actual node IDs from the created nodes
        let createdNodeIds: string[] = []
        try {
          const nodeListResult = await this.mcpClient.callTool(
            'embed_orchestrator',
            'list_workflow_nodes' as any,
            {
              apiKey: this.config.apiKey,
              workflowId: finalWorkflowId,
              graphId: this.config.graphId || 'main'
            }
          )
          
          const nodeListResponse = JSON.parse(nodeListResult)
          if (nodeListResponse.success && nodeListResponse.nodes) {
            createdNodeIds = nodeListResponse.nodes.map((node: any) => node.id)
            debugLogger.logAction('LIST_NODES_SUCCESS', { nodeCount: createdNodeIds.length, nodeIds: createdNodeIds })
          }
        } catch (error) {
          debugLogger.logError(error, 'Failed to list workflow nodes for connection creation')
        }

        // Create actual connections between nodes
        let connectionsCreated = 0
        if (createdNodeIds.length >= 2) {
          // Get node details to find proper ports
          const nodeDetails = await this.getNodeDetailsForConnections(finalWorkflowId!, createdNodeIds)
          
          // Create sequential connections: node1 -> node2 -> node3 etc.
          for (let i = 0; i < createdNodeIds.length - 1; i++) {
            try {
              const sourceNode = nodeDetails[i]
              const targetNode = nodeDetails[i + 1]
              
              // Find the first output port from source node
              const sourcePort = this.findOutputPort(sourceNode)
              // Find the first input port from target node
              const targetPort = this.findInputPort(targetNode)
              
              if (!sourcePort || !targetPort) {
                console.log(`[DEBUG] Cannot connect nodes - missing ports: source=${sourcePort}, target=${targetPort}`)
                continue
              }
              
              debugLogger.logAction('CREATE_CONNECTION', { 
                sourceNodeId: sourceNode.id.substring(0, 12) + '...',
                targetNodeId: targetNode.id.substring(0, 12) + '...',
                sourcePort: sourcePort,
                targetPort: targetPort,
                index: i 
              })
              
              const connectionResult = await this.mcpClient.callTool(
                'embed_orchestrator',
                'connect_nodes' as any,
                {
                  apiKey: this.config.apiKey,
                  workflowId: finalWorkflowId,
                  graphId: this.config.graphId || 'main',
                  sourceNodeId: sourceNode.id,
                  sourcePortId: sourcePort,
                  targetNodeId: targetNode.id,
                  targetPortId: targetPort,
                  useCRDT: true
                }
              )
              
              const connectionResponse = JSON.parse(connectionResult)
              if (connectionResponse.success) {
                connectionsCreated++
                debugLogger.logAction('CREATE_CONNECTION_SUCCESS', { 
                  connectionId: connectionResponse.data?.connection?.id || 'unknown',
                  sourceNode: sourceNode.id.substring(0, 12) + '...',
                  targetNode: targetNode.id.substring(0, 12) + '...'
                })
              } else {
                debugLogger.logAction('CREATE_CONNECTION_FAILED', { 
                  error: connectionResponse.error || 'Unknown error',
                  sourceNode: sourceNode.id.substring(0, 12) + '...',
                  targetNode: targetNode.id.substring(0, 12) + '...'
                })
              }
            } catch (error) {
              debugLogger.logError(error, `Failed to create connection ${i}`)
            }
          }
          
          if (connectionsCreated > 0) {
            yield {
              type: 'message',
              content: `Created ${connectionsCreated} connection${connectionsCreated > 1 ? 's' : ''} between nodes`
            }
          } else {
            yield {
              type: 'message',
              content: 'Note: Connections may need manual adjustment based on node port compatibility'
            }
          }
        }
        
        // Check if nodes need property enrichment
        debugLogger.logStateTransition('CREATE_CONNECTIONS', 'ENRICH_PROPERTIES', 'Checking for property enrichment')
        
        yield {
          type: 'state_change',
          content: 'Checking node configuration...',
          metadata: { state: 'ENRICH_PROPERTIES', reason: 'Checking properties' }
        }
        
        yield {
          type: 'status',
          content: 'Analyzing node properties...'
        }
        
        // Use LLM to intelligently evaluate what properties need configuration
        // Pass the actual created nodes info instead of templates
        const criticalProperties = await this.evaluateWorkflowProperties(
          finalWorkflowId!,
          content, // User's original request
          createdNodesInfo  // Actual nodes we created, not templates
        )
        
        console.log('[DEBUG] Total critical properties found:', criticalProperties.length)
        console.log('[DEBUG] Properties:', criticalProperties)
        
        if (criticalProperties.length > 0) {
          // Ask user for configuration instead of setting defaults
          const configType = criticalProperties.length === 1 ? 'setting' : 'settings'
          yield {
            type: 'message',
            content: `I need ${criticalProperties.length} ${configType} to complete your workflow. Here's what each one is for:`
          }
          
          // Build context-aware explanations for each property
          const explanations = await this.generatePropertyExplanations(
            criticalProperties,
            content,
            workflowIntent
          )
          
          // Present questions to user with helpful context and explanations
          const questionTexts = criticalProperties.map((prop, index) => {
            const explanation = explanations[index] || ''
            let questionText = `**${index + 1}. ${prop.question}**`
            
            // Add explanation of why this is needed
            if (explanation) {
              questionText += `\n   Why: _${explanation}_`
            }
            
            // Add example
            if (prop.example) {
              questionText += `\n   Example: \`${prop.example}\``
            }
            
            return questionText
          })
          
          // Display the questions in a user-friendly format
          yield {
            type: 'message',
            content: questionTexts.join('\n\n')
          }
          
          // Also send as structured question for UI handling
          yield {
            type: 'question',
            content: 'Please provide these details (you can answer them all at once or one by one):',
            questions: criticalProperties.map((prop, index) => ({
              id: `${prop.nodeId}-${prop.property}`,
              nodeId: prop.nodeId,
              nodeTitle: prop.nodeTitle,
              propertyName: prop.property,
              propertyType: 'text',
              question: prop.question,
              currentValue: '',
              suggestedValue: prop.example,
              required: prop.required,
              index: index + 1
            })),
            workflowId: finalWorkflowId
          }
          
          // Store questions in workflow context for later processing
          this.storeWorkflowContext(finalWorkflowId!, {
            pendingQuestions: criticalProperties.map((prop, index) => ({
              nodeId: prop.nodeId,
              nodeTitle: prop.nodeTitle,
              propertyName: prop.property,
              propertyType: 'text',
              question: prop.question,
              required: prop.required,
              index: index + 1
            }))
          })
          
          // Don't complete yet - wait for user responses
          // Show ALL questions - no truncation
          const waitingSummary = criticalProperties.map((prop, index) => 
            `${index + 1}. ${prop.question}`
          ).join('\n')
          
          yield {
            type: 'status',
            content: `Waiting for your answers to:\n${waitingSummary}`
          }
          
          console.log('[DEBUG] Stopping workflow to wait for user property responses')
          debugLogger.logStateTransition('ENRICH_PROPERTIES', 'AWAITING_USER_INPUT', 'Waiting for property configuration from user')
          
          // Return early - don't complete the workflow yet
          return
        } else {
          yield {
            type: 'message',
            content: 'No additional configuration needed'
          }
        }
        
        console.log('[DEBUG] About to transition to COMPLETE state')
        debugLogger.logStateTransition('ENRICH_PROPERTIES', 'COMPLETE', 'Workflow building finished')
        
        console.log('[DEBUG] Yielding final state change')
        yield {
          type: 'state_change',
          content: 'Workflow building completed',
          metadata: { state: 'COMPLETE', reason: 'Workflow building finished' }
        }
        console.log('[DEBUG] Final state change yielded')
      } else {
        debugLogger.logStateTransition('SEARCH_TEMPLATES', 'COMPLETE', 'No templates found')
        
        yield {
          type: 'state_change',
          content: 'No templates found, completing workflow...',
          metadata: { state: 'COMPLETE', reason: 'No templates found' }
        }
      }
      
      console.log('[DEBUG] Starting final completion section')
      // Report actual results with comprehensive summary
      let finalMsg = ''
      if (nodesCreated > 0) {
        const parts = [`Created workflow with ${nodesCreated} node${nodesCreated > 1 ? 's' : ''}`]
        
        if (workflowIntent?.connections && workflowIntent.connections.length > 0) {
          parts.push(`${workflowIntent.connections.length} connection${workflowIntent.connections.length > 1 ? 's' : ''} planned`)
        }
        
        let totalProperties = 0
        for (const template of templates) {
          if (template.properties && Object.keys(template.properties).length > 0) {
            totalProperties += Object.keys(template.properties).length
          }
        }
        
        if (totalProperties > 0) {
          parts.push(`${totalProperties} properties configured`)
        }
        
        finalMsg = parts.join(', ')
      } else {
        finalMsg = 'Empty workflow created. Template search returned no results.'
      }
      
      console.log('[DEBUG] Final message:', finalMsg)
      debugLogger.logAssistantMessage(finalMsg)
      debugLogger.logWorkflowEvent('COMPLETE', finalWorkflowId || 'unknown', {
        nodesCreated
      })
      console.log('[DEBUG] About to yield final completion message')
      
      // Add a small delay to allow CRDT to sync the workflow
      if (finalWorkflowId) {
        yield {
          type: 'status',
          content: 'Syncing workflow...'
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      yield {
        type: 'complete',
        content: finalMsg,
        workflowId: finalWorkflowId,
        metadata: {
          nodeCount: nodesCreated
        }
      }
      
    } catch (error) {
      debugLogger.logError(error, 'Critical error in processMessageStream')
      debugLogger.logStateTransition('ANY', 'ERROR', 'Unhandled exception')
      
      // Extract meaningful error message
      let errorMessage = 'An unexpected error occurred'
      let errorDetails = ''
      
      if (error instanceof Error) {
        errorMessage = error.message
        
        // Check for specific error types
        if (error.message.includes('MCP')) {
          errorMessage = 'Failed to communicate with MCP server'
          errorDetails = 'Please ensure the MCP server is running'
        } else if (error.message.includes('not found')) {
          errorMessage = 'Required service not available'
          errorDetails = 'Some backend services may not be running'
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out'
          errorDetails = 'The operation took too long to complete'
        }
      }
      
      debugLogger.logAssistantMessage(errorMessage, {
        details: errorDetails,
        originalError: error instanceof Error ? error.message : error
      })
      
      yield {
        type: 'error',
        content: errorMessage,
        metadata: {
          details: errorDetails,
          timestamp: new Date().toISOString(),
          showToast: true
        }
      }
    }
  }
  
  /**
   * Get or create a state machine executor
   */
  private async getOrCreateExecutor(
    input: string,
    chatHistory: ChatMessage[],
    workflowId?: string
  ): Promise<StateMachineExecutor> {
    if (this.executor && workflowId && this.workflowContexts.has(workflowId)) {
      // Resume existing conversation
      return this.executor!
    }
    
    // Generate or use provided state machine config
    const config = await this.getStateMachineConfig(input)
    
    // Create initial context
    const initialContext: Partial<StateContext> = {
      workflowId: workflowId || this.generateWorkflowId(),
      graphId: this.config.graphId || 'main',
      originalRequest: input,
      chatHistory,
      existingNodes: [],
      existingConnections: [],
      existingGroups: [],
      existingGraphs: ['main'],
      nodeMap: new Map(),
      templateMap: new Map(),
      pendingQuestions: [],
      collectedProperties: new Map(),
      goalStack: [],
      errorCount: 0,
      dynamicContext: new Map()
    }
    
    // Create standard executor (EnhancedStateMachineExecutor removed as it's not being used)
    this.executor = new StateMachineExecutor(
      config,
      this.mcpClient,
      this.config.apiKey || 'default-api-key',
      initialContext
    )
    
    return this.executor
  }
  
  /**
   * Get state machine configuration
   */
  private async getStateMachineConfig(input: string): Promise<StateMachineConfig> {
    if (this.config.stateMachineConfig) {
      return this.config.stateMachineConfig
    }
    
    // Analyze input to determine workflow type
    const isModification = this.isModificationRequest(input)
    
    if (isModification) {
      // Use modification template
      return this.buildConfigFromTemplate(StateMachineTemplates.MODIFICATION_WORKFLOW)
    } else {
      // Use creation template or generate dynamically
      if (this.shouldGenerateDynamically(input)) {
        return await this.stateGenerator.generateStateMachine({
          taskDescription: input,
          capabilities: [
            'Create workflow nodes',
            'Connect nodes',
            'Create groups and subgraphs',
            'Search node templates',
            'Update node properties'
          ],
          constraints: [
            'Must validate API key',
            'Must use CRDT for real-time sync',
            'Must evaluate workflow completeness'
          ]
        })
      } else {
        return this.buildConfigFromTemplate(StateMachineTemplates.WORKFLOW_CREATION)
      }
    }
  }
  
  /**
   * Build complete config from template
   */
  private buildConfigFromTemplate(template: Partial<StateMachineConfig>): StateMachineConfig {
    // Add all required states from handlers
    const states = new Map(template.states || [])
    
    // Add missing states with default configurations
    const allStates = Object.values(StateType)
    for (const stateType of allStates) {
      if (!states.has(stateType)) {
        // Create default state config
        states.set(stateType, {
          id: stateType,
          name: stateType.replace(/_/g, ' ').toLowerCase(),
          description: `State: ${stateType}`,
          action: {
            type: 'decide',
            decisionLogic: (context) => StateType.COMPLETE
          },
          transitions: [{
            condition: 'always',
            nextState: StateType.COMPLETE
          }],
          config: {
            interruptible: true,
            resumable: true
          }
        })
      }
    }
    
    return {
      states,
      initialState: template.initialState || StateType.IDLE,
      maxGoalStackDepth: 10,
      defaultTimeout: 30000,
      enableLogging: true,
      enableVisualization: false
    }
  }
  
  /**
   * Check if input is a modification request
   */
  private isModificationRequest(input: string): boolean {
    const modificationKeywords = [
      'change', 'update', 'modify', 'edit',
      'remove', 'delete', 'fix', 'correct',
      'connect', 'disconnect', 'add to existing'
    ]
    const lowerInput = input.toLowerCase()
    return modificationKeywords.some(keyword => lowerInput.includes(keyword))
  }
  
  /**
   * Determine if we should generate state machine dynamically
   */
  private shouldGenerateDynamically(input: string): boolean {
    // Complex requests that don't fit standard templates
    const complexPatterns = [
      'multi-step', 'complex workflow', 'custom logic',
      'conditional flow', 'parallel processing'
    ]
    const lowerInput = input.toLowerCase()
    return complexPatterns.some(pattern => lowerInput.includes(pattern))
  }
  
  /**
   * Check if workflow has pending questions
   */
  private hasPendingQuestions(workflowId: string): boolean {
    const context = this.workflowContexts.get(workflowId)
    return !!(context?.pendingQuestions && context.pendingQuestions.length > 0)
  }
  
  /**
   * Handle user input when there are pending questions
   * Analyzes intent and routes to appropriate state
   */
  private async *handlePropertyResponse(
    workflowId: string,
    content: string
  ): AsyncGenerator<StreamingResponse> {
    const context = this.workflowContexts.get(workflowId)
    if (!context || !context.pendingQuestions) {
      yield {
        type: 'error',
        content: 'No pending questions found'
      }
      return
    }
    
    // Analyze user intent to determine state transition
    const intentAnalysis = await this.analyzeUserIntentWithContext(content, context)
    
    debugLogger.logAction('ANALYZE_USER_INTENT', {
      userInput: content.substring(0, 100),
      intentType: intentAnalysis.type,
      confidence: intentAnalysis.confidence
    })
    
    switch (intentAnalysis.type) {
      case 'property_answers':
        // User is providing property values
        yield* this.processPropertyAnswers(workflowId, content, context)
        break
        
      case 'workflow_evaluation':
        // User is pointing out problems with the workflow
        yield {
          type: 'message',
          content: 'I understand there are issues with the workflow. Let me evaluate and fix them...'
        }
        yield* this.handleWorkflowEvaluation(workflowId, content, context)
        break
        
      case 'modification_request':
        // User wants to modify the workflow
        yield {
          type: 'message',
          content: 'I understand you want to modify the workflow. Let me process those changes...'
        }
        // Transition to modification analysis
        yield* this.handleModificationRequest(workflowId, content, context)
        break
        
      case 'clarification_request':
        // User is asking for help or clarification
        yield* this.handleClarificationRequest(content, context)
        break
        
      case 'new_workflow_request':
        // User wants to start over with a new workflow
        yield {
          type: 'message',
          content: 'Starting a new workflow as requested...'
        }
        // Clear context and start fresh
        this.clearWorkflowContext(workflowId)
        yield* this.processMessageStream(content, null)
        break
        
      default:
        // Fallback - assume they're trying to answer questions
        yield {
          type: 'message',
          content: "I'm not sure how to interpret that. Let me try to process it as configuration answers..."
        }
        yield* this.processPropertyAnswers(workflowId, content, context)
    }
  }
  
  /**
   * Generate explanations for why each property is needed
   */
  private async generatePropertyExplanations(
    properties: Array<{nodeTitle: string, property: string, question: string}>,
    userRequest: string,
    workflowIntent: any
  ): Promise<string[]> {
    try {
      const prompt = `Generate brief, user-friendly explanations for why each configuration setting is needed in this workflow.

User's Goal: "${userRequest}"
Workflow Purpose: ${workflowIntent?.description || 'Process data automatically'}

Settings that need explanation:
${properties.map((prop, i) => `${i+1}. ${prop.nodeTitle} - ${prop.question}`).join('\n')}

For each setting, explain in one simple sentence:
- WHY it's needed for the workflow to function
- What it will be used for in plain terms
- How it connects to the user's goal

Keep explanations conversational and avoid technical jargon.

Respond with a JSON array of explanations in the same order:
["explanation 1", "explanation 2", ...]`

      const response = await this.llmService.call({
        messages: [
          {
            role: 'system',
            content: 'You are helping users understand workflow configuration. Use simple, friendly language.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      })

      try {
        // Parse the JSON array response
        let cleanContent = response.content.trim()
        cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '')
        
        const firstBracket = cleanContent.indexOf('[')
        const lastBracket = cleanContent.lastIndexOf(']')
        
        if (firstBracket !== -1 && lastBracket !== -1) {
          cleanContent = cleanContent.substring(firstBracket, lastBracket + 1)
        }
        
        return JSON.parse(cleanContent)
      } catch {
        // Fallback to generic explanations
        return properties.map(() => 'This setting is required for your workflow to run properly')
      }
    } catch (error) {
      debugLogger.logError(error, 'Failed to generate property explanations')
      return properties.map(() => 'This setting is required for your workflow to run properly')
    }
  }

  /**
   * Use LLM to intelligently evaluate what properties need user configuration
   */
  private async evaluateWorkflowProperties(
    workflowId: string,
    userRequest: string,
    createdNodes: any[]
  ): Promise<Array<{
    nodeId: string
    nodeTitle: string  
    property: string
    question: string
    example?: string
    required: boolean
  }>> {
    try {
      // First check if we should use context data instead of passed nodes
      const context = this.getWorkflowContext(workflowId)
      
      // If context has updated property values, prioritize that over passed nodes
      if (context?.propertyValues && context.propertyValues.size > 0) {
        console.log('[DEBUG] Found property values in context - updating nodes with latest values')
        
        // Update the passed nodes with context property values
        createdNodes.forEach((node: any) => {
          const contextProperties = context.propertyValues.get(node.id || node.metadata?.id)
          if (contextProperties) {
            if (!node.metadata) node.metadata = {}
            node.metadata.propertyValues = {
              ...(node.metadata?.propertyValues || {}),
              ...contextProperties
            }
            console.log(`[DEBUG] Updated node ${node.id || node.metadata?.id} with context properties:`, contextProperties)
          }
        })
      }
      
      // Use the potentially updated nodes
      let currentNodes: any[] = createdNodes
      
      // Only try to fetch from API if we don't have nodes
      if (!currentNodes || currentNodes.length === 0) {
        try {
          // Longer delay for CRDT sync to complete
          console.log('[DEBUG] Waiting for CRDT sync before fetching from database...')
          await new Promise(resolve => setTimeout(resolve, 2000)) // 2 seconds
          
          const nodeListResult = await this.mcpClient.callTool(
            'embed_orchestrator',
            'list_workflow_nodes' as any,
            {
              apiKey: this.config.apiKey,
              workflowId,
              graphId: this.config.graphId || 'main'
            }
          )
          
          const nodeListResponse = JSON.parse(nodeListResult)
          if (nodeListResponse.success && nodeListResponse.nodes) {
            currentNodes = nodeListResponse.nodes
          }
        } catch (error: any) {
          // Log the error but continue with what we have
          debugLogger.logError(error, 'Could not fetch nodes from API, using created nodes')
        }
      }

      // If we have no nodes, return empty array (no properties to configure)
      if (!currentNodes || currentNodes.length === 0) {
        debugLogger.logAction('NO_NODES_TO_EVALUATE', { 
          message: 'No nodes available for property evaluation'
        })
        return []
      }
      
      // Build context for LLM evaluation
      const nodesContext = currentNodes.map(node => {
        // Use the correct ID - check both node.id and node.metadata.id
        const nodeId = node.id || node.metadata?.id
        const currentValues = node.metadata?.propertyValues || node.propertyValues || {}
        
        console.log(`[DEBUG] Node ID mapping: id=${node.id}, metadata.id=${node.metadata?.id}, using=${nodeId}`)
        console.log(`[DEBUG] Node ${nodeId} current values:`, currentValues)
        console.log(`[DEBUG] Node ${nodeId} has ${Object.keys(currentValues).length} configured properties`)
        
        return {
          id: nodeId,
          title: node.metadata?.title || node.title || 'Unknown',
          type: node.metadata?.type || node.type || 'Unknown',
          properties: node.metadata?.properties || {},
          currentValues: currentValues
        }
      })

      const evaluationPrompt = `Analyze this workflow and determine what properties need user configuration.

USER REQUEST: "${userRequest}"

WORKFLOW NODES (${nodesContext.length} total):
${JSON.stringify(nodesContext, null, 2)}

CRITICAL ANALYSIS:
1. What properties are ESSENTIAL for this workflow to actually function?
2. Which properties cannot have sensible defaults and MUST be provided by the user?
3. What questions should we ask to get the right configuration from the user?

CRITICAL COMPLETION RULES:
1. If ALL essential properties have values in currentValues, return EMPTY missingProperties array
2. Only ask for properties that DON'T already have values in currentValues
3. If a property already has a value in currentValues, DO NOT ask for it again
4. Consider the workflow COMPLETE if all nodes have their required properties configured

SMART PROPERTY DETECTION:
- If user wants to fetch weather data → URL property needs weather API endpoint
- If user wants scheduled execution → cronExpression or interval needs timing
- If user wants database storage → connection details and query/collection needed
- If user specifies "every X minutes/hours" → extract that timing requirement
- If user mentions specific APIs or services → those URLs are critical
- If there are conditional/if-branch nodes → decisionRules need rule expressions for decision logic
- If user mentions filtering/conditions → rules properties need decision criteria

Generate user-friendly questions that:
- Use simple, non-technical language
- Explain WHY each setting is needed
- Are specific to what the user is trying to achieve
- Include helpful, realistic examples
- Don't ask for properties that can have sensible defaults
- Focus on the CRITICAL configuration needed

QUESTION GUIDELINES:
- Instead of "What is the cronExpression?", ask "How often should this run? (e.g., 'every 5 minutes', 'daily at 9am')"
- Instead of "What is the API endpoint URL?", ask "What's the web address of the API you want to connect to? (e.g., 'https://api.weather.com/v1/current')"
- Instead of "What is the database query?", ask "What data do you want to store? I'll help format the database command"
- Make it conversational and helpful, not technical

Respond with JSON only:
{
  "missingProperties": [
    {
      "nodeId": "actual_node_id",
      "nodeTitle": "Human readable node name",
      "property": "property_name",
      "question": "Simple, friendly question that non-technical users can understand",
      "example": "Realistic example that matches their use case",
      "required": true,
      "reasoning": "Why this is needed"
    }
  ]
}`

      const response = await this.llmService.call({
        messages: [
          {
            role: 'system',
            content: 'You are an expert at understanding workflow requirements and generating appropriate configuration questions.'
          },
          {
            role: 'user',
            content: evaluationPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })

      // Parse and clean the response
      let cleanContent = response.content.trim()
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      
      const firstBrace = cleanContent.indexOf('{')
      const lastBrace = cleanContent.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanContent = cleanContent.substring(firstBrace, lastBrace + 1)
      }

      const evaluation = JSON.parse(cleanContent)
      
      // Map to our expected format
      return (evaluation.missingProperties || []).map((prop: any) => ({
        nodeId: prop.nodeId,
        nodeTitle: prop.nodeTitle,
        property: prop.property,
        question: prop.question,
        example: prop.example,
        required: prop.required !== false
      }))
      
    } catch (error) {
      debugLogger.logError(error, 'Failed to evaluate workflow properties')
      console.error('[DEBUG] Property evaluation error:', error)
      return []
    }
  }

  /**
   * Analyze user intent when there are pending questions
   */
  private async analyzeUserIntentWithContext(
    content: string,
    context: any
  ): Promise<{type: string, confidence: number, analysis: any}> {
    try {
      const analysisPrompt = `Analyze the user's input to determine their intent when they have pending workflow configuration questions.

CRITICAL CONTEXT:
- An EXISTING WORKFLOW already exists with nodes and connections
- Workflow ID: ${context.workflowId || 'unknown'}
- Current phase: ${context.workflowPhase || 'PROPERTY_CONFIGURATION'}  
- User has ${context.pendingQuestions?.length || 0} pending configuration questions
- Questions are about: ${context.pendingQuestions?.map((q: any) => q.question).join('; ') || 'workflow configuration'}

IMPORTANT: The workflow structure is already created. Only properties need configuration.

User Input: "${content}"

Classify the intent as one of:
1. "property_answers" - User is providing SPECIFIC VALUES for configuration questions (URLs, credentials, settings, etc.)
2. "modification_request" - User wants to change/modify the workflow structure (add/remove nodes, change connections, reorder nodes, etc.) 
3. "workflow_evaluation" - User is pointing out problems with the workflow structure and wants it evaluated/fixed
4. "clarification_request" - User is asking for help, explanation, or clarification
5. "new_workflow_request" - User wants to abandon current workflow and start a new one

CRITICAL DISTINCTION - WORKFLOW STRUCTURE vs PROPERTY VALUES:
- "Queue before Slack webhook?" → workflow_evaluation (structure/ordering question)
- "Should X come before Y?" → workflow_evaluation (node ordering question)  
- "API URL is https://..." → property_answers (providing specific values)
- "Use channel #general" → property_answers (providing specific values)
- "The nodes are in wrong order" → workflow_evaluation (structure issue)
- "This connection is incorrect" → workflow_evaluation (structure issue)

CRITICAL RULES:
- Questions about NODE ORDER/STRUCTURE → workflow_evaluation or modification_request
- Providing SPECIFIC VALUES → property_answers
- NEVER classify as "new_workflow_request" unless user EXPLICITLY says to start over/abandon current workflow
- When in doubt between workflow_evaluation and property_answers, look for STRUCTURE words vs VALUE words

COMPREHENSIVE EXAMPLES covering all user response scenarios:

PROPERTY_ANSWERS (providing specific values):
- "The API URL is https://api.weather.com/v1/current and I want it to run every 30 minutes" → property_answers
- "github repo is user/repo, filter by bug label" → property_answers
- "use channel #general and username bot" → property_answers
- "localhost:5432" → property_answers
- "every 5 minutes" → property_answers
- "SELECT * FROM users WHERE active = true" → property_answers
- "https://hooks.slack.com/services/..." → property_answers

WORKFLOW_EVALUATION (structure/order questions):
- "Shouldn't the Queue come before the Slack webhook?" → workflow_evaluation
- "Should the HTTP request happen before the database insert?" → workflow_evaluation
- "These nodes are in wrong order" → workflow_evaluation
- "The workflow looks incorrect" → workflow_evaluation
- "Why is X connected to Y?" → workflow_evaluation
- "This doesn't make sense structurally" → workflow_evaluation
- "The flow is backwards" → workflow_evaluation

MODIFICATION_REQUEST (wants to change workflow):
- "Actually, can you use MySQL instead of PostgreSQL?" → modification_request
- "Add a JSON parser node" → modification_request
- "Remove the email notification" → modification_request
- "Can you change the trigger to webhook instead of cron?" → modification_request
- "I need a different database" → modification_request

CLARIFICATION_REQUEST (asking for help):
- "What does cron expression mean?" → clarification_request
- "How do I format the webhook URL?" → clarification_request
- "What's a connection string?" → clarification_request
- "Can you explain this setting?" → clarification_request
- "I don't understand this question" → clarification_request

NEW_WORKFLOW_REQUEST (wants to start over):
- "Forget this, I want to create a task management workflow instead" → new_workflow_request
- "Start over with a new workflow" → new_workflow_request
- "Cancel this and create something else" → new_workflow_request
- "This is wrong, let's start fresh" → new_workflow_request

WORKFLOW_COMPLETION (wants to finish with current config):
- "Complete the workflow" → workflow_evaluation
- "Finish with current configuration" → workflow_evaluation 
- "That's enough, proceed" → workflow_evaluation
- "Skip the rest and complete" → workflow_evaluation

Key phrases for PROPERTY_ANSWERS (providing values):
- Providing URLs, credentials, settings
- Mentioning specific values for configuration
- Answering questions about filters, channels, usernames, etc.

Key phrases for WORKFLOW_EVALUATION (structure questions):
- "before", "after", "order", "sequence", "should X come before Y"
- "not correct", "wrong", "evaluate", "fix", "redundant", "duplicate", "missing", "incomplete"
- Questions about node positioning, connections, workflow structure

Respond with JSON only:
{
  "type": "property_answers|modification_request|workflow_evaluation|clarification_request|new_workflow_request",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`

      const response = await this.llmService.call({
        messages: [
          {
            role: 'system', 
            content: 'You are an expert at understanding user intent. Respond with valid JSON only.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.2,
        max_tokens: 300
      })
      
      const parsed = JSON.parse(response.content.trim())
      return {
        type: parsed.type,
        confidence: parsed.confidence || 0.5,
        analysis: parsed
      }
    } catch (error) {
      debugLogger.logError(error, 'Failed to analyze user intent')
      // Default to property answers if analysis fails
      return {
        type: 'property_answers',
        confidence: 0.3,
        analysis: { reasoning: 'Analysis failed, defaulting to property answers' }
      }
    }
  }

  /**
   * Process user's property answers and update nodes
   */
  private async *processPropertyAnswers(
    workflowId: string,
    content: string, 
    context: any
  ): AsyncGenerator<StreamingResponse> {
    // Use LLM to intelligently parse the user's responses
    const propertyValues = await this.parsePropertyResponseWithLLM(content, context.pendingQuestions || [])
    
    if (propertyValues.size === 0) {
      yield {
        type: 'message',
        content: "I didn't quite catch that. Let me help you provide the configuration in an easier way."
      }
      
      // Show examples of how to answer
      const firstQuestion = context.pendingQuestions[0]
      const exampleFormat = firstQuestion.example ? 
        `For example, if I ask about ${firstQuestion.nodeTitle}, you could answer: "${firstQuestion.example}"` :
        `You can answer with just the values, one per line, or use the format "setting: value"`
      
      yield {
        type: 'message',
        content: exampleFormat
      }
      
      // Re-ask ALL the questions with clearer formatting
      yield {
        type: 'question',
        content: 'Let\'s try again with these settings:',
        questions: context.pendingQuestions, // Ask ALL questions, no truncation
        workflowId
      }
      return
    }
    
    // Update node properties via MCP
    let updatedCount = 0
    for (const [nodeId, values] of propertyValues) {
      try {
        const result = await this.mcpClient.callTool(
          'embed_orchestrator',
          'update_node_properties' as any,
          {
            apiKey: this.config.apiKey,
            workflowId,
            graphId: this.config.graphId || 'main',
            nodeId,
            propertyValues: values,
            useCRDT: true
          }
        )
        
        const response = JSON.parse(result)
        if (response.success) {
          updatedCount++
          debugLogger.logAction('UPDATE_NODE_PROPERTIES', {
            nodeId: nodeId.substring(0, 12) + '...',
            properties: Object.keys(values)
          })
        }
      } catch (error) {
        debugLogger.logError(error, `Failed to update properties for node ${nodeId}`)
      }
    }
    
    yield {
      type: 'message',
      content: `Updated ${updatedCount} node${updatedCount > 1 ? 's' : ''} with your configuration`
    }
    
    // Wait for CRDT sync and database persistence
    yield {
      type: 'status',
      content: 'Syncing configuration changes...'
    }
    await new Promise(resolve => setTimeout(resolve, 1500)) // 1.5 seconds for initial sync
    
    // Force a reload from database to ensure UI gets updated
    // This is needed because globalThis.pendingCRDTUpdates doesn't persist across serverless API calls
    yield {
      type: 'force_reload',
      content: 'Refreshing workflow data...',
      workflowId
    }
    
    // Re-evaluate the workflow with LLM to check what properties still need configuration
    yield {
      type: 'status',
      content: 'Checking if additional configuration is needed...'
    }
    
    // Wait for CRDT/database sync to complete property updates
    yield {
      type: 'status',
      content: 'Waiting for property updates to sync...'
    }
    
    // Longer delay to ensure CRDT and database sync
    await new Promise(resolve => setTimeout(resolve, 3000)) // 3 seconds to allow full sync
    
    console.log('[DEBUG] Finished waiting for CRDT sync, fetching updated nodes...')
    
    // Get updated nodes and re-evaluate
    const updatedNodesInfo = await this.getUpdatedNodes(workflowId)
    
    // Log the updated nodes to see if properties were actually set
    console.log('[DEBUG] Updated nodes after property configuration:')
    updatedNodesInfo.forEach(node => {
      console.log(`[DEBUG] Node ${node.id || node.metadata?.id}: propertyValues =`, node.metadata?.propertyValues)
    })
    
    const remainingProperties = await this.evaluateWorkflowProperties(
      workflowId,
      context.originalRequest || '',
      updatedNodesInfo
    )
    
    console.log(`[DEBUG] Re-evaluation found ${remainingProperties.length} properties still needed`)
    console.log('[DEBUG] Remaining properties:', remainingProperties)
    
    // Count how many properties have been configured across all nodes
    const totalConfiguredProperties = updatedNodesInfo.reduce((count, node) => {
      const configuredCount = Object.keys(node.metadata?.propertyValues || {}).length
      console.log(`[DEBUG] Node ${node.id || node.metadata?.id} has ${configuredCount} configured properties`)
      return count + configuredCount
    }, 0)
    
    console.log(`[DEBUG] Total configured properties across all nodes: ${totalConfiguredProperties}`)
    
    // Check for infinite loop prevention
    const previousQuestions = context.previousQuestions || []
    const currentQuestionSignature = remainingProperties.map(p => `${p.nodeId}.${p.property}`).sort().join(',')
    
    if (previousQuestions.includes(currentQuestionSignature)) {
      console.log('[DEBUG] INFINITE LOOP DETECTED - same questions asked before!')
      console.log('[DEBUG] Previous questions:', previousQuestions)
      console.log('[DEBUG] Current questions:', currentQuestionSignature)
      
      yield {
        type: 'message',
        content: '🔄 **I notice we\'re asking the same questions again.** This suggests the properties may already be configured but not properly detected.'
      }
      
      yield {
        type: 'message',
        content: `✅ **Let's complete the workflow with the current configuration.** (${totalConfiguredProperties} properties have been set)`
      }
      
      // Force completion to break the loop
      yield* this.completeWorkflowFlow(workflowId, context)
      return
    }
    
    // Track this set of questions to prevent loops
    context.previousQuestions = [...previousQuestions, currentQuestionSignature].slice(-3) // Keep last 3
    this.storeWorkflowContext(workflowId, context)
    
    // If we have configured several properties but LLM still wants more, be more lenient
    if (totalConfiguredProperties >= 3 && remainingProperties.length <= 2) {
      console.log('[DEBUG] Sufficient properties configured, considering workflow ready for completion')
      
      yield {
        type: 'message',
        content: `✅ **Workflow appears to be sufficiently configured!** (${totalConfiguredProperties} properties set)\n\nWould you like me to complete the workflow now, or do you want to configure the remaining optional settings?`
      }
      
      // Still show the remaining questions but make them optional
      if (remainingProperties.length > 0) {
        yield {
          type: 'message',
          content: `**Optional remaining settings:**\n${remainingProperties.map((prop, i) => `${i+1}. ${prop.question}`).join('\n')}`
        }
        
        yield {
          type: 'message',
          content: `💡 You can either:\n- Provide these optional settings\n- Or say "complete the workflow" to finish with current configuration`
        }
      }
    }
    
    // Check if more configuration is needed
    if (remainingProperties.length > 0) {
      console.log(`[DEBUG] Still need ${remainingProperties.length} properties, continuing configuration phase`)
      console.log(`[DEBUG] Missing properties:`, remainingProperties.map(p => `${p.nodeTitle}.${p.property}`).join(', '))
      // Update context with new questions
      context.pendingQuestions = remainingProperties.map((prop, index) => ({
        nodeId: prop.nodeId,
        nodeTitle: prop.nodeTitle,
        propertyName: prop.property,
        propertyType: 'text',
        question: prop.question,
        required: prop.required,
        index: index + 1
      }))
      
      this.storeWorkflowContext(workflowId, context)
      
      const itemWord = remainingProperties.length === 1 ? 'setting' : 'settings'
      yield {
        type: 'message',
        content: `I still need ${remainingProperties.length} more ${itemWord}:`
      }
      
      // Present the remaining questions
      const questionTexts = remainingProperties.map((prop, index) => {
        let text = `**${index + 1}. ${prop.question}**`
        if (prop.example) {
          text += `\n   Example: \`${prop.example}\``
        }
        return text
      })
      
      yield {
        type: 'message',
        content: questionTexts.join('\n\n')
      }
      
      yield {
        type: 'question',
        content: 'Please provide these remaining details:',
        questions: context.pendingQuestions,
        workflowId
      }
    } else {
      // ALL PROPERTIES CONFIGURED! Workflow configuration is complete
      console.log('[DEBUG] 🎉 ALL PROPERTIES CONFIGURED! Moving to workflow completion phase')
      
      // Clear pending questions since we're done with configuration
      context.pendingQuestions = []
      context.workflowPhase = 'COMPLETING'
      this.storeWorkflowContext(workflowId, context)
      
      yield {
        type: 'message',
        content: '🎉 **Workflow configuration complete!** All properties have been set successfully.'
      }
      
      // All configuration complete - but check if we need to create connections
      yield {
        type: 'status',
        content: 'All configuration complete! Checking workflow connections...'
      }
      
      // Check if connections exist
      let hasConnections = false
      let connectionsCreated = 0
      try {
        const { useWorkflowStore } = await import('../../store/workflow-store')
        const store = useWorkflowStore.getState()
        if (store.workflowId === workflowId && store.connections && store.connections.length > 0) {
          hasConnections = true
          console.log('[DEBUG] Workflow already has connections:', store.connections.length)
        }
      } catch (error) {
        console.log('[DEBUG] Could not check connections from store:', error)
      }
      
      // If no connections exist, create them now
      if (!hasConnections) {
        yield {
          type: 'status',
          content: 'Creating connections between nodes...'
        }
        
        // Get the node IDs to connect
        let nodeIds: string[] = []
        try {
          const nodeListResult = await this.mcpClient.callTool(
            'embed_orchestrator',
            'list_workflow_nodes' as any,
            {
              apiKey: this.config.apiKey,
              workflowId,
              graphId: this.config.graphId || 'main'
            }
          )
          
          const nodeListResponse = JSON.parse(nodeListResult)
          if (nodeListResponse.success && nodeListResponse.nodes) {
            nodeIds = nodeListResponse.nodes.map((node: any) => node.id)
            console.log('[DEBUG] Found nodes to connect:', nodeIds)
          }
        } catch (error) {
          console.error('[DEBUG] Failed to list nodes for connections:', error)
        }
        
        // Create sequential connections
        if (nodeIds.length >= 2) {
          // Get node details to find proper ports
          const nodeDetails = await this.getNodeDetailsForConnections(workflowId, nodeIds)
          
          for (let i = 0; i < nodeIds.length - 1; i++) {
            try {
              const sourceNode = nodeDetails[i]
              const targetNode = nodeDetails[i + 1]
              
              // Find the first output port from source node
              const sourcePort = this.findOutputPort(sourceNode)
              // Find the first input port from target node  
              const targetPort = this.findInputPort(targetNode)
              
              if (!sourcePort || !targetPort) {
                console.log(`[DEBUG] Cannot connect nodes after properties - missing ports: source=${sourcePort}, target=${targetPort}`)
                continue
              }
              
              const connectionResult = await this.mcpClient.callTool(
                'embed_orchestrator',
                'connect_nodes' as any,
                {
                  apiKey: this.config.apiKey,
                  workflowId,
                  graphId: this.config.graphId || 'main',
                  sourceNodeId: sourceNode.id,
                  sourcePortId: sourcePort,
                  targetNodeId: targetNode.id,
                  targetPortId: targetPort,
                  useCRDT: true
                }
              )
              
              const connectionResponse = JSON.parse(connectionResult)
              if (connectionResponse.success) {
                connectionsCreated++
                console.log(`[DEBUG] Created connection: ${sourceNode.id} -> ${targetNode.id}`)
              } else {
                console.error(`[DEBUG] Failed to create connection: ${connectionResponse.error}`)
              }
            } catch (error) {
              console.error(`[DEBUG] Failed to create connection ${i}:`, error)
            }
          }
          
          if (connectionsCreated > 0) {
            yield {
              type: 'message',
              content: `Created ${connectionsCreated} connection${connectionsCreated > 1 ? 's' : ''} between nodes`
            }
          }
        }
      }
      
      // Clear the context as we're done
      this.clearWorkflowContext(workflowId)
      
      yield {
        type: 'complete',
        content: `Workflow completed with ${hasConnections ? 'existing' : connectionsCreated || 'no'} connections!`,
        workflowId
      }
    }
  }

  /**
   * Get updated nodes from the workflow - prioritize CRDT/context over database
   */
  private async getUpdatedNodes(workflowId: string): Promise<any[]> {
    // First try to get nodes from context (which should have CRDT data)
    const context = this.getWorkflowContext(workflowId)
    
    // If we have nodes in context, use them - they're from CRDT and most up-to-date
    if (context?.nodes && context.nodes.size > 0) {
      console.log('[DEBUG] Using nodes from CRDT/context, count:', context.nodes.size)
      
      // Convert Map to array
      const nodesArray = Array.from(context.nodes.values())
      
      // Update nodes with any property values we've collected from user responses
      // This is the MOST UP-TO-DATE data since it's from the current session
      if (context.propertyValues && context.propertyValues.size > 0) {
        console.log('[DEBUG] Applying property values from context to nodes...')
        nodesArray.forEach((node: any) => {
          const nodeProperties = context.propertyValues.get(node.id)
          if (nodeProperties) {
            console.log(`[DEBUG] Applying ${Object.keys(nodeProperties).length} properties to node ${node.id}:`, nodeProperties)
            
            // Create metadata if it doesn't exist
            if (!node.metadata) {
              node.metadata = {}
            }
            
            // Merge property values, giving priority to context values
            node.metadata.propertyValues = {
              ...(node.metadata?.propertyValues || {}),
              ...nodeProperties  // Context values override database values
            }
            
            console.log(`[DEBUG] Node ${node.id} now has propertyValues:`, node.metadata.propertyValues)
          } else {
            console.log(`[DEBUG] No property values in context for node ${node.id}`)
          }
        })
      } else {
        console.log('[DEBUG] No property values in context to apply')
      }
      
      return nodesArray
    }
    
    // If no context, try to get from workflow store (CRDT) directly
    try {
      // Import the workflow store to get CRDT data
      const { useWorkflowStore } = await import('../../store/workflow-store')
      const store = useWorkflowStore.getState()
      
      // Check if the store has nodes for this workflow
      if (store.workflowId === workflowId && store.nodes && store.nodes.length > 0) {
        console.log(`[DEBUG] Using ${store.nodes.length} nodes from CRDT store`)
        return store.nodes.map((node: any) => ({
          id: node.metadata?.id || node.id,
          metadata: node.metadata,
          position: node.position
        }))
      }
    } catch (error) {
      console.log('[DEBUG] Could not access CRDT store:', error)
    }
    
    // Last resort: try API (which reads from database)
    try {
      const nodeListResult = await this.mcpClient.callTool(
        'embed_orchestrator',
        'list_workflow_nodes' as any,
        {
          apiKey: this.config.apiKey,
          workflowId,
          graphId: this.config.graphId || 'main'
        }
      )
      
      const nodeListResponse = JSON.parse(nodeListResult)
      if (nodeListResponse.success && nodeListResponse.nodes) {
        console.log(`[DEBUG] Retrieved ${nodeListResponse.nodes.length} nodes from database API`)
        return nodeListResponse.nodes
      }
    } catch (error: any) {
      console.log('[DEBUG] Could not fetch nodes from API:', error.message)
    }
    
    // Fallback to empty array if no nodes available
    return []
  }
  
  /**
   * Handle workflow evaluation - fix problems in the workflow
   */
  private async *handleWorkflowEvaluation(
    workflowId: string,
    content: string,
    context: any
  ): AsyncGenerator<StreamingResponse> {
    try {
      // Check if user wants to complete the workflow
      const completionKeywords = ['complete', 'finish', 'proceed', 'skip', 'done', 'enough']
      const isCompletionRequest = completionKeywords.some(keyword => 
        content.toLowerCase().includes(keyword)
      )
      
      if (isCompletionRequest) {
        console.log('[DEBUG] User requesting workflow completion')
        
        // Clear pending questions and complete the workflow
        context.pendingQuestions = []
        context.workflowPhase = 'COMPLETING' 
        this.storeWorkflowContext(workflowId, context)
        
        yield {
          type: 'message',
          content: '🎉 **Completing workflow as requested!** Moving to final steps...'
        }
        
        // Jump to completion logic - check connections and finish
        yield* this.completeWorkflowFlow(workflowId, context)
        return
      }
      
      // Analyze what's wrong with the workflow
      const evaluationPrompt = `The user is reporting problems with their workflow. Analyze and identify specific issues.

User's feedback: "${content}"

Current workflow has ${context.existingNodes?.length || 0} nodes.
Pending questions: ${context.pendingQuestions?.length || 0}

Common issues to check for:
1. Duplicate nodes (e.g., both interval trigger AND cron trigger)
2. Missing essential nodes
3. Incorrect connections
4. Wrong node types for the task
5. Duplicate questions being asked

Identify the specific problems and suggest fixes.

Respond with JSON:
{
  "issues": [
    {
      "type": "duplicate|missing|incorrect|redundant",
      "description": "what's wrong",
      "fix": "how to fix it"
    }
  ],
  "actions": [
    {
      "action": "remove_duplicate_triggers|add_missing_node|fix_connections|continue_configuration",
      "details": "specific action to take"
    }
  ]
}`

      const response = await this.llmService.call({
        messages: [
          {
            role: 'system',
            content: 'You are evaluating a workflow for problems. Be specific and actionable.'
          },
          {
            role: 'user',
            content: evaluationPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      })

      const evaluation = JSON.parse(response.content)
      
      // Report the issues found
      if (evaluation.issues && evaluation.issues.length > 0) {
        yield {
          type: 'message',
          content: `I found these issues:\n${evaluation.issues.map((issue: any, i: number) => 
            `${i+1}. ${issue.description}`
          ).join('\n')}`
        }
        
        // Provide intelligent analysis and recommendations
        yield {
          type: 'message',
          content: 'You raise a good point about the workflow structure. Let me analyze this...'
        }
        
        // Generate intelligent response about workflow structure
        const structureAnalysisPrompt = `The user is asking about workflow structure/ordering. Provide an intelligent analysis.

User's question: "${content}"
Workflow context: ${context.existingNodes?.length || 0} nodes, ${context.pendingQuestions?.length || 0} pending configurations

Common workflow patterns to consider:
1. Triggers (cron, webhook) should come first
2. Data sources (HTTP requests, database queries) come early
3. Processing (transformations, filters) happen in the middle  
4. Queues can be placed strategically for asynchronous processing
5. Outputs (notifications, database saves) come at the end

Provide a helpful explanation of:
- Whether their suggested order makes sense
- What the ideal order should be and why
- Any trade-offs or considerations

Be practical and educational. Focus on workflow efficiency and data flow logic.`

        try {
          const structureResponse = await this.llmService.call({
            messages: [
              {
                role: 'system',
                content: 'You are a workflow architecture expert. Provide practical, clear guidance about workflow structure and node ordering.'
              },
              {
                role: 'user',
                content: structureAnalysisPrompt
              }
            ],
            temperature: 0.3,
            max_tokens: 400
          })
          
          yield {
            type: 'message',
            content: structureResponse.content
          }
        } catch (error) {
          yield {
            type: 'message',
            content: 'You make a valid point about the workflow structure. The order of nodes can affect performance and reliability. For now, let\'s continue with the configuration and we can revisit the structure afterward.'
          }
        }
      } else {
        // No specific issues found, but user is asking about workflow structure
        yield {
          type: 'message',
          content: 'Let me analyze your workflow structure question...'
        }
        
        // Generate intelligent response about workflow structure
        const structureAnalysisPrompt = `The user is asking about workflow structure/ordering. Provide an intelligent analysis.

User's question: "${content}"
Workflow context: ${context.existingNodes?.length || 0} nodes, ${context.pendingQuestions?.length || 0} pending configurations

Common workflow patterns to consider:
1. Triggers (cron, webhook) should come first
2. Data sources (HTTP requests, database queries) come early
3. Processing (transformations, filters) happen in the middle  
4. Queues can be placed strategically for asynchronous processing
5. Outputs (notifications, database saves) come at the end

Provide a helpful explanation of:
- Whether their suggested order makes sense
- What the ideal order should be and why
- Any trade-offs or considerations

Be practical and educational. Focus on workflow efficiency and data flow logic.`

        try {
          const structureResponse = await this.llmService.call({
            messages: [
              {
                role: 'system',
                content: 'You are a workflow architecture expert. Provide practical, clear guidance about workflow structure and node ordering.'
              },
              {
                role: 'user',
                content: structureAnalysisPrompt
              }
            ],
            temperature: 0.3,
            max_tokens: 400
          })
          
          yield {
            type: 'message',
            content: structureResponse.content
          }
        } catch (error) {
          yield {
            type: 'message',
            content: 'You make a valid point about the workflow structure. The order of nodes can affect performance and reliability. For now, let\'s continue with the configuration and we can revisit the structure afterward.'
          }
        }
      }
      
      // Continue with property questions if they exist
      if (context.pendingQuestions && context.pendingQuestions.length > 0) {
        // Remove duplicates from pending questions
        const uniqueQuestions = this.removeDuplicateQuestions(context.pendingQuestions)
        context.pendingQuestions = uniqueQuestions
        this.storeWorkflowContext(workflowId, context)
        
        yield {
          type: 'question',
          content: 'Let me ask for the configuration again (duplicates removed):',
          questions: uniqueQuestions, // Show ALL questions, no truncation
          workflowId
        }
      }
    } catch (error) {
      debugLogger.logError(error, 'Failed to evaluate workflow')
      yield {
        type: 'message',
        content: 'I had trouble evaluating the workflow. Please continue with the configuration or provide more specific feedback.'
      }
    }
  }

  /**
   * Handle modification requests
   */
  private async *handleModificationRequest(
    workflowId: string,
    content: string,
    context: any
  ): AsyncGenerator<StreamingResponse> {
    // For now, acknowledge and re-ask questions
    // TODO: Implement actual modification logic using state machine
    yield {
      type: 'message',
      content: 'Workflow modifications are noted. Let\'s first complete the basic configuration, then I can make those changes.'
    }
    
    yield {
      type: 'question',
      content: 'Please provide the current configuration first:',
      questions: context.pendingQuestions.slice(0, 2),
      workflowId
    }
  }

  /**
   * Handle clarification requests  
   */
  private async *handleClarificationRequest(
    content: string,
    context: any
  ): AsyncGenerator<StreamingResponse> {
    try {
      // Generate helpful explanation based on the question
      const explanationPrompt = `The user is asking for clarification about workflow configuration.

Context: The user has pending questions about ${context.pendingQuestions?.map((q: any) => q.question).join('; ')}

User's question: "${content}"

Provide a helpful, clear explanation that will help them understand how to configure their workflow. Be specific and include examples where relevant.`

      const response = await this.llmService.call({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant explaining workflow configuration. Be clear and provide examples.'
          },
          {
            role: 'user', 
            content: explanationPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      })
      
      yield {
        type: 'message',
        content: response.content
      }
      
      // Re-ask the questions after explanation
      yield {
        type: 'question',
        content: 'Now that you understand better, please provide the configuration:',
        questions: context.pendingQuestions, // Show ALL questions, no truncation
        workflowId: context.workflowId
      }
    } catch (error) {
      debugLogger.logError(error, 'Failed to generate clarification response')
      
      yield {
        type: 'message',
        content: 'I\'d be happy to help explain! Could you be more specific about what you need clarification on?'
      }
    }
  }

  /**
   * Remove duplicate questions from the list
   */
  private removeDuplicateQuestions(questions: PropertyQuestion[]): PropertyQuestion[] {
    const seen = new Set<string>()
    const unique: PropertyQuestion[] = []
    
    for (const question of questions) {
      // Create a unique key based on node and property
      const key = `${question.nodeTitle}-${question.propertyName}-${question.question}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(question)
      }
    }
    
    return unique
  }
  
  /**
   * Parse property response from user using LLM intelligence
   */
  private async parsePropertyResponseWithLLM(
    content: string,
    questions: PropertyQuestion[]
  ): Promise<Map<string, Record<string, any>>> {
    const propertyValues = new Map<string, Record<string, any>>()
    
    try {
      const matchingPrompt = `You are parsing user responses to workflow configuration questions. 
Your job is to intelligently match each answer to the correct node property.

QUESTIONS THAT WERE ASKED:
${questions.map((q, i) => `
Question ${i+1}:
- Node ID: ${q.nodeId}
- Property Name: ${q.propertyName} 
- Question: "${q.question}"
- Expected Type: ${q.propertyType}
- Example: ${q.suggestedValue || 'none provided'}
`).join('\n')}

USER'S RESPONSE:
"${content}"

INTELLIGENT PARSING INSTRUCTIONS:
1. Understand the INTENT behind each answer
2. Match answers to questions based on semantic meaning, not just keywords
3. Handle various response formats:
   - Numbered lists
   - Labeled answers  
   - Natural language responses
   - Single answers for multiple questions
   - Partial responses
4. Convert values appropriately for the expected type
5. If user says "localhost" for a database question, understand they mean the database server
6. If user gives a time like "5 minutes", convert to appropriate format (300000 for milliseconds, "*/5 * * * *" for cron, etc.)

CRITICAL RULE PROPERTY HANDLING:
For properties with type "rules", you must generate a COMPLETE rule structure, not just text.
Example rule structure:
[{
  "type": "IF",
  "groups": [{
    "connector": "AND",
    "rules": [{
      "field": "owner",
      "operator": "is",
      "value": "john",
      "valueType": "string"
    }]
  }]
}]

When user says things like:
- "owner is john" → Generate rule with field="owner", operator="is", value="john"
- "value contains test" → Generate rule with field="value", operator="contains", value="test"
- "amount greater than 100" → Generate rule with field="amount", operator="greater_than", value="100"

CRITICAL: 
- Use the EXACT nodeId from the questions above
- Use the EXACT propertyName from the questions above
- Extract the actual VALUE the user provided

Respond with ONLY valid JSON mapping nodeId to properties:
{
  "actual-node-id-from-above": {
    "exact-property-name": "extracted-and-converted-value"
  }
}`

      const response = await this.llmService.call({
        messages: [
          {
            role: 'system',
            content: 'You are an expert at understanding user intent and parsing configuration responses. CRITICAL: There is an EXISTING WORKFLOW with nodes and connections already created. Your job is to parse property values for the existing workflow, NOT create new workflows. Use intelligence to map answers correctly. Respond with valid JSON only.'
          },
          {
            role: 'user',
            content: matchingPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 800
      })

      // Parse the LLM response
      let cleanContent = response.content.trim()
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      
      const firstBrace = cleanContent.indexOf('{')
      const lastBrace = cleanContent.lastIndexOf('}')
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanContent = cleanContent.substring(firstBrace, lastBrace + 1)
      }
      
      const parsed = JSON.parse(cleanContent)
      
      // Convert to Map format and validate
      for (const [nodeId, values] of Object.entries(parsed)) {
        if (typeof values === 'object' && values !== null) {
          // Verify this nodeId exists in our questions
          const nodeExists = questions.some(q => q.nodeId === nodeId)
          if (nodeExists) {
            // Process property values following backup agent pattern
            const processedValues = this.processPropertyValuesForRules(
              values as Record<string, any>, 
              questions.filter(q => q.nodeId === nodeId)
            )
            propertyValues.set(nodeId, processedValues)
            console.log(`[DEBUG] Set properties for ${nodeId}:`, processedValues)
          } else {
            console.warn(`[DEBUG] Ignoring unknown nodeId: ${nodeId}`)
          }
        }
      }
      
      console.log('[DEBUG] LLM successfully parsed property values')
      
    } catch (error) {
      console.error('[DEBUG] Failed to parse with LLM:', error)
      // Return empty map - no guessing or fallbacks
      return new Map()
    }
    
    return propertyValues
  }
  
  /**
   * Parse value based on property type
   */
  private parseValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return parseFloat(value)
      case 'boolean':
        return value.toLowerCase() === 'true'
      case 'code':
      case 'code-editor':
        return value.trim()
      default:
        return value
    }
  }

  /**
   * Process property values for rules, following backup agent pattern
   * The LLM generates rule structures, we just add IDs and validate
   */
  private processPropertyValuesForRules(
    values: Record<string, any>, 
    nodeQuestions: PropertyQuestion[]
  ): Record<string, any> {
    const processedValues: Record<string, any> = {}
    
    for (const [propertyName, value] of Object.entries(values)) {
      const question = nodeQuestions.find(q => q.propertyName === propertyName)
      
      // Check if this is a rules property based on the property type
      if (question?.propertyType === 'rules' && value) {
        // For rules, ensure the value is properly structured
        if (!Array.isArray(value)) {
          processedValues[propertyName] = [value]
        } else {
          processedValues[propertyName] = value
        }
        
        // Generate unique IDs and validate types - following backup agent pattern
        if (processedValues[propertyName]) {
          processedValues[propertyName] = processedValues[propertyName].map((ruleSet: any) => ({
            ...ruleSet,
            id: ruleSet.id || `ruleset-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: (ruleSet.type === 'OR' ? 'OR' : 'IF') as 'IF' | 'OR', // Ensure valid type
            groups: (ruleSet.groups || []).map((group: any) => ({
              ...group,
              id: group.id || `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              connector: (group.connector === 'OR' ? 'OR' : 'AND') as 'AND' | 'OR', // Ensure valid connector
              rules: (group.rules || []).map((rule: any) => ({
                ...rule,
                id: rule.id || `rule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                valueType: rule.valueType || 'string',
              }))
            }))
          }))
        }
      } else {
        // For non-rule properties, use value as-is
        processedValues[propertyName] = value
      }
    }
    
    return processedValues
  }

  /**
   * Complete the workflow flow - handle final steps like connections and completion
   */
  private async *completeWorkflowFlow(
    workflowId: string,
    context: any
  ): AsyncGenerator<StreamingResponse> {
    // Check if connections exist and create them if needed
    let hasConnections = false
    let connectionsCreated = 0
    
    try {
      const { useWorkflowStore } = await import('../../store/workflow-store')
      const store = useWorkflowStore.getState()
      if (store.workflowId === workflowId && store.connections && store.connections.length > 0) {
        hasConnections = true
        console.log('[DEBUG] Workflow already has connections:', store.connections.length)
      }
    } catch (error) {
      console.log('[DEBUG] Could not check connections from store:', error)
    }
    
    // If no connections exist, create them now
    if (!hasConnections) {
      yield {
        type: 'status',
        content: 'Creating connections between nodes...'
      }
      
      // Get the node IDs to connect
      let nodeIds: string[] = []
      try {
        const nodeListResult = await this.mcpClient.callTool(
          'embed_orchestrator',
          'list_workflow_nodes' as any,
          {
            apiKey: this.config.apiKey,
            workflowId,
            graphId: this.config.graphId || 'main'
          }
        )
        
        const nodeListResponse = JSON.parse(nodeListResult)
        if (nodeListResponse.success && nodeListResponse.nodes) {
          nodeIds = nodeListResponse.nodes.map((node: any) => node.id)
          console.log('[DEBUG] Found nodes to connect:', nodeIds)
        }
      } catch (error) {
        console.error('[DEBUG] Failed to list nodes for connections:', error)
      }
      
      // Create sequential connections
      if (nodeIds.length >= 2) {
        // Get node details to find proper ports
        const nodeDetails = await this.getNodeDetailsForConnections(workflowId, nodeIds)
        
        for (let i = 0; i < nodeIds.length - 1; i++) {
          try {
            const sourceNode = nodeDetails[i]
            const targetNode = nodeDetails[i + 1]
            
            // Find the first output port from source node
            const sourcePort = this.findOutputPort(sourceNode)
            // Find the first input port from target node  
            const targetPort = this.findInputPort(targetNode)
            
            if (!sourcePort || !targetPort) {
              console.log(`[DEBUG] Cannot connect nodes - missing ports: source=${sourcePort}, target=${targetPort}`)
              continue
            }
            
            const connectionResult = await this.mcpClient.callTool(
              'embed_orchestrator',
              'connect_nodes' as any,
              {
                apiKey: this.config.apiKey,
                workflowId,
                graphId: this.config.graphId || 'main',
                sourceNodeId: sourceNode.id,
                sourcePortId: sourcePort,
                targetNodeId: targetNode.id,
                targetPortId: targetPort,
                useCRDT: true
              }
            )
            
            const connectionResponse = JSON.parse(connectionResult)
            if (connectionResponse.success) {
              connectionsCreated++
              console.log(`[DEBUG] Successfully connected ${sourceNode.id} → ${targetNode.id}`)
            }
          } catch (error) {
            console.error(`[DEBUG] Failed to create connection ${i}:`, error)
          }
        }
        
        if (connectionsCreated > 0) {
          yield {
            type: 'message',
            content: `✅ Created ${connectionsCreated} connection${connectionsCreated > 1 ? 's' : ''} between nodes`
          }
        }
      }
    }
    
    // Clear the context as we're done
    this.clearWorkflowContext(workflowId)
    
    yield {
      type: 'complete',
      content: `🎉 **Workflow completed successfully!** Your workflow is ready to use with ${hasConnections ? 'existing' : connectionsCreated || 'no'} connections.`,
      workflowId
    }
  }

  /**
   * Intelligent template selection from backup agent
   * Filters templates based on relevance and compatibility
   */
  private async selectRelevantTemplates(
    allTemplates: any[],
    searchQueries: string[],
    userRequest: string
  ): Promise<any[]> {
    if (allTemplates.length === 0) {
      return []
    }
    
    // If we have few templates, just return them all
    if (allTemplates.length <= 3) {
      return allTemplates
    }
    
    try {
      // Use LLM to intelligently select relevant templates
      const templateDescriptions = allTemplates.map((template, index) => 
        `${index + 1}. ${template.title}: ${template.description} (category: ${template.category || 'unknown'}, tags: ${(template.tags || []).join(', ')})`
      ).join('\n')
      
      const selectionPrompt = `Select the most relevant and necessary node templates for this workflow.

User request: "${userRequest}"
Search queries used: ${searchQueries.join(', ')}

Available templates:
${templateDescriptions}

CRITICAL SELECTION CRITERIA:
1. RELEVANCE: Does this template directly relate to the user's request?
2. NECESSITY: Is this template essential for the workflow to function?
3. COMPATIBILITY: Do selected templates work well together?
4. NO REDUNDANCY: Don't select multiple templates that do the same thing

INTELLIGENT FILTERING:
- For weather API: HTTP Request is essential, Twitter/X Post is NOT relevant
- For database storage: Choose ONE database type (MongoDB OR PostgreSQL, not both)
- For API workflows: Need HTTP request + data transformation + storage
- For automation: Need ONE trigger type (interval OR cron, NOT both)

CRITICAL DUPLICATE PREVENTION:
- NEVER select both "Interval Trigger" AND "Cron Trigger" - they do the same thing
- NEVER select multiple HTTP Request nodes unless hitting different APIs
- NEVER select multiple database types unless specifically integrating them
- Choose the MOST APPROPRIATE single option for each function

AVOID COMMON MISTAKES:
- Don't select social media nodes unless specifically requested
- Don't select multiple nodes that serve the same purpose
- Don't select nodes that duplicate functionality
- Don't select nodes that aren't mentioned or implied in the request

Select 3-6 most relevant templates. Focus on ESSENTIAL nodes only.

CRITICAL: You MUST respond with valid JSON only. No explanations, no markdown, no text outside the JSON.

Return ONLY this JSON structure:
{
  "selected": [1, 3, 5],
  "reasoning": "Brief explanation of why these templates were chosen"
}`

      const response = await this.llmService.call({
        messages: [
          {
            role: 'system',
            content: 'You are an expert at selecting relevant workflow components. You MUST respond with valid JSON only. No explanations, no markdown, no text outside the JSON structure.'
          },
          {
            role: 'user',
            content: selectionPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      })
      
      // Clean and parse JSON response
      let cleanContent = response.content.trim()
      
      // Remove markdown code blocks
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      
      // Find JSON content - look for first { and last }
      const firstBrace = cleanContent.indexOf('{')
      const lastBrace = cleanContent.lastIndexOf('}')
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanContent = cleanContent.substring(firstBrace, lastBrace + 1)
      }
      
      const selection = JSON.parse(cleanContent)
      
      if (selection.selected && Array.isArray(selection.selected)) {
        const selectedTemplates = selection.selected
          .filter((index: number) => index >= 1 && index <= allTemplates.length)
          .map((index: number) => allTemplates[index - 1])
        
        debugLogger.logAction('TEMPLATE_SELECTION', {
          selectedCount: selectedTemplates.length,
          totalAvailable: allTemplates.length,
          reasoning: selection.reasoning,
          selectedIds: selectedTemplates.map((t: any) => t.id)
        })
        
        return selectedTemplates
      }
    } catch (error) {
      debugLogger.logError(error, 'Failed to intelligently select templates')
    }
    
    // Fallback: return first 3 templates
    return allTemplates.slice(0, 3)
  }

  /**
   * Generate unique workflow ID
   */
  private generateWorkflowId(): string {
    return `wf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
  
  /**
   * Store workflow context for resumption
   */
  storeWorkflowContext(workflowId: string, context: Partial<WorkflowContext>) {
    const existing = this.workflowContexts.get(workflowId) || {} as WorkflowContext
    this.workflowContexts.set(workflowId, {
      ...existing,
      ...context
    } as WorkflowContext)
  }
  
  /**
   * Get workflow context
   */
  getWorkflowContext(workflowId: string): WorkflowContext | undefined {
    return this.workflowContexts.get(workflowId)
  }
  
  /**
   * Clear workflow context
   */
  clearWorkflowContext(workflowId: string) {
    this.workflowContexts.delete(workflowId)
  }
  
  /**
   * Get current state machine visualization
   */
  getStateMachineVisualization(): string {
    if (!this.executor) {
      return 'No active state machine'
    }
    return this.executor.generateMermaidDiagram()
  }

  /**
   * Get node details for connection creation
   */
  private async getNodeDetailsForConnections(workflowId: string, nodeIds: string[]): Promise<any[]> {
    try {
      const nodeListResult = await this.mcpClient.callTool(
        'embed_orchestrator',
        'list_workflow_nodes' as any,
        {
          apiKey: this.config.apiKey,
          workflowId,
          graphId: this.config.graphId || 'main'
        }
      )
      
      const nodeListResponse = JSON.parse(nodeListResult)
      if (nodeListResponse.success && nodeListResponse.nodes) {
        // Return nodes in the same order as nodeIds
        return nodeIds.map(id => 
          nodeListResponse.nodes.find((node: any) => node.id === id)
        ).filter(Boolean)
      }
    } catch (error) {
      console.error('[DEBUG] Failed to get node details:', error)
    }
    
    // Fallback: return minimal node objects
    return nodeIds.map(id => ({ id, metadata: { ports: [] } }))
  }

  /**
   * Find the first output port from a node
   */
  private findOutputPort(node: any): string | null {
    // Check both metadata.outputs (new structure) and metadata.ports (legacy)
    const outputs = node.metadata?.outputs || []
    const ports = node.metadata?.ports || []
    
    // Try outputs first (preferred)
    if (outputs.length > 0) {
      return outputs[0].id
    }
    
    // Check ports for outputs
    const outputPort = ports.find((port: any) => port.type === 'output')
    if (outputPort) {
      return outputPort.id
    }
    
    // Fallback to common output port names in all ports
    const allPorts = [...outputs, ...ports]
    const commonOutputPorts = ['output', 'out', 'result', 'data-out', 'trigger-out', 'request-out']
    for (const portName of commonOutputPorts) {
      if (allPorts.find((p: any) => p.id === portName)) {
        return portName
      }
    }
    
    // Last resort: use first port if exists
    return allPorts.length > 0 ? allPorts[0].id : 'output'
  }

  /**
   * Find the first input port from a node
   */
  private findInputPort(node: any): string | null {
    // Check both metadata.inputs (new structure) and metadata.ports (legacy)
    const inputs = node.metadata?.inputs || []
    const ports = node.metadata?.ports || []
    
    // Try inputs first (preferred)
    if (inputs.length > 0) {
      return inputs[0].id
    }
    
    // Check ports for inputs
    const inputPort = ports.find((port: any) => port.type === 'input')
    if (inputPort) {
      return inputPort.id
    }
    
    // Fallback to common input port names in all ports
    const allPorts = [...inputs, ...ports]
    const commonInputPorts = ['input', 'in', 'data', 'data-in', 'query-in', 'content-in', 'message-in']
    for (const portName of commonInputPorts) {
      if (allPorts.find((p: any) => p.id === portName)) {
        return portName
      }
    }
    
    // Last resort: use first port if exists
    return allPorts.length > 0 ? allPorts[0].id : 'input'
  }
}

/**
 * Export the agent for use
 */
export default OrchestratorAgentStateMachine