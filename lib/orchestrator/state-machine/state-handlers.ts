/**
 * State handlers for the dynamic state machine
 * Each handler implements the logic for a specific state type
 */

import { StateType, StateContext, StateExecutionResult, PropertyQuestion, WorkflowIntent } from './types'
import { SearchService } from '../../../services/node-template-repository/search/search-service'
import { EmbeddingService } from '../../../services/node-template-repository/search/embedding-service'
import { getTemplateOperations } from '../../database-template-operations'
import { INTENT_EXTRACTION_PROMPT, WORKFLOW_PLANNING_PROMPT, MODIFICATION_INTERPRETATION_PROMPT } from '../prompts'

/**
 * Base state handler interface
 */
export interface StateHandler {
  execute(context: StateContext, input: string): Promise<StateExecutionResult>
}

/**
 * Analyze the initial context and existing workflow
 */
export class AnalyzeContextHandler implements StateHandler {
  constructor(
    private mcpClient: any,
    private apiKey: string
  ) {}

  async execute(context: StateContext, input: string): Promise<StateExecutionResult> {
    try {
      // If we have a workflow ID, load existing workflow data
      if (context.workflowId) {
        const result = await this.mcpClient.callTool(
          'embed_orchestrator',
          'list_workflow_nodes' as any,
          {
            apiKey: this.apiKey,
            workflowId: context.workflowId,
            graphId: context.graphId
          }
        )
        
        const response = JSON.parse(result)
        if (response.nodes) {
          context.existingNodes = response.nodes
          
          // Extract connections and groups from nodes if available
          // This would be extended to load full workflow state
        }
      }
      
      return {
        success: true,
        nextState: StateType.DETECT_INTENT,
        output: {
          workflowLoaded: !!context.workflowId,
          nodeCount: context.existingNodes.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error
      }
    }
  }
}

/**
 * Detect user intent from the input
 */
export class DetectIntentHandler implements StateHandler {
  constructor(
    private llmService: any
  ) {}

  async execute(context: StateContext, input: string): Promise<StateExecutionResult> {
    try {
      // Use the proven optimized prompt from the backup agent
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

For the request "${input}", critically evaluate:
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
      
      const workflowIntent = JSON.parse(cleanContent)
      
      // Map to WorkflowIntent format expected by the system
      const intent: WorkflowIntent = {
        description: workflowIntent.description,
        suggestedName: workflowIntent.suggestedName || 'New Workflow',
        suggestedDescription: workflowIntent.suggestedDescription || workflowIntent.description,
        suggestedNodes: (workflowIntent.suggestedNodes || []).map((node: any) => ({
          query: node.query,
          position: node.position || { x: 100, y: 200 },
          purpose: node.purpose || node.query,
          connections: workflowIntent.connections
            ? workflowIntent.connections
                .filter((c: any) => c.from === node.query)
                .map((c: any) => ({ from: node.query, to: c.to }))
            : []
        }))
      }
      
      context.intent = intent
      
      // Determine next state based on intent
      let nextState: StateType
      
      if (context.existingNodes.length > 0) {
        // Existing workflow - check if this is modification or feedback
        if (this.isModificationRequest(input, intent)) {
          nextState = StateType.ANALYZE_MODIFICATION
        } else if (this.isFeedback(input)) {
          nextState = StateType.HANDLE_FEEDBACK
        } else {
          // Adding to existing workflow
          nextState = StateType.SEARCH_TEMPLATES
        }
      } else {
        // New workflow creation
        nextState = StateType.SEARCH_TEMPLATES
      }
      
      return {
        success: true,
        nextState,
        output: intent
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error
      }
    }
  }
  
  private isModificationRequest(input: string, intent: any): boolean {
    const modificationKeywords = ['change', 'update', 'modify', 'remove', 'delete', 'fix', 'connect']
    return modificationKeywords.some(keyword => 
      input.toLowerCase().includes(keyword)
    )
  }
  
  private isFeedback(input: string): boolean {
    const feedbackPatterns = [
      'too many', 'duplicate', 'missing', 'forgot', 'didn\'t', 
      'wrong', 'error', 'not working', 'broken'
    ]
    return feedbackPatterns.some(pattern => 
      input.toLowerCase().includes(pattern)
    )
  }
}

/**
 * Search for node templates based on intent
 */
export class SearchTemplatesHandler implements StateHandler {
  private searchService: SearchService | null = null
  
  constructor(
    private mcpClient: any
  ) {}
  
  private async getSearchService(): Promise<SearchService> {
    if (!this.searchService) {
      const templateOps = await getTemplateOperations()
      const embeddingService = EmbeddingService.fromEnvironment()
      this.searchService = new SearchService(templateOps, embeddingService)
    }
    return this.searchService
  }
  
  async execute(context: StateContext, input: string): Promise<StateExecutionResult> {
    try {
      const intent = context.intent!
      
      // Collect all templates from searches
      const allTemplates: any[] = []
      const templatesByQuery = new Map<string, any[]>()
      
      // Search for templates using MCP client to match the working approach
      for (const suggestedNode of intent.suggestedNodes) {
        try {
          const searchResult = await this.mcpClient.callTool(
            'node_template_repository',
            'search_templates' as any,
            {
              query: suggestedNode.query,
              limit: 5
            }
          )
          
          if (searchResult && searchResult !== 'undefined') {
            const searchResponse = JSON.parse(searchResult)
            const results = Array.isArray(searchResponse) ? searchResponse : 
                            (searchResponse.data || searchResponse.results || searchResponse.templates || [])
            
            templatesByQuery.set(suggestedNode.query, results)
            results.forEach((template: any) => {
              // Deduplicate templates
              if (!allTemplates.find(t => t.id === template.id)) {
                allTemplates.push(template)
              }
            })
          }
        } catch (error) {
          console.error(`Search failed for query: ${suggestedNode.query}`, error)
        }
      }
      
      // Apply intelligent template selection if we have a language model
      const selectedTemplates = await this.selectRelevantTemplates(allTemplates, intent.suggestedNodes, input)
      
      // Map selected templates back to queries
      const templateResults = new Map<string, any>()
      for (const suggestedNode of intent.suggestedNodes) {
        const queryTemplates = templatesByQuery.get(suggestedNode.query) || []
        // Find the selected template that matches this query's results
        const selectedTemplate = selectedTemplates.find(selected => 
          queryTemplates.some(qt => qt.id === selected.id)
        )
        if (selectedTemplate) {
          templateResults.set(suggestedNode.query, selectedTemplate)
        }
      }
      
      context.templateMap = templateResults
      
      // If we found templates, proceed to create nodes
      if (templateResults.size > 0) {
        return {
          success: true,
          nextState: StateType.CREATE_NODES,
          output: {
            templatesFound: templateResults.size,
            totalRequested: intent.suggestedNodes.length,
            selectedTemplates: selectedTemplates.length
          }
        }
      } else {
        // No templates found
        return {
          success: true,
          nextState: StateType.COMPLETE,
          output: {
            templatesFound: 0,
            totalRequested: intent.suggestedNodes.length,
            message: 'No templates found matching requirements'
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error
      }
    }
  }
  
  /**
   * Intelligent template selection from backup agent
   */
  private async selectRelevantTemplates(
    allTemplates: any[],
    suggestedNodes: any[],
    userRequest: string
  ): Promise<any[]> {
    if (allTemplates.length === 0) {
      return []
    }
    
    // If we have few templates, just return them all
    if (allTemplates.length <= 3) {
      return allTemplates
    }
    
    // For now, return the first few most relevant ones
    // In a full implementation, this would use LLM to intelligently filter
    return allTemplates.slice(0, Math.min(suggestedNodes.length * 2, 6))
  }
}

/**
 * Create nodes from templates
 */
export class CreateNodesHandler implements StateHandler {
  constructor(
    private mcpClient: any,
    private apiKey: string
  ) {}
  
  async execute(context: StateContext, input: string): Promise<StateExecutionResult> {
    try {
      const intent = context.intent!
      const nodeMap = new Map<string, string>()
      
      // Prepare all nodes for batch creation
      const nodesToCreate: any[] = []
      
      for (const suggestedNode of intent.suggestedNodes) {
        const template = context.templateMap.get(suggestedNode.query)
        
        if (!template) {
          console.warn(`No template found for query: ${suggestedNode.query}`)
          continue
        }
        
        // Extract ports from template
        const inputs = template.ports?.filter((port: any) => port.type === 'input') || []
        const outputs = template.ports?.filter((port: any) => port.type === 'output') || []
        
        nodesToCreate.push({
          query: suggestedNode.query,
          nodeData: {
            metadata: {
              // Don't include id - it will be auto-generated
              templateId: template.id,
              type: template.type || template.id || 'custom',
              title: template.title || suggestedNode.query || 'Untitled Node',
              subtitle: template.subtitle,
              description: template.description,
              icon: template.icon,
              variant: template.variant,
              shape: template.shape,
              size: template.size,
              category: template.category,
              subcategory: template.subcategory,
              inputs,
              outputs,
              properties: template.properties || {},
              requiredEnvVars: template.requiredEnvVars || [],
              propertyRules: template.propertyRules,
              propertyValues: {}, // Empty initially
              tags: template.tags || [],
              version: template.version || '1.0.0'
            },
            position: suggestedNode.position
          }
        })
      }
      
      console.log(`[CreateNodes] Batch creating ${nodesToCreate.length} nodes`)
      
      // Use batch API to create all nodes at once
      const result = await this.mcpClient.callTool(
        'embed_orchestrator',
        'add_nodes_batch' as any,
        {
          apiKey: this.apiKey,
          workflowId: context.workflowId,
          graphId: context.graphId || 'main',
          nodes: nodesToCreate.map(n => n.nodeData),
          useCRDT: true
        }
      )
      
      const response = JSON.parse(result)
      console.log(`[CreateNodes] Batch response:`, JSON.stringify(response, null, 2))
      
      const nodeResults: any[] = []
      if (response.success && response.data?.nodes) {
        // Map created nodes back to their queries
        response.data.nodes.forEach((node: any, index: number) => {
          if (index < nodesToCreate.length) {
            const query = nodesToCreate[index].query
            nodeMap.set(query, node.id)
            nodeResults.push({
              success: true,
              node: node,
              nodeId: node.id
            })
            console.log(`[CreateNodes] Mapped node ${node.id} to query: ${query}`)
          }
        })
      } else {
        console.error(`[CreateNodes] Failed to batch create nodes:`, response)
      }
      const successfulNodes = nodeResults.filter(r => r !== null)
      
      context.nodeMap = nodeMap
      
      // Store nodes with their correct IDs
      const createdNodes = successfulNodes.map(r => {
        console.log(`[CreateNodes] Created node with ID: ${r.nodeId}`)
        return r.node || { id: r.nodeId }
      })
      context.existingNodes.push(...createdNodes)
      
      // Next, create connections
      return {
        success: true,
        nextState: StateType.CONNECT_NODES,
        output: {
          nodesCreated: successfulNodes.length,
          nodeIds: Array.from(nodeMap.values())
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error
      }
    }
  }
}

/**
 * Create connections between nodes
 */
export class ConnectNodesHandler implements StateHandler {
  constructor(
    private mcpClient: any,
    private apiKey: string
  ) {}
  
  async execute(context: StateContext, input: string): Promise<StateExecutionResult> {
    try {
      const intent = context.intent!
      const connections = []
      
      // Create connections based on intent
      for (const suggestedConn of intent.suggestedConnections || []) {
        const sourceQuery = intent.suggestedNodes[suggestedConn.fromNode]?.query
        const targetQuery = intent.suggestedNodes[suggestedConn.toNode]?.query
        
        if (!sourceQuery || !targetQuery) continue
        
        const sourceNodeId = context.nodeMap.get(sourceQuery)
        const targetNodeId = context.nodeMap.get(targetQuery)
        
        if (!sourceNodeId || !targetNodeId) continue
        
        const result = await this.mcpClient.callTool(
          'embed_orchestrator',
          'connect_nodes' as any,
          {
            apiKey: this.apiKey,
            workflowId: context.workflowId,
            graphId: context.graphId,
            sourceNodeId,
            sourcePortId: suggestedConn.fromPort || 'output',
            targetNodeId,
            targetPortId: suggestedConn.toPort || 'input',
            useCRDT: true
          }
        )
        
        const response = JSON.parse(result)
        if (response.success) {
          connections.push(response.connection)
        }
      }
      
      context.existingConnections = connections
      
      // Check if we need to create groups
      if (intent.suggestedGroups && intent.suggestedGroups.length > 0) {
        return {
          success: true,
          nextState: StateType.CREATE_GROUPS,
          output: {
            connectionsCreated: connections.length
          }
        }
      }
      
      // Otherwise, evaluate the workflow
      return {
        success: true,
        nextState: StateType.EVALUATE_WORKFLOW,
        output: {
          connectionsCreated: connections.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error
      }
    }
  }
}

/**
 * Evaluate workflow for completeness and issues
 */
export class EvaluateWorkflowHandler implements StateHandler {
  constructor(
    private llmService: any
  ) {}
  
  async execute(context: StateContext, input: string): Promise<StateExecutionResult> {
    try {
      // Analyze workflow for issues
      const issues = []
      
      // Check for disconnected nodes
      const connectedNodeIds = new Set<string>()
      context.existingConnections.forEach(conn => {
        connectedNodeIds.add(conn.source.nodeId)
        connectedNodeIds.add(conn.target.nodeId)
      })
      
      const disconnectedNodes = context.existingNodes.filter(node => 
        !connectedNodeIds.has(node.id) && context.existingNodes.length > 1
      )
      
      if (disconnectedNodes.length > 0) {
        issues.push({
          type: 'disconnected_nodes',
          nodes: disconnectedNodes.map(n => ({
            id: n.id,
            title: n.metadata?.title || n.metadata?.type
          }))
        })
      }
      
      // Use LLM to evaluate what properties need configuration
      const missingProperties = await this.evaluatePropertiesWithLLM(
        context.existingNodes,
        context.originalRequest || input
      )
      
      context.evaluationResult = {
        hasIssues: issues.length > 0 || missingProperties.length > 0,
        issues,
        missingProperties,
        fixes: []
      }
      
      // Decide next state
      if (missingProperties.length > 0) {
        context.pendingQuestions = missingProperties
        return {
          success: true,
          nextState: StateType.COLLECT_PROPERTIES,
          output: context.evaluationResult
        }
      } else if (issues.length > 0) {
        // Auto-fix simple issues or ask for user input
        return {
          success: true,
          nextState: StateType.HANDLE_FEEDBACK,
          output: context.evaluationResult
        }
      } else {
        // Workflow is complete
        return {
          success: true,
          nextState: StateType.GENERATE_SUMMARY,
          output: {
            workflowComplete: true
          }
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error
      }
    }
  }
  
  private async evaluatePropertiesWithLLM(
    nodes: any[],
    userRequest: string
  ): Promise<PropertyQuestion[]> {
    try {
      const EVALUATION_PROMPT = `You are an intelligent workflow configuration assistant. Analyze the workflow nodes and determine what properties need user configuration.

CRITICAL RULES:
1. ONLY ask for properties that are ESSENTIAL for the workflow to function
2. DON'T ask for properties that have sensible defaults already set
3. DON'T ask for optional cosmetic properties (colors, icons, descriptions)
4. DO ask for critical configuration like:
   - API endpoints and authentication tokens
   - Database connection strings and queries
   - File paths and formats
   - Time intervals and schedules
   - Critical business logic parameters
5. Consider the user's request to understand what's important

User's Request: "${userRequest}"

Workflow Nodes:
${JSON.stringify(nodes.map(n => ({
  id: n.id,
  title: n.metadata?.title,
  type: n.metadata?.type,
  properties: n.metadata?.properties,
  currentValues: n.metadata?.propertyValues || {}
})), null, 2)}

For each property that needs configuration, analyze:
1. Is this property REQUIRED for the node to work?
2. Does it already have a value set?
3. Can we infer a reasonable default from context?
4. Would the workflow fail without this configuration?

Generate smart, contextual questions that help the user understand what value to provide.

Respond with ONLY a JSON array of questions (empty array if nothing needed):
[
  {
    "nodeId": "node-id",
    "nodeTitle": "Human-friendly node name",
    "propertyName": "property-key",
    "propertyType": "text|number|url|code|boolean|cron",
    "question": "Natural, helpful question about what value is needed",
    "example": "Optional example value to guide the user",
    "required": true,
    "reason": "Why this is important for the workflow"
  }
]`

      const response = await this.llmService.call({
        messages: [
          {
            role: 'system',
            content: 'You are an expert at understanding workflow requirements. Respond with valid JSON only.'
          },
          {
            role: 'user',
            content: EVALUATION_PROMPT
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
      
      // Parse response
      let cleanContent = response.content.trim()
      
      // Remove markdown if present
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      
      // Find JSON array
      const firstBracket = cleanContent.indexOf('[')
      const lastBracket = cleanContent.lastIndexOf(']')
      
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        cleanContent = cleanContent.substring(firstBracket, lastBracket + 1)
      }
      
      const questions = JSON.parse(cleanContent)
      
      // Validate and format questions
      return questions.map((q: any) => ({
        nodeId: q.nodeId,
        nodeTitle: q.nodeTitle,
        propertyName: q.propertyName,
        propertyType: q.propertyType || 'text',
        question: q.question,
        required: q.required !== false,
        suggestedValue: q.example
      }))
      
    } catch (error) {
      console.error('[EvaluateWorkflow] Failed to evaluate properties with LLM:', error)
      // Fallback to empty array if LLM evaluation fails
      return []
    }
  }
}

/**
 * Collect property values from user
 */
export class CollectPropertiesHandler implements StateHandler {
  async execute(context: StateContext, input: string): Promise<StateExecutionResult> {
    // This state would typically wait for user input
    // The actual collection happens through the streaming response
    
    return {
      success: true,
      nextState: StateType.UPDATE_PROPERTIES, // Will transition after user provides values
      output: {
        questionsAsked: context.pendingQuestions.length
      },
      shouldYield: true,
      yieldValue: {
        type: 'question',
        content: 'Please provide values for the following properties:',
        questions: context.pendingQuestions
      }
    }
  }
}

/**
 * Update node properties with collected values
 */
export class UpdatePropertiesHandler implements StateHandler {
  constructor(
    private mcpClient: any,
    private apiKey: string
  ) {}
  
  async execute(context: StateContext, input: string): Promise<StateExecutionResult> {
    try {
      // Parse property values from input
      const propertyUpdates = this.parsePropertyValues(input, context.pendingQuestions)
      
      // Update each node's properties
      const updatePromises = []
      for (const [nodeId, properties] of propertyUpdates.entries()) {
        updatePromises.push(
          this.mcpClient.callTool(
            'embed_orchestrator',
            'update_node_properties' as any,
            {
              apiKey: this.apiKey,
              workflowId: context.workflowId,
              graphId: context.graphId,
              nodeId,
              propertyValues: properties,
              useCRDT: true
            }
          )
        )
      }
      
      await Promise.all(updatePromises)
      
      // Clear pending questions
      context.pendingQuestions = []
      
      // Re-evaluate workflow
      return {
        success: true,
        nextState: StateType.EVALUATE_WORKFLOW,
        output: {
          propertiesUpdated: updatePromises.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error
      }
    }
  }
  
  private parsePropertyValues(input: string, questions: PropertyQuestion[]): Map<string, any> {
    const updates = new Map<string, any>()
    
    // First check if the executor already extracted values
    // The executor's executeCollectAction may have already parsed structured input
    
    // Try parsing as JSON first
    try {
      const parsed = JSON.parse(input)
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        // If it's a structured object with nodeId keys
        for (const [nodeId, values] of Object.entries(parsed)) {
          if (typeof values === 'object') {
            updates.set(nodeId, values)
          }
        }
        if (updates.size > 0) {
          return updates
        }
      }
    } catch {
      // Not JSON, continue with other parsing methods
    }
    
    // Parse input for direct answers
    const lines = input.split('\n').map(line => line.trim()).filter(Boolean)
    
    // If single line answer and single question, assume it's the answer
    if (lines.length === 1 && questions.length === 1) {
      const question = questions[0]
      const value = this.convertValue(lines[0], question.propertyType)
      updates.set(question.nodeId, { [question.propertyName]: value })
      return updates
    }
    
    // Try to match answers to questions
    questions.forEach((question, index) => {
      let nodeProperties = updates.get(question.nodeId) || {}
      
      // Try to find value in the input using flexible patterns
      const patterns = [
        // Direct property assignment
        new RegExp(`${question.propertyName}\\s*[:=]\\s*(.+)`, 'i'),
        // Node-qualified property
        new RegExp(`${question.nodeTitle}.*${question.propertyName}\\s*[:=]\\s*(.+)`, 'i'),
        // Quoted answers
        new RegExp(`["']?${question.propertyName}["']?\\s*[:=]\\s*["']?(.+?)["']?$`, 'i')
      ]
      
      for (const line of lines) {
        for (const pattern of patterns) {
          const match = line.match(pattern)
          if (match) {
            const value = this.convertValue(match[1].trim(), question.propertyType)
            nodeProperties[question.propertyName] = value
            updates.set(question.nodeId, nodeProperties)
            return
          }
        }
      }
      
      // If no pattern match and we have a line at this index, assume it's the answer
      // This handles simple ordered responses
      if (index < lines.length && !nodeProperties[question.propertyName]) {
        const value = this.convertValue(lines[index], question.propertyType)
        nodeProperties[question.propertyName] = value
        updates.set(question.nodeId, nodeProperties)
      }
    })
    
    return updates
  }
  
  private convertValue(value: string, type: string): any {
    // Remove surrounding quotes if present
    value = value.replace(/^["']|["']$/g, '').trim()
    
    switch (type) {
      case 'number':
        return parseFloat(value)
      case 'boolean':
        return value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
      case 'code':
      case 'code-editor':
        // For code, preserve the original formatting
        return value
      case 'url':
        // Ensure URL is properly formatted
        return value.startsWith('http') || value.startsWith('/') ? value : `https://${value}`
      case 'cron':
        // Return cron expression as-is
        return value
      default:
        return value
    }
  }
}

/**
 * Handle user feedback about the workflow
 */
export class HandleFeedbackHandler implements StateHandler {
  constructor(
    private llmService: any
  ) {}
  
  async execute(context: StateContext, input: string): Promise<StateExecutionResult> {
    try {
      // Analyze feedback and determine action
      const feedbackAnalysis = await this.llmService.call({
        messages: [
          {
            role: 'system',
            content: MODIFICATION_INTERPRETATION_PROMPT
          },
          {
            role: 'user',
            content: JSON.stringify({
              feedback: input,
              currentWorkflow: {
                nodes: context.existingNodes,
                connections: context.existingConnections
              }
            })
          }
        ],
        temperature: 0.3
      })
      
      const interpretation = JSON.parse(feedbackAnalysis.content)
      
      // Route to appropriate state based on feedback
      if (interpretation.needsClarification) {
        return {
          success: true,
          nextState: StateType.CLARIFY_INTENT,
          output: interpretation,
          shouldYield: true,
          yieldValue: {
            type: 'message',
            content: interpretation.clarificationMessage
          }
        }
      }
      
      // Execute modifications
      if (interpretation.actions && interpretation.actions.length > 0) {
        // Store actions in context for execution
        context.dynamicContext.set('pendingActions', interpretation.actions)
        return {
          success: true,
          nextState: StateType.EXECUTE_MODIFICATION,
          output: interpretation
        }
      }
      
      return {
        success: true,
        nextState: StateType.EVALUATE_WORKFLOW,
        output: interpretation
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error
      }
    }
  }
}

/**
 * Generate workflow summary
 */
export class GenerateSummaryHandler implements StateHandler {
  async execute(context: StateContext, input: string): Promise<StateExecutionResult> {
    const summary = {
      workflowId: context.workflowId,
      name: context.workflowName || context.intent?.suggestedName,
      nodeCount: context.existingNodes.length,
      connectionCount: context.existingConnections.length,
      groupCount: context.existingGroups.length,
      hasIssues: context.evaluationResult?.hasIssues || false
    }
    
    return {
      success: true,
      nextState: StateType.COMPLETE,
      output: summary,
      shouldYield: true,
      yieldValue: {
        type: 'complete',
        content: `Workflow "${summary.name}" created successfully with ${summary.nodeCount} nodes and ${summary.connectionCount} connections.`,
        workflowId: context.workflowId
      }
    }
  }
}

/**
 * Factory to create state handlers
 */
export class StateHandlerFactory {
  private handlers = new Map<StateType, StateHandler>()
  
  constructor(
    private mcpClient: any,
    private llmService: any,
    private apiKey: string
  ) {
    // Register all handlers
    this.handlers.set(StateType.ANALYZE_CONTEXT, new AnalyzeContextHandler(mcpClient, apiKey))
    this.handlers.set(StateType.DETECT_INTENT, new DetectIntentHandler(llmService))
    this.handlers.set(StateType.SEARCH_TEMPLATES, new SearchTemplatesHandler(mcpClient))
    this.handlers.set(StateType.CREATE_NODES, new CreateNodesHandler(mcpClient, apiKey))
    this.handlers.set(StateType.CONNECT_NODES, new ConnectNodesHandler(mcpClient, apiKey))
    this.handlers.set(StateType.EVALUATE_WORKFLOW, new EvaluateWorkflowHandler(llmService))
    this.handlers.set(StateType.COLLECT_PROPERTIES, new CollectPropertiesHandler())
    this.handlers.set(StateType.UPDATE_PROPERTIES, new UpdatePropertiesHandler(mcpClient, apiKey))
    this.handlers.set(StateType.HANDLE_FEEDBACK, new HandleFeedbackHandler(llmService))
    this.handlers.set(StateType.GENERATE_SUMMARY, new GenerateSummaryHandler())
  }
  
  getHandler(stateType: StateType): StateHandler | undefined {
    return this.handlers.get(stateType)
  }
}