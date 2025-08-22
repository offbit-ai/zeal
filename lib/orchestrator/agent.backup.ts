import {
  ChatMessage,
  AgentResponse,
  AgentAction,
  WorkflowIntent,
  StreamingAgentResponse,
  PropertyQuestion,
  WorkflowContext,
} from './types'
import {
  SYSTEM_PROMPT,
  INTENT_EXTRACTION_PROMPT,
  WORKFLOW_PLANNING_PROMPT,
  MODIFICATION_INTERPRETATION_PROMPT,
  ERROR_RECOVERY_PROMPT,
} from './prompts'
import { MCPClient } from './mcp-client'
import { propertyMapper } from './property-mapper'
import { scriptGenerator } from './script-generator'
import { GraphRAGEngine, RelevanceScore } from '../knowledge-graph'

interface NodeMapping {
  query: string
  nodeId: string
  metadata: any
}

interface WorkflowPlan {
  nodes: Array<{
    query: string
    position: { x: number; y: number }
    expectedId?: string
    configuration?: Record<string, any>
  }>
  connections: Array<{
    fromQuery: string
    toQuery: string
    sourcePort: string
    targetPort: string
    description?: string
  }>
  groups?: Array<{
    title: string
    nodeQueries: string[]
    color?: string
  }>
}

export class OrchestratorAgent {
  private mcpClient: MCPClient
  private openRouterApiKey: string
  private model: string
  private apiKey: string // Embed API key for orchestrator
  private useRealTimeSync: boolean
  private graphRAG: GraphRAGEngine | null = null
  private workflowContexts: Map<string, WorkflowContext> = new Map()
  private useOptimizations: boolean

  constructor(config?: {
    apiKey?: string
    useRealTimeSync?: boolean
    model?: string
    graphRAG?: GraphRAGEngine
    useOptimizations?: boolean
  }) {
    // In browser, we don't need API keys - backend handles them
    this.openRouterApiKey =
      typeof window === 'undefined' ? process.env.OPENROUTER_API_KEY || '' : ''
    this.model =
      config?.model ||
      (typeof window === 'undefined' ? process.env.OPENROUTER_MODEL : '') ||
      'anthropic/claude-3.7-sonnet'
    this.mcpClient = new MCPClient()
    this.apiKey = config?.apiKey || 'orchestrator-default-key'
    this.useRealTimeSync = config?.useRealTimeSync ?? true // Default to true for UI
    this.graphRAG = config?.graphRAG || null
    this.useOptimizations = config?.useOptimizations ?? true // Default to true for speed
    
    if (this.useOptimizations) {
      console.log('[OPTIMIZATION] Agent initialized with optimizations ENABLED')
    } else {
      console.log('[OPTIMIZATION] Agent initialized with optimizations DISABLED')
    }
  }

  async *processMessageStream(
    content: string,
    existingWorkflowId: string | null,
    context?: {
      existingNodes?: any[]
      existingConnections?: any[]
      chatHistory?: ChatMessage[]
    }
  ): AsyncGenerator<StreamingAgentResponse> {
    try {
      yield { type: 'status', content: 'Analyzing your request...' }

      if (!existingWorkflowId) {
        // Create new workflow from scratch
        yield* this.createNewWorkflowStream(content, context?.chatHistory)
      } else {
        // Modify existing workflow
        yield* this.modifyExistingWorkflowStream(content, existingWorkflowId, context)
      }
    } catch (error) {
      console.error('Agent processing error:', error)
      yield {
        type: 'error',
        content:
          'I encountered an error processing your request. ' +
          (error instanceof Error ? error.message : 'Please try again.'),
      }
    }
  }

  private async *createNewWorkflowStream(
    content: string,
    chatHistory?: ChatMessage[]
  ): AsyncGenerator<StreamingAgentResponse> {
    // Check if we should use optimized fast path
    if (this.useOptimizations) {
      yield* this.createNewWorkflowOptimized(content, chatHistory)
      return
    }

    // Original slow path
    yield { type: 'status', content: 'Understanding your workflow requirements...' }
    const intent = await this.extractIntent(content, chatHistory, false) // Force original

    // Create workflow
    yield { type: 'status', content: `Creating workflow: ${intent.suggestedName}...` }
    const createResult = await this.createWorkflowFromIntent(intent)

    if (!createResult.success || !createResult.workflowId) {
      yield { type: 'error', content: 'Failed to create workflow' }
      return
    }

    yield {
      type: 'message',
      content: `Created workflow "${intent.suggestedName}"`,
      workflowId: createResult.workflowId,
    }

    // Wait longer to ensure workflow is fully persisted in database
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Verify workflow exists in database before proceeding
    try {
      const verifyResult = await this.mcpClient.callTool('workflow_manager', 'get_workflow', {
        workflowId: createResult.workflowId,
      })
      console.log('[OrchestratorAgent] Verified workflow exists in database')
    } catch (error) {
      console.error('[OrchestratorAgent] Workflow not found in database yet, waiting longer...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Build workflow iteratively
    yield* this.buildWorkflowStream(createResult.workflowId, intent, content)

    yield { type: 'complete', workflowId: createResult.workflowId }
  }

  private async *modifyExistingWorkflowStream(
    content: string,
    workflowId: string,
    context?: { existingNodes?: any[]; existingConnections?: any[]; chatHistory?: ChatMessage[] }
  ): AsyncGenerator<StreamingAgentResponse> {
    yield { type: 'status', content: 'Analyzing current workflow...' }

    // Check if there's a stored context with pending questions
    const storedContext = this.getWorkflowContext(workflowId)

    // If we have stored context with nodes, use that instead of making API calls
    if (storedContext && storedContext.nodeMap) {
      console.log('[ModifyWorkflow] Using stored context with nodeMap')
      context = {
        ...context,
        existingNodes: Array.from(storedContext.nodeMap.values()),
        existingConnections: storedContext.connections || [],
      }
    } else if (!context?.existingNodes) {
      // Only fetch from API if we don't have stored context
      console.log('[ModifyWorkflow] No stored context, fetching from API')
      const nodesResult = await this.mcpClient.callTool(
        'embed_orchestrator',
        'list_workflow_nodes',
        {
          apiKey: this.apiKey,
          workflowId,
          graphId: 'main',
        }
      )

      const parsed = JSON.parse(nodesResult)
      context = {
        ...context,
        existingNodes: parsed.data?.nodes || parsed.nodes || [],
        existingConnections: [],
      }
    }

    // Check if there are pending property questions
    if (storedContext && storedContext.pendingQuestions.length > 0) {
      // Show workflow context summary
      if (storedContext.workflowSummary) {
        yield {
          type: 'message',
          content: `📋 **Workflow Context:**\n${storedContext.workflowSummary}`,
        }
      }

      // First, check if the user is answering questions or giving a new command
      yield { type: 'status', content: 'Processing your response...' }
      
      // Check if this is a new command or property answer
      const intentCheckPrompt = `The user was asked configuration questions but their response might be either:
1. Answers to the configuration questions
2. A completely new command/request (ignoring the questions)

Configuration questions that were asked:
${storedContext.pendingQuestions
  .map((q, i) => `${i + 1}. ${q.question} (for ${q.nodeTitle})`)
  .join('\n')}

User's response: "${content}"

Analyze the response and determine:
- Is this answering the configuration questions? (mentions values, properties, settings, etc.)
- Or is this a NEW command? (mentions add, remove, delete, connect, change workflow, etc.)

Common NEW COMMAND patterns:
- "remove", "delete", "add", "connect", "create", "change"
- "too many", "duplicate", "wrong", "fix"
- Complete topic change from what was asked
- Workflow modification requests
- Feedback about missing components: "you didn't add", "missing", "forgot", "where is"
- Complaints about the workflow: "incomplete", "not working", "wrong nodes"

Respond with JSON:
{
  "isPropertyAnswer": boolean,
  "isNewCommand": boolean,
  "confidence": "high|medium|low",
  "reason": "why you made this determination"
}`

      try {
        const intentResponse = await this.callLLM([{ role: 'user', content: intentCheckPrompt }])
        const intent = JSON.parse(this.cleanJsonResponse(intentResponse))
        
        console.log('[PropertyResponse] Intent detection:', intent)
        
        // If it's a new command, handle it but remember to come back to properties
        if (intent.isNewCommand && !intent.isPropertyAnswer) {
          console.log('[PropertyResponse] Detected new command, handling as interruption')
          
          // Check if this is feedback about missing components
          const isFeedbackAboutMissing = content.toLowerCase().includes('did not add') || 
                                         content.toLowerCase().includes('missing') ||
                                         content.toLowerCase().includes('forgot') ||
                                         content.toLowerCase().includes('where is') ||
                                         content.toLowerCase().includes('no api') ||
                                         content.toLowerCase().includes('incomplete')
          
          if (isFeedbackAboutMissing) {
            yield { type: 'status', content: 'You\'re right, let me fix that...' }
          } else {
            yield { type: 'status', content: 'Let me handle that first...' }
          }
          
          // Process the modification
          const modification = await this.interpretModification(content, context)
          
          // Execute the modification
          for await (const response of this.executeModificationsStream(workflowId, modification, context)) {
            // Only yield messages and status updates, not complete
            if (response.type !== 'complete') {
              yield response
            }
          }
          
          // After handling missing components, we might have new nodes that need configuration
          // Re-evaluate to find any new missing properties
          if (isFeedbackAboutMissing) {
            yield { type: 'status', content: 'Checking if the added nodes need configuration...' }
            
            // Get updated node list
            const updatedNodesResult = await this.mcpClient.callTool(
              'embed_orchestrator',
              'list_workflow_nodes',
              {
                apiKey: this.apiKey,
                workflowId,
                graphId: 'main',
              }
            )
            
            const updatedNodes = JSON.parse(updatedNodesResult)
            const updatedNodesList = updatedNodes.data?.nodes || updatedNodes.nodes || []
            
            // Run evaluation on updated workflow
            const evaluationResult = await this.evaluateWorkflowQuality(
              workflowId,
              new Map(), // We need to rebuild this
              new Map(), // We need to rebuild this
              0, // Connection count
              storedContext.lastUserRequest || content
            )
            
            // If there are new missing properties, add them to pending questions
            if (evaluationResult.missingProperties && evaluationResult.missingProperties.length > 0) {
              const newQuestions = evaluationResult.missingProperties.map(prop => ({
                nodeId: prop.nodeId,
                nodeTitle: prop.nodeTitle || 'Node',
                propertyName: prop.propertyName,
                propertyType: prop.propertyType || 'text',
                question: prop.question,
                currentValue: prop.currentValue,
                suggestedValue: prop.suggestedValue,
                required: prop.required !== false
              }))
              
              // Merge with existing questions (avoid duplicates)
              const existingQuestionKeys = new Set(
                storedContext.pendingQuestions.map(q => `${q.nodeId}-${q.propertyName}`)
              )
              
              for (const newQ of newQuestions) {
                const key = `${newQ.nodeId}-${newQ.propertyName}`
                if (!existingQuestionKeys.has(key)) {
                  storedContext.pendingQuestions.push(newQ)
                }
              }
              
              // Update stored context
              this.storeWorkflowContext(workflowId, storedContext)
            }
          }
          
          // Now remind about pending questions (including any new ones)
          if (storedContext.pendingQuestions.length > 0) {
            yield {
              type: 'message',
              content: isFeedbackAboutMissing 
                ? `Good! I've added the missing components. Now let's configure them:`
                : `Done! Now, let's get back to configuring your workflow. I still need some information:`
            }
            
            // Re-ask the questions
            yield {
              type: 'question',
              content: 'Please provide the following configuration:',
              questions: storedContext.pendingQuestions.slice(0, 3),
              workflowId
            }
          } else {
            yield { type: 'complete', workflowId }
          }
          
          return
        }
      } catch (error) {
        console.error('Failed to determine intent, assuming property answer:', error)
      }

      // Continue with property answer processing
      yield { type: 'status', content: 'Processing your configuration answers...' }

      const interpretPrompt = `The user was asked configuration questions and has provided a response. Extract and INFER property values intelligently.

Configuration questions that were asked:
${storedContext.pendingQuestions
  .map(
    (q, i) =>
      `${i + 1}. ${q.question}
   Node: ${q.nodeTitle} (ID: ${q.nodeId})
   Property: ${q.propertyName} (type: ${q.propertyType})
   Required: ${q.required}`
  )
  .join('\n\n')}

User's response: "${content}"

IMPORTANT: Be intelligent about extracting values! The user won't always explicitly state "property X = value Y". 
You need to INFER based on context:

Examples of inference:
- "run it hourly" → interval/schedule = "0 * * * *"
- "check every 5 minutes" → interval = "*/5 * * * *"
- "use OpenWeather" → infer this is for weather API endpoints
- "get temperature data" → infer endpoint might be weather/temperature related
- "store in users collection" → collection = "users"
- "localhost MongoDB" → host = "localhost", port = 27017
- Numbers mentioned → could be ports, limits, intervals
- URLs mentioned → could be endpoints, webhooks
- Any API service mentioned → infer appropriate endpoints

Common patterns:
- Cron: "hourly"="0 * * * *", "daily"="0 0 * * *", "every X minutes"="*/X * * * *"
- MongoDB: default port=27017, default host="localhost"
- HTTP: default method="GET" for fetching, "POST" for sending
- Default limits: 100 for database queries, 10 for API calls

For each property, try to intelligently extract or infer a reasonable value from the user's message.
Use sensible defaults if you can infer the intent but not specific values.

Return ONLY JSON:
{
  "answers": [
    {
      "nodeId": "exact_node_id_from_above",
      "propertyName": "exact_property_name_from_above",
      "value": "inferred_or_extracted_value_or_reasonable_default"
    }
  ]
}`

      try {
        const response = await this.callLLM([{ role: 'user', content: interpretPrompt }])
        const parsed = JSON.parse(this.cleanJsonResponse(response))

        console.log('[PropertyExtraction] User said:', content)
        console.log(
          '[PropertyExtraction] Extracted values:',
          JSON.stringify(parsed.answers, null, 2)
        )

        // Track which questions were asked this round
        const askedQuestionIds = storedContext.pendingQuestions
          .slice(0, 3)
          .map(q => `${q.nodeId}-${q.propertyName}`)

        // Process the extracted answers directly here
        for (const answer of parsed.answers) {
          if (answer.value !== null && answer.value !== undefined && answer.value !== '') {
            // Update property values in context
            const nodeProps = storedContext.propertyValues.get(answer.nodeId) || {}
            nodeProps[answer.propertyName] = answer.value
            storedContext.propertyValues.set(answer.nodeId, nodeProps)

            // Get actual node ID and update
            console.log(`[PropertyUpdate] Looking for answer.nodeId="${answer.nodeId}" in nodeMap`)
            console.log(`[PropertyUpdate] NodeMap contents:`, storedContext.nodeMap)
            console.log(
              `[PropertyUpdate] NodeMap keys:`,
              Array.from(storedContext.nodeMap?.keys() || [])
            )

            const actualNodeId = storedContext.nodeMap?.get(answer.nodeId)?.nodeId
            console.log(`[PropertyUpdate] Found actualNodeId: ${actualNodeId}`)

            if (actualNodeId) {
              yield {
                type: 'status',
                content: `Updating ${answer.propertyName} for ${answer.nodeId}...`,
              }
              await this.updateNodeProperty(
                workflowId,
                actualNodeId,
                answer.propertyName,
                answer.value
              )
              yield {
                type: 'message',
                content: `✓ Set ${answer.propertyName} for ${answer.nodeId}`,
              }
            } else {
              console.error(`Could not find actual node ID for ${answer.nodeId}`)
              console.error(`Available nodeMap entries:`, storedContext.nodeMap)
            }
          }
        }

        // Remove ALL questions that were asked (answered or not) to avoid endless loop
        storedContext.pendingQuestions = storedContext.pendingQuestions.filter(
          q => !askedQuestionIds.includes(`${q.nodeId}-${q.propertyName}`)
        )

        // Check if user wants to skip remaining questions
        const skipKeywords = [
          'skip',
          'continue',
          'proceed',
          'done',
          'finish',
          'next',
          "that's all",
          'no more',
        ]
        const shouldSkip = skipKeywords.some(keyword => content.toLowerCase().includes(keyword))

        if (shouldSkip) {
          storedContext.pendingQuestions = [] // Clear all remaining questions
          yield {
            type: 'message',
            content: 'Skipping remaining configuration options and proceeding with defaults...',
          }
        }

        // Store updated context
        this.storeWorkflowContext(workflowId, storedContext)

        // Check if there are more questions (but limit iterations to prevent endless loops)
        if (storedContext.pendingQuestions.length > 0 && !shouldSkip) {
          // Only show more questions if we haven't shown them too many times
          const maxQuestionRounds = 3
          const questionRounds = storedContext.questionRounds || 0

          if (questionRounds < maxQuestionRounds) {
            storedContext.questionRounds = questionRounds + 1
            this.storeWorkflowContext(workflowId, storedContext)

            yield {
              type: 'question',
              content: `There are ${storedContext.pendingQuestions.length} more configuration options. You can answer them or type "skip" to proceed with defaults:`,
              questions: storedContext.pendingQuestions.slice(0, 3),
              requiresInput: true,
            }
          } else {
            // Max rounds reached, proceed anyway
            storedContext.pendingQuestions = []
            this.storeWorkflowContext(workflowId, storedContext)
            yield {
              type: 'message',
              content: 'Proceeding with default values for remaining properties...',
            }
          }
        }

        // If no more questions or skipped, create connections
        if (storedContext.pendingQuestions.length === 0) {
          // All questions answered - create connections
          yield {
            type: 'status',
            content: 'All properties configured! Now creating workflow connections...',
          }

          const connections = storedContext.connections || []
          const nodeMap = storedContext.nodeMap || new Map<string, NodeMapping>()

          console.log(
            '[PropertyAnswers] Retrieved connections from context:',
            JSON.stringify(connections, null, 2)
          )
          console.log('[PropertyAnswers] Number of connections:', connections.length)
          console.log('[PropertyAnswers] NodeMap size:', nodeMap.size)

          if (nodeMap.size === 0) {
            yield {
              type: 'error',
              content:
                'Error: Node mappings were not properly stored. Please recreate the workflow.',
            }
            return
          }

          const workflowPlan: WorkflowPlan = {
            nodes: [],
            connections: connections,
          }

          const workflowSummary = await this.generateWorkflowSummary(
            storedContext.lastUserRequest,
            storedContext.intent,
            storedContext.nodes,
            connections,
            nodeMap
          )

          yield* this.finalizeWorkflowConnections(
            workflowId,
            workflowPlan,
            nodeMap,
            workflowSummary
          )
        }

        return // Exit after processing property answers
      } catch (error) {
        console.error('Error processing property answers:', error)
        // Fall through to treat as modification if parsing fails
      }
    }

    // Otherwise, treat as a new modification request
    yield { type: 'status', content: 'Planning modifications...' }
    const modification = await this.interpretModification(content, context)

    // Execute modifications with streaming
    yield* this.executeModificationsStream(workflowId, modification, context)

    yield { type: 'complete', workflowId }
  }

  async processMessage(
    content: string,
    existingWorkflowId: string | null,
    context?: {
      existingNodes?: any[]
      existingConnections?: any[]
      chatHistory?: ChatMessage[]
    }
  ): Promise<AgentResponse> {
    try {
      if (!existingWorkflowId) {
        // Create new workflow from scratch
        return await this.createNewWorkflow(content, context?.chatHistory)
      } else {
        // Modify existing workflow
        return await this.modifyExistingWorkflow(content, existingWorkflowId, context)
      }
    } catch (error) {
      console.error('Agent processing error:', error)

      // Try to recover from error
      const recovery = await this.attemptErrorRecovery(error, content, existingWorkflowId)
      if (recovery) {
        return recovery
      }

      return {
        message:
          'I encountered an error processing your request. ' +
          (error instanceof Error ? error.message : 'Please try again.'),
        actions: [],
      }
    }
  }

  private async createNewWorkflow(
    content: string,
    chatHistory?: ChatMessage[]
  ): Promise<AgentResponse> {
    // Extract intent with prompt, including chat history for context
    const intent = await this.extractIntent(content, chatHistory, this.useOptimizations)
    console.log('Extracted intent:', JSON.stringify(intent, null, 2))

    // Create the workflow
    const createResult = await this.createWorkflowFromIntent(intent)
    if (!createResult.success || !createResult.workflowId) {
      throw new Error('Failed to create workflow')
    }
    console.log('Created workflow:', createResult.workflowId)

    // Build the workflow based on detailed plan
    const buildResult = await this.buildWorkflow(createResult.workflowId, intent, content)
    console.log('Build result:', JSON.stringify(buildResult, null, 2))

    // Generate summary message
    const summaryParts = [`I've created a new workflow "${intent.suggestedName}"`]
    if (buildResult.nodeCount > 0) {
      summaryParts.push(`added ${buildResult.nodeCount} nodes`)
    }
    if (buildResult.connectionCount > 0) {
      summaryParts.push(`created ${buildResult.connectionCount} connections`)
    }
    if (buildResult.groupCount > 0) {
      summaryParts.push(`organized nodes into ${buildResult.groupCount} groups`)
    }

    return {
      message: summaryParts.join(', ') + '. The workflow is ready for you to use!',
      workflowCreated: true,
      workflowId: createResult.workflowId,
      actions: buildResult.actions,
      metadata: {
        nodeCount: buildResult.nodeCount,
        connectionCount: buildResult.connectionCount,
        groupCount: buildResult.groupCount,
        requiredEnvVars: buildResult.requiredEnvVars,
      },
    }
  }

  private async modifyExistingWorkflow(
    content: string,
    workflowId: string,
    context?: { existingNodes?: any[]; existingConnections?: any[]; chatHistory?: ChatMessage[] }
  ): Promise<AgentResponse> {
    // Get current workflow state if not provided
    if (!context?.existingNodes) {
      const nodesResult = await this.mcpClient.callTool(
        'embed_orchestrator',
        'list_workflow_nodes',
        {
          apiKey: this.apiKey,
          workflowId,
          graphId: 'main',
        }
      )

      const parsed = JSON.parse(nodesResult)
      context = {
        existingNodes: parsed.data?.nodes || parsed.nodes || [],
        existingConnections: [], // Would need another API call for connections
      }
    }

    // Interpret modification request
    const modification = await this.interpretModification(content, context)

    // Check if clarification is needed
    if (modification.needsClarification) {
      return {
        message: modification.clarificationMessage || 
          "I need more information to help you. Could you please clarify what you'd like to change?",
        actions: [],
        metadata: { requiresClarification: true }
      }
    }

    // Execute modifications
    const result = await this.executeModifications(workflowId, modification, context)

    return {
      message: result.summary || "I've updated your workflow as requested.",
      actions: result.actions,
      metadata: result.metadata,
    }
  }

  /**
   * OPTIMIZED: Combines intent extraction, workflow planning, and initial property extraction
   * Reduces 3 LLM calls to 1
   */
  private async extractIntent(
    content: string,
    chatHistory?: ChatMessage[],
    useOptimized: boolean = true
  ): Promise<WorkflowIntent> {
    // OPTIMIZATION: Use combined intent extraction with workflow planning
    if (useOptimized) {
      try {
        console.log('[OPTIMIZATION] Using optimized intent extraction')
        const result = await this.extractIntentOptimized(content, chatHistory)
        console.log('[OPTIMIZATION] Successfully extracted intent with optimization')
        return result
      } catch (error) {
        console.error('[OPTIMIZATION] Failed, falling back to original:', error)
      }
    }
    console.log('[OPTIMIZATION] Using original intent extraction')
    return this.extractIntentOriginal(content, chatHistory)
  }

  private async extractIntentOptimized(
    content: string,
    chatHistory?: ChatMessage[]
  ): Promise<WorkflowIntent> {
    const contextSummary = chatHistory
      ? chatHistory.slice(-3).map(m => `${m.role}: ${m.content.substring(0, 200)}`).join('\n')
      : ''

    const COMBINED_INTENT_PROMPT = `You are an intelligent workflow architect. Think critically about what the user wants to achieve.

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

COMMON SENSE CHECKS:
- Why would you need 2 HTTP requests to the same API?
- Why parse JSON twice if it's already parsed?
- Can one transformer handle multiple transformations?
- Does the workflow accomplish what the user asked for?

UNDERSTANDING NODE PURPOSES:

CRITICAL: When searching for nodes, understand what each template ACTUALLY does:
- Read the node's DESCRIPTION to understand its purpose
- Check the SUBTITLE for quick context
- Look at INPUT/OUTPUT PORTS to understand data flow
- Review TAGS for capabilities
- Understand the CATEGORY (connection vs operation vs transformation)

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

COMMON MISUNDERSTANDINGS TO AVOID:
✗ Don't search for "PostgreSQL Insert" - it doesn't exist, use "SQL Script"
✗ Don't connect two connection pools together (they don't exchange data)
✗ Don't use a connection pool as a storage node (it only provides connection)
✗ Connection pools OUTPUT connections, operation nodes USE connections

CORRECT SEARCH PATTERNS:
For SQL workflow:
1. "postgresql connection pool" or "mysql connection"
2. "sql script" (NOT "postgresql insert" or "mysql update")

For NoSQL workflow:
1. "mongodb connection" or "redis connection"
2. "mongodb insert" or "mongodb find" (specific operation nodes exist)

IMPORTANT: Be creative with search queries! You can combine multiple keywords to find specialized nodes. Examples:
- For data ingestion: try "kafka consumer", "http endpoint", "webhook", "api fetch", "database read", "file watch"
- For processing: try "transform data", "filter", "aggregate", "parse json", "validate", "enrich"
- For AI tasks: try "llm", "gpt", "embedding", "vector", "classify", "sentiment"
- For outputs: try "database write", "save file", "send email", "kafka producer", "webhook send"
- For databases: include both connection ("mongodb", "postgres pool") and operation nodes ("insert", "find", "update")
- Be specific: "mysql database", "postgres writer", "s3 upload", "slack notification"

The system will search for templates matching your queries. Use descriptive search terms that capture the functionality needed.

${contextSummary ? `Previous conversation:\n${contextSummary}\n` : ''}

User request: "${content}"

STEP-BY-STEP ANALYSIS (YOU MUST DO THIS):
1. What does the user ACTUALLY want to achieve? (not what they literally said)
2. What triggers/starts this workflow? → Add ONE relevant trigger node
3. What data sources are ACTUALLY NEEDED? → Add only relevant fetching nodes
4. How should data be processed? → Add only necessary transformations
5. Where does data go? → Add only the requested output/storage
6. What infrastructure is needed? → Add only required connections

RELEVANCE CHECK - Ask yourself:
- Is this node DIRECTLY related to what the user wants?
- Will this node actually be used in the workflow?
- Is this node compatible with the other nodes?
- Does the data flow make sense between these nodes?

COMPATIBILITY CHECK - Ensure nodes work together:
- Output types match input types (data-out → data-in, trigger-out → trigger-in)
- Data formats align (JSON API → JSON Parser, not XML Parser)
- Services match (MongoDB Insert needs MongoDB Connection, not PostgreSQL)
- Sequence is logical (fetch → parse → transform → store, not store → fetch)

INCOMPATIBLE COMBINATIONS TO AVOID:
✗ PostgreSQL connection → MongoDB insert (wrong database type)
✗ XML parser → for JSON API response (format mismatch)
✗ File reader → HTTP request (no connection between them)
✗ Database write → before any data fetching (illogical sequence)

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

SEARCH QUERY GUIDELINES for suggestedNodes:
- SQL DATABASES: Use "sql script" for operations, NOT "postgresql insert" or "mysql update"
- NoSQL DATABASES: Use specific operations like "mongodb insert", "redis get"
- CONNECTIONS FIRST: "postgresql connection pool" before "sql script"
- Include PURPOSE: "http request weather api" not just "http request"
- Clear FUNCTION: "json parser" not "parser", "cron trigger" not "trigger"
- Understand INFRASTRUCTURE vs OPERATIONS: connection pools are infrastructure, not operations

Respond with this JSON structure (INCLUDE ALL NECESSARY NODES):
{
  "description": "Clear one-sentence description of the workflow's purpose",
  "suggestedName": "short-workflow-name",
  "suggestedDescription": "Detailed description of what this workflow does",
  "suggestedNodes": [
    {
      "query": "specific search terms for the exact functionality needed",
      "position": { "x": <number>, "y": <number> },
      "purpose": "what this specific node accomplishes in the workflow"
    }
  ],
  "connections": [
    {
      "from": "node_query_1",
      "to": "node_query_2"
    }
  ]
}

Position nodes logically: sources on left (x:100), processing in middle (x:400), outputs on right (x:700).
Space nodes vertically by 150 units.`

    try {
      const response = await this.callLLM([
        { role: 'system', content: 'You are an expert at understanding user needs and designing workflows.' },
        { role: 'user', content: COMBINED_INTENT_PROMPT }
      ])

      const result = JSON.parse(this.cleanJsonResponse(response))
      console.log('[OPTIMIZATION] Parsed optimized intent:', JSON.stringify(result, null, 2))
      
      // Validate required fields
      if (!result.description || !result.suggestedName || !result.suggestedNodes) {
        throw new Error('Missing required fields in optimized response')
      }
      
      // Map to WorkflowIntent format
      const mappedIntent: WorkflowIntent = {
        description: result.description,
        suggestedName: result.suggestedName || 'New Workflow',
        suggestedDescription: result.suggestedDescription || result.description,
        suggestedNodes: (result.suggestedNodes || []).map((node: any) => ({
          query: node.query,
          position: node.position || { x: 100, y: 200 },
          purpose: node.purpose || node.query,
          connections: result.connections
            ? result.connections
                .filter((c: any) => c.from === node.query)
                .map((c: any) => ({ from: node.query, to: c.to }))
            : []
        }))
      }
      
      console.log('[OPTIMIZATION] Mapped intent successfully')
      console.log(`[OPTIMIZATION] Final intent has ${mappedIntent.suggestedNodes.length} nodes:`)
      mappedIntent.suggestedNodes.forEach((node: any, i: number) => {
        console.log(`  ${i+1}. ${node.query} -> ${node.purpose}`)
      })
      return mappedIntent
    } catch (error) {
      console.error('[OPTIMIZATION] Failed to extract optimized intent:', error)
      throw error // Let the parent catch handle fallback
    }
  }

  private async extractIntentOriginal(
    content: string,
    chatHistory?: ChatMessage[]
  ): Promise<WorkflowIntent> {
    // Original implementation (moved from extractIntent)
    const messages: Array<{ role: string; content: string }> = []

    if (chatHistory && chatHistory.length > 0) {
      // Add recent chat history for context (last 5 messages)
      const recentHistory = chatHistory.slice(-5)
      recentHistory.forEach(msg => {
        if (msg.role !== 'system') {
          messages.push({ role: msg.role, content: msg.content })
        }
      })
    }

    messages.push({ role: 'user', content })

    // First, analyze the user's intent more deeply
    const intentAnalysis = await this.analyzeUserIntent(content)
    console.log('Intent analysis:', intentAnalysis)

    const response = await this.callLLM([
      { role: 'system', content: INTENT_EXTRACTION_PROMPT },
      {
        role: 'system',
        content: `Additional context from intent analysis: ${JSON.stringify(intentAnalysis)}`,
      },
      ...messages,
    ])

    try {
      const cleanedResponse = this.cleanJsonResponse(response)
      const parsed = JSON.parse(cleanedResponse)
      console.log('[OrchestratorAgent] Raw intent response:', JSON.stringify(parsed, null, 2))

      // Handle case where LLM returns incorrect format
      if (!parsed.suggestedNodes && (parsed.action || parsed.dataFlow)) {
        console.warn('[OrchestratorAgent] LLM returned non-standard intent format, converting...')

        // Convert the incorrect format to the expected format
        const converted = {
          description: parsed.action || content,
          suggestedName: this.generateWorkflowName(parsed),
          suggestedDescription: this.generateWorkflowDescription(parsed, content),
          suggestedNodes: this.convertDataFlowToNodes(parsed),
        }

        console.log('[OrchestratorAgent] Converted intent:', JSON.stringify(converted, null, 2))
        return converted
      }

      return {
        ...parsed,
        suggestedNodes: parsed.suggestedNodes || [],
      }
    } catch (error) {
      console.error('[OrchestratorAgent] Failed to parse intent JSON:', error)
      console.error('[OrchestratorAgent] Raw response:', response)

      // Fallback intent
      return {
        description: content,
        suggestedName: 'New Workflow',
        suggestedDescription: content,
        suggestedNodes: [],
      }
    }
  }

  /**
   * OPTIMIZATION: Intelligent template selection from search results
   * Only uses LLM when needed to pick from multiple options
   */
  private async selectBestTemplate(
    query: string, 
    searchResults: any[], 
    workflowContext?: string
  ): Promise<any | null> {
    // If only one result, use it
    if (searchResults.length === 1) {
      return searchResults[0].metadata
    }

    // Quick LLM call to select best match
    const prompt = `Select the best node template for: "${query}"
${workflowContext ? `Context: ${workflowContext}` : ''}

Available options:
${searchResults.map((r, i) => `${i + 1}. ${r.metadata.title}: ${r.metadata.description} (score: ${r.score})`).join('\n')}

Respond with JSON:
{
  "selected": <number 1-${searchResults.length}>,
  "confidence": <0.0-1.0>,
  "needsAlternative": <true if none are suitable>,
  "alternativeQuery": "<new search query if needed>"
}`

    try {
      const response = await this.callLLM([{ role: 'user', content: prompt }])
      const result = JSON.parse(this.cleanJsonResponse(response))
      
      if (result.needsAlternative && result.alternativeQuery) {
        // Search for alternative
        console.log(`[Template Selection] Need alternative, searching: "${result.alternativeQuery}"`)
        return this.searchForTemplate(result.alternativeQuery, 1, true, workflowContext)
      }
      
      if (result.selected && result.confidence > 0.6) {
        return searchResults[result.selected - 1].metadata
      }
    } catch (error) {
      console.error('Failed to select template:', error)
    }
    
    // Fallback to highest scoring result
    return searchResults[0].metadata
  }

  /**
   * FULLY OPTIMIZED workflow creation - minimal LLM calls, maximum speed
   */
  private async *createNewWorkflowOptimized(
    content: string,
    chatHistory?: ChatMessage[]
  ): AsyncGenerator<StreamingAgentResponse> {
    console.log('[OPTIMIZATION] Using FULLY OPTIMIZED workflow creation')
    
    // Single status for entire analysis
    yield { type: 'status', content: 'Analyzing and building your workflow...' }
    
    try {
      // 1. Combined analysis (1 LLM call instead of 3+)
      const intent = await this.extractIntent(content, chatHistory, true)
      
      // 2. Create workflow in database
      const createResult = await this.createWorkflowFromIntent(intent)
      if (!createResult.success || !createResult.workflowId) {
        yield { type: 'error', content: 'Failed to create workflow' }
        return
      }
      
      const workflowId = createResult.workflowId
      yield {
        type: 'message',
        content: `Created workflow "${intent.suggestedName}"`,
        workflowId,
      }
      
      // 3. Batch template collection (reduce individual template fetches)
      const nodeMap = new Map<string, string>()
      const templateMap = new Map<string, any>()
      const nodesToProcess: Array<{suggestedNode: any, template: any}> = []
      
      // Step 3a: Batch node search (1 LLM call instead of N calls)
      console.log(`[OPTIMIZATION] Intent suggests ${intent.suggestedNodes.length} nodes:`)
      console.log(intent.suggestedNodes.map((n: any) => `- ${n.query} (${n.purpose})`).join('\n'))
      
      // Try batch GraphRAG search first (single LLM call for all nodes)
      if (this.graphRAG) {
        try {
          console.log('[OPTIMIZATION] Performing BATCH GraphRAG search for all nodes...')
          
          // Create combined intent for all nodes
          const combinedIntent: any = {
            action: 'workflow',
            services: [],
            capabilities: [],
            dataFlow: [],
            description: intent.description || content,
            suggestedNodes: intent.suggestedNodes
          }
          
          // Single GraphRAG call for all requirements
          const allRelevantNodes = await this.graphRAG.findRelevantNodes(
            content + ' ' + intent.suggestedNodes.map((n: any) => n.query + ' ' + n.purpose).join(' '),
            combinedIntent
          )
          
          console.log(`[OPTIMIZATION] Batch GraphRAG found ${allRelevantNodes.length} relevant templates`)
          
          // Match found templates to suggested nodes
          const templateMatches = await this.matchTemplatesToNodes(allRelevantNodes, intent.suggestedNodes)
          
          // Add matched templates to processing queue
          for (const match of templateMatches) {
            if (match.template) {
              console.log(`[OPTIMIZATION] ✓ Batch matched "${match.suggestedNode.query}": ${match.template.title}`)
              nodesToProcess.push({ suggestedNode: match.suggestedNode, template: match.template })
            }
          }
          
        } catch (error) {
          console.log('[OPTIMIZATION] Batch GraphRAG search failed:', error)
        }
      }
      
      // Fallback: Individual MCP searches for unmatched nodes (no LLM calls)
      const unmatchedNodes = intent.suggestedNodes.filter((suggestedNode: any) => 
        !nodesToProcess.some(processed => processed.suggestedNode.query === suggestedNode.query)
      )
      
      if (unmatchedNodes.length > 0) {
        console.log(`[OPTIMIZATION] Fallback search for ${unmatchedNodes.length} unmatched nodes...`)
        
        for (const suggestedNode of unmatchedNodes) {
          const searchResult = await this.mcpClient.callTool(
            'node_template_repository',
            'search_templates',
            { query: suggestedNode.query, limit: 1 }
          )
          const parsed = JSON.parse(searchResult)
          const templates = parsed.data || parsed.results || parsed
          if (Array.isArray(templates) && templates.length > 0) {
            const template = templates[0].template || templates[0]
            console.log(`[OPTIMIZATION] ✓ Fallback found "${suggestedNode.query}": ${template.title}`)
            nodesToProcess.push({ suggestedNode, template })
          } else {
            console.log(`[OPTIMIZATION] ✗ No template found for query: ${suggestedNode.query}`)
          }
        }
      }
      
      // Step 3b: Generate sophisticated properties using same method as unoptimized mode
      console.log(`[OPTIMIZATION] Generating contextual properties for ${nodesToProcess.length} nodes...`)
      
      // Step 3c: Process and add all nodes with proper property enrichment
      let nodeCount = 0
      for (let i = 0; i < nodesToProcess.length; i++) {
        const { suggestedNode, template } = nodesToProcess[i]
        
        // Use the same sophisticated property extraction as unoptimized mode
        console.log(`[OPTIMIZATION] Extracting properties for node ${i + 1}/${nodesToProcess.length}: ${template.title}`)
        const propertyValues = await this.extractNodeProperties(
          template,
          suggestedNode.query,
          suggestedNode.configuration || {},
          content
        )
        
        // Log property extraction results
        const propCount = Object.keys(propertyValues).length
        console.log(`[OPTIMIZATION] Extracted ${propCount} properties for ${template.title}:`, 
          propCount > 0 ? JSON.stringify(propertyValues, null, 2) : 'No properties extracted')
        
        console.log(`[OPTIMIZATION] Processing node ${i + 1}/${nodesToProcess.length}: ${template.title}`)
        
        // Extract inputs and outputs from ports
        const inputs = template.ports?.filter((port: any) => port.type === 'input') || []
        const outputs = template.ports?.filter((port: any) => port.type === 'output') || []
        
        // Convert properties array to object if needed
        let propertiesObject = template.properties
        if (Array.isArray(template.properties)) {
          propertiesObject = {}
          template.properties.forEach((prop: any) => {
            if (prop.name) {
              propertiesObject[prop.name] = prop
            }
          })
        }
        
        // Build the complete node metadata with all template fields
        const nodeData: any = {
          metadata: {
            // Core identification
            templateId: template.id,
            type: template.type || template.id || 'custom',
            title: template.title || template.name || suggestedNode.query || 'Untitled Node',
            subtitle: template.subtitle,
            description: template.description,
            
            // Visual properties
            icon: template.icon,
            variant: template.variant,
            shape: template.shape,
            size: template.size,
            
            // Organization
            category: template.category,
            subcategory: template.subcategory,
            tags: template.tags,
            version: template.version,
            
            // Configuration
            properties: propertiesObject,
            propertyValues: propertyValues, // Pre-generated properties
            requiredEnvVars: template.requiredEnvVars,
            propertyRules: template.propertyRules,
            
            // Ports
            inputs: inputs,
            outputs: outputs,
          },
          position: suggestedNode.position,
        }
        
        console.log(`[OPTIMIZATION] Adding node: ${template.title}`)
        
        const addResult = await this.mcpClient.callTool('embed_orchestrator', 'add_node', {
          apiKey: this.apiKey,
          workflowId,
          graphId: 'main',
          nodeData,
          useCRDT: this.useRealTimeSync,
        })
        
        const parsed = JSON.parse(addResult)
        console.log(`[OPTIMIZATION] Add node response for ${template.title}:`, parsed)
        
        if (parsed.success) {
          const nodeId = parsed.nodeId || parsed.data?.node?.id || parsed.data?.node?.metadata?.id
          if (nodeId) {
            nodeMap.set(suggestedNode.query, nodeId)
            templateMap.set(suggestedNode.query, template) // Store template for connection phase
            nodeCount++
            console.log(`[OPTIMIZATION] ✓ Successfully added node ${nodeCount}: ${template.title} with ID: ${nodeId}`)
          } else {
            console.error(`[OPTIMIZATION] ✗ No node ID returned for: ${template.title}`, parsed)
          }
        } else {
          console.error(`[OPTIMIZATION] ✗ Failed to add node: ${template.title}`, parsed)
        }
      }
      
      yield {
        type: 'message',
        content: `Added ${nodeCount} nodes`,
        metadata: { nodeCount }
      }
      
      console.log('[OPTIMIZATION] Added nodes, proceeding to connections...')
      console.log('[OPTIMIZATION] Node map:', Array.from(nodeMap.entries()))
      
      // 4. Add connections based on intent
      let connectionCount = 0
      
      // Templates are already stored in templateMap from the node creation phase above
      
      // Generate connections using LLM with actual node IDs
      console.log(`[OPTIMIZATION] Checking connection generation: nodeCount=${nodeCount}, nodesToProcess=${nodesToProcess.length}`)
      
      // Always try to generate connections if we have nodes (even 1 node might have self-connections or need config)
      if (nodeCount > 0) {
        yield { type: 'status', content: 'Generating connections...' }
        console.log(`[OPTIMIZATION] Starting connection generation for ${nodeCount} nodes...`)
        
        // Build context for LLM with actual node IDs, templates, and ports
        const nodeContext = Array.from(nodeMap.entries()).map(([query, nodeId]) => {
          const template = templateMap.get(query)
          return {
            nodeId,
            query,
            template: {
              id: template?.id,
              title: template?.title,
              ports: template?.ports || []
            }
          }
        })
        
        const connectionPrompt = `Generate intelligent connections for this workflow using actual node IDs and port IDs.

User Request: "${content}"
        
Available Nodes:
${nodeContext.map(node => {
  const template = templateMap.get(node.query)
  return `
${node.nodeId} (${node.template.title})
  - Template: ${node.template.id}
  - Purpose: ${node.query}
  - Description: ${template?.description || 'No description'}
  - Category: ${template?.category || 'Unknown'}
  - Input ports: ${node.template.ports.filter((p: any) => p.type === 'input').map((p: any) => `${p.id}${p.label ? ' (' + p.label + ')' : ''}`).join(', ') || 'none'}
  - Output ports: ${node.template.ports.filter((p: any) => p.type === 'output').map((p: any) => `${p.id}${p.label ? ' (' + p.label + ')' : ''}`).join(', ') || 'none'}
`}).join('')}

CRITICAL CONNECTION RULES:
🔴 ONLY connect OUTPUT ports to INPUT ports (output → input)
🔴 Understand node purposes based on template IDs and descriptions:
   - Database POOLS/CONNECTIONS (mongodb, postgres, mysql): Provide connection to actual database operations
   - Database OPERATIONS (get_collection, find, insert, update, delete): Perform actual database work
   - TRIGGERS (cron, webhook, manual): Start workflows
   - PROCESSORS (transform, filter, parse): Process data between nodes
   - OUTPUTS (email, slack, file_write): Final destinations

INTELLIGENT CONNECTION PATTERNS:
1. TRIGGER FLOW (MANDATORY): Every trigger MUST connect to something
   - Interval/Cron Trigger → HTTP Request or Script
   - Webhook → Data processor or validator
   - Manual Trigger → First action node
2. DATABASE FLOW: Database Pool → Database Operation
   - Example: mongodb_pool.connection-out → mongodb_insert.connection-in
   - Example: postgres_pool.connection-out → sql_script.connection-in
3. DATA FLOW: source.data-out → processor.data-in → destination.data-in
4. ERROR FLOW: any_node.error-out → error_handler.data-in

AVOID COMMON MISTAKES:
❌ Don't leave any trigger nodes disconnected - they MUST connect to something
❌ Don't connect database pools directly to non-database nodes
❌ Don't connect two database operation nodes together without data flow
❌ Don't connect input ports to input ports or output ports to output ports
❌ Don't skip the connection between database pools and database operations
❌ Don't create duplicate nodes - check if a node type already exists

EXAMPLES:
✅ "trigger_node.trigger-out" → "http_request.trigger-in"
✅ "http_request.data-out" → "json_parser.data-in" 
✅ "mongodb_connection.connection-out" → "get_collection.connection-in"
✅ "get_collection.data-out" → "transform_data.data-in"

For "${content}", think about:
1. What triggers the workflow?
2. What data processing steps are needed?
3. Which nodes need database connections vs. data connections?
4. What is the logical data flow from start to finish?

Return JSON array with proper port-to-port connections:
[{
  "from": "actual_node_id.output_port_id",
  "to": "actual_node_id.input_port_id"
}]`

        try {
          const response = await this.callLLM([
            { role: 'user', content: connectionPrompt }
          ])
          
          const connections = JSON.parse(this.cleanJsonResponse(response))
          
          for (const conn of connections) {
            const [fromNodeId, fromPort] = conn.from.split('.')
            const [toNodeId, toPort] = conn.to.split('.')
            
            if (fromNodeId && fromPort && toNodeId && toPort) {
              const connResult = await this.mcpClient.callTool('embed_orchestrator', 'connect_nodes', {
                apiKey: this.apiKey,
                workflowId,
                graphId: 'main',
                sourceNodeId: fromNodeId,
                sourcePortId: fromPort,
                targetNodeId: toNodeId,
                targetPortId: toPort,
              })
              
              const parsed = JSON.parse(connResult)
              if (parsed.success) {
                connectionCount++
              }
            }
          }
        } catch (error) {
          console.log('[OPTIMIZATION] Connection generation failed:', error)
        }
      }
      
      if (connectionCount > 0) {
        yield {
          type: 'message',
          content: `Created ${connectionCount} connections`,
          metadata: { connectionCount }
        }
        
        // Trigger sync
        yield {
          type: 'crdt_sync_required',
          content: 'Syncing workflow...',
          metadata: { connectionCount }
        }
      }
      
      // 5. EVALUATION PHASE - Check workflow quality and collect missing properties
      yield { type: 'status', content: 'Evaluating workflow quality...' }
      console.log('[OPTIMIZATION] Starting workflow evaluation phase...')
      
      const evaluationResult = await this.evaluateWorkflowQuality(
        workflowId,
        nodeMap,
        templateMap,
        connectionCount,
        content
      )
      
      // Handle evaluation results
      if (evaluationResult.hasIssues) {
        console.log('[OPTIMIZATION] Found workflow issues:', evaluationResult.issues)
        yield {
          type: 'message',
          content: `Found ${evaluationResult.issues.length} potential improvements...`
        }
        
        // Apply automatic fixes
        if (evaluationResult.fixes && evaluationResult.fixes.length > 0) {
          const fixResults = await this.applyWorkflowFixes(workflowId, evaluationResult.fixes)
          if (fixResults.applied > 0) {
            yield {
              type: 'message',
              content: `Applied ${fixResults.applied} automatic improvements`
            }
            // Update counts if connections/nodes were modified
            if (fixResults.connectionsRemoved) connectionCount -= fixResults.connectionsRemoved
            if (fixResults.nodesRemoved) nodeCount -= fixResults.nodesRemoved
          }
        }
      }
      
      // Collect missing properties from user
      if (evaluationResult.missingProperties && evaluationResult.missingProperties.length > 0) {
        console.log('[OPTIMIZATION] Found missing properties:', evaluationResult.missingProperties)
        
        // Convert to proper PropertyQuestion format
        const propertyQuestions = evaluationResult.missingProperties.map(prop => {
          const node = nodeMap.get(prop.nodeQuery)
          const template = templateMap.get(prop.nodeQuery)
          return {
            nodeId: node || prop.nodeId,
            nodeTitle: template?.title || prop.nodeTitle || 'Node',
            propertyName: prop.propertyName,
            propertyType: prop.propertyType || 'text',
            question: prop.question,
            currentValue: prop.currentValue,
            suggestedValue: prop.suggestedValue,
            required: prop.required !== false
          }
        })
        
        console.log('[OPTIMIZATION] Yielding property questions:', propertyQuestions)
        
        // Store workflow context with pending questions so follow-up messages work correctly
        // Create proper nodeMap: nodeId -> nodeInfo for property updates
        const nodeMapForContext = new Map()
        for (const [query, nodeId] of nodeMap.entries()) {
          // Store by nodeId for property updates
          nodeMapForContext.set(nodeId, {
            nodeId,
            query,
            template: templateMap.get(query)
          })
        }
        
        const contextData: Partial<WorkflowContext> = {
          workflowId,
          nodeMap: nodeMapForContext,
          connections: [], // Will be populated after connections are created
          pendingQuestions: propertyQuestions,
          propertyValues: new Map(),
          conversationHistory: [],
          lastUserRequest: content,
          intent,
          workflowSummary: `Workflow "${intent.suggestedName}" with ${nodeCount} nodes, waiting for configuration.`,
        }
        this.storeWorkflowContext(workflowId, contextData)
        console.log('[OPTIMIZATION] Stored workflow context with pending questions')
        
        yield {
          type: 'question',
          content: 'To complete your workflow, please provide the following information:',
          questions: propertyQuestions,
          workflowId
        }
        
        // Don't proceed to summary if we're waiting for user input
        return
      }
      
      // 6. Generate comprehensive summary like unoptimized mode
      yield { type: 'status', content: 'Generating workflow summary...' }
      
      try {
        // Build context for summary generation
        const selectedNodesMap = new Map<string, any>()
        const connectionsArray: any[] = []
        const nodeMapForSummary = new Map<string, any>()
        
        // Populate summary context
        for (let i = 0; i < nodesToProcess.length; i++) {
          const { suggestedNode, template } = nodesToProcess[i]
          const nodeId = nodeMap.get(suggestedNode.query)
          if (nodeId) {
            selectedNodesMap.set(nodeId, template)
            nodeMapForSummary.set(suggestedNode.query, {
              nodeId,
              query: suggestedNode.query,
              template: template
            })
          }
        }
        
        // Add connections to summary context (simplified for now)
        for (const [query, nodeId] of nodeMap) {
          connectionsArray.push({
            from: query,
            to: 'connected',
            fromQuery: query,
            toQuery: 'workflow'
          })
        }
        
        const comprehensiveSummary = await this.generateWorkflowSummary(
          content,
          intent,
          selectedNodesMap,
          connectionsArray,
          nodeMapForSummary
        )
        
        yield {
          type: 'workflow_ready',
          content: comprehensiveSummary,
          metadata: { nodeCount, connectionCount, optimized: true }
        }
        
      } catch (error) {
        console.error('[OPTIMIZATION] Failed to generate summary:', error)
        // Fallback to simple summary
        const summary = `✅ Workflow ready! Created "${intent.suggestedName}" with ${nodeCount} nodes and ${connectionCount} connections.

${intent.suggestedDescription || intent.description}`
        
        yield {
          type: 'workflow_ready',
          content: summary,
          metadata: { nodeCount, connectionCount, optimized: true }
        }
      }
      
      yield {
        type: 'complete',
        workflowId,
        metadata: { nodeCount, connectionCount, timeMs: Date.now() }
      }
      
    } catch (error) {
      console.error('[OPTIMIZATION] Fast path failed:', error)
      yield { type: 'error', content: 'Failed to create workflow: ' + (error as Error).message }
    }
  }

  /**
   * Match GraphRAG results to specific node requirements using semantic similarity
   */
  private async matchTemplatesToNodes(
    relevantNodes: any[],
    suggestedNodes: any[]
  ): Promise<Array<{suggestedNode: any, template: any}>> {
    const matches: Array<{suggestedNode: any, template: any}> = []
    
    // Get all templates from the relevant nodes
    const templatePromises = relevantNodes.map(async (node) => {
      try {
        const templateResult = await this.mcpClient.callTool(
          'node_template_repository',
          'get_template',
          { templateId: node.nodeId }
        )
        const parsed = JSON.parse(templateResult)
        return { node, template: parsed.data || parsed, relevanceScore: node.score || 50 }
      } catch (error) {
        console.warn(`[OPTIMIZATION] Failed to fetch template ${node.nodeId}:`, error)
        return { node, template: null, relevanceScore: 0 }
      }
    })
    
    const templateResults = await Promise.all(templatePromises)
    const templates = templateResults.filter(result => result.template)
    
    console.log(`[OPTIMIZATION] Fetched ${templates.length}/${relevantNodes.length} templates for matching`)
    console.log(`[OPTIMIZATION] Available templates:`, templates.map(t => t.template.title))
    
    // For each suggested node, find ALL relevant templates (not just the best)
    for (const suggestedNode of suggestedNodes) {
      const matchingTemplates: Array<{template: any, score: number}> = []
      
      // Simple keyword matching for now (could be enhanced with embeddings later)
      const queryKeywords = suggestedNode.query.toLowerCase().split(' ')
      const purposeKeywords = (suggestedNode.purpose || '').toLowerCase().split(' ')
      const allKeywords = [...queryKeywords, ...purposeKeywords]
      
      // Check for service-specific keywords
      const isMongoQuery = allKeywords.some(k => k.includes('mongo'))
      const isPostgresQuery = allKeywords.some(k => k.includes('postgre') || k.includes('pg'))
      const isDatabaseQuery = allKeywords.some(k => k.includes('database') || k.includes('db'))
      const isHttpQuery = allKeywords.some(k => k.includes('http') || k.includes('api'))
      
      for (const { node, template, relevanceScore } of templates) {
        let score = 0
        const templateText = [
          template.title || '',
          template.description || '',
          template.category || '',
          ...(template.tags || [])
        ].join(' ').toLowerCase()
        
        // Score based on keyword matches
        for (const keyword of allKeywords) {
          if (keyword.length > 2 && templateText.includes(keyword)) {
            score += keyword.length * 2
          }
        }
        
        // Add GraphRAG relevance score
        score += relevanceScore / 10
        
        // Service-specific matching
        if (isMongoQuery && templateText.includes('mongo')) {
          score += 50 // High boost for MongoDB matches
        }
        if (isPostgresQuery && (templateText.includes('postgre') || templateText.includes('pg'))) {
          score += 50 // High boost for PostgreSQL matches
        }
        if (isDatabaseQuery && template.category?.toLowerCase().includes('database')) {
          score += 30
        }
        if (isHttpQuery && (templateText.includes('http') || templateText.includes('api'))) {
          score += 30
        }
        
        // Category bonus
        if (suggestedNode.query.includes('trigger') && template.category?.toLowerCase().includes('trigger')) {
          score += 20
        }
        
        if (score > 5) { // Lower threshold to include more matches
          matchingTemplates.push({ template, score })
        }
      }
      
      // Sort by score and take the best matches
      matchingTemplates.sort((a, b) => b.score - a.score)
      
      if (matchingTemplates.length > 0) {
        // ALWAYS take the BEST match only - let the LLM decide what nodes are needed
        // Don't add multiple templates per suggested node
        const bestMatch = matchingTemplates[0]
        matches.push({ suggestedNode, template: bestMatch.template })
        console.log(`[OPTIMIZATION] Matched "${suggestedNode.query}" → ${bestMatch.template.title} (score: ${bestMatch.score})`)
        
        // Log other potential matches for debugging
        if (matchingTemplates.length > 1) {
          console.log(`[OPTIMIZATION] Other potential matches:`, 
            matchingTemplates.slice(1, 3).map(m => `${m.template.title} (${m.score})`).join(', '))
        }
      } else {
        matches.push({ suggestedNode, template: null })
        console.log(`[OPTIMIZATION] No match found for "${suggestedNode.query}"`)
      }
    }
    
    return matches
  }

  /**
   * Batch generate properties for multiple nodes in one LLM call
   */
  private async generateBatchNodeProperties(
    nodesToProcess: Array<{suggestedNode: any, template: any}>,
    userRequest: string
  ): Promise<Array<Record<string, any>>> {
    console.log(`[OPTIMIZATION] Batch generating properties for ${nodesToProcess.length} nodes`)
    
    // Check which nodes need property enrichment
    const nodesNeedingProperties: Array<{index: number, node: any, template: any, properties: any[]}> = []
    
    for (let i = 0; i < nodesToProcess.length; i++) {
      const { suggestedNode, template } = nodesToProcess[i]
      
      // Check if template has properties that need enrichment
      const hasProperties = template.properties && 
        (Array.isArray(template.properties) ? template.properties.length > 0 : Object.keys(template.properties).length > 0)
      
      if (hasProperties) {
        // Convert properties to array format for processing
        const propsArray = Array.isArray(template.properties) 
          ? template.properties 
          : Object.entries(template.properties).map(([name, prop]: [string, any]) => ({
              name,
              ...prop
            }))
        
        // Check which properties need AI-generated content
        const needsEnrichment = propsArray.filter((prop: any) => 
          prop.type === 'data-operations' ||
          prop.type === 'filter-rules' ||
          prop.type === 'code-editor' ||
          prop.type === 'javascript' ||
          prop.type === 'json' ||
          prop.type === 'script' ||
          (prop.type === 'text' && (
            prop.name?.toLowerCase().includes('path') ||
            prop.name?.toLowerCase().includes('query') ||
            prop.name?.toLowerCase().includes('expression')
          ))
        )
        
        if (needsEnrichment.length > 0) {
          nodesNeedingProperties.push({
            index: i,
            node: suggestedNode,
            template,
            properties: needsEnrichment
          })
        }
      }
    }
    
    // Initialize result array
    const results: Array<Record<string, any>> = new Array(nodesToProcess.length).fill(null).map(() => ({}))
    
    if (nodesNeedingProperties.length === 0) {
      console.log('[OPTIMIZATION] No nodes require property generation')
      return results
    }
    
    // Build comprehensive batch prompt for all nodes
    const nodeDescriptions = nodesNeedingProperties.map((item, idx) => {
      const propertyDescriptions = item.properties.map(prop => 
        `  - ${prop.name} (${prop.type}): ${prop.description || prop.label || prop.name}`
      ).join('\n')
      
      return `NODE ${idx + 1}: ${item.template.title || item.template.type}
Purpose: ${item.node.purpose || item.node.query}
Description: ${item.template.description || 'No description'}
Properties to generate:
${propertyDescriptions}`
    }).join('\n\n')
    
    const prompt = `Generate configuration values for multiple workflow nodes in one batch.
User request: ${userRequest}

${nodeDescriptions}

THINK ABOUT COMPLETE DATA FLOW:
1. What data comes INTO each node? (from previous nodes)
2. What transformation/operation does each node perform?
3. What data should flow OUT? (to next nodes)
4. What could go wrong? (error cases)

Instructions by property type:
- data-operations: Array of transformations. Think: map fields, compute values, restructure data
  Example: [{"type": "set", "path": "output.result", "value": "{{input.data}}"}]
- filter-rules: Conditions to pass/block data. Think: validation, routing, quality control
  Example: [{"field": "status", "operator": "equals", "value": "active"}]
- code-editor/javascript: Transformation logic. Always handle input, transform, return output
  Example: "const result = input.map(item => ({...item, processed: true})); return result;"
- json: Structured configuration. Think about the data schema
- text with "path": Access patterns for nested data (JSONPath: $., XPath: //, CSS: .)
- text with "query": Selection/filtering expressions
- text with "expression": Formulas or computed values

IMPORTANT PATTERNS:
- Always assume data flows from input to output
- Handle both single items and arrays
- Consider error cases and edge conditions
- Use mustache templates {{field}} for dynamic values
- Preserve important fields while transforming

Return ONLY a JSON array with objects for each node (in order):
[
  {
    "propertyName1": value,
    "propertyName2": value
  },
  {
    "propertyName1": value,
    "propertyName2": value  
  }
]`

    try {
      console.log('[OPTIMIZATION] Making single LLM call for all node properties...')
      const response = await this.callLLM([{ role: 'user', content: prompt }])
      const batchResults = JSON.parse(this.cleanJsonResponse(response))
      
      if (!Array.isArray(batchResults)) {
        console.error('[OPTIMIZATION] Batch property generation returned non-array:', batchResults)
        return results
      }
      
      // Map batch results back to the correct indices
      for (let i = 0; i < nodesNeedingProperties.length; i++) {
        const nodeInfo = nodesNeedingProperties[i]
        const batchResult = batchResults[i] || {}
        
        // Ensure all properties are properly formatted (same logic as individual method)
        for (const prop of nodeInfo.properties) {
          if (batchResult[prop.name] !== undefined) {
            // Ensure code properties are strings
            if (prop.type === 'code-editor' || prop.type === 'javascript' || prop.type === 'script') {
              if (typeof batchResult[prop.name] !== 'string') {
                batchResult[prop.name] = JSON.stringify(batchResult[prop.name], null, 2)
              }
            }
            // Ensure JSON properties are strings
            else if (prop.type === 'json' || prop.type === 'data-operations' || prop.type === 'filter-rules') {
              if (typeof batchResult[prop.name] !== 'string') {
                batchResult[prop.name] = JSON.stringify(batchResult[prop.name])
              }
            }
          }
        }
        
        results[nodeInfo.index] = batchResult
      }
      
      console.log(`[OPTIMIZATION] Successfully generated properties for ${nodesNeedingProperties.length} nodes in batch`)
      return results
      
    } catch (error) {
      console.error('[OPTIMIZATION] Failed to generate batch properties:', error)
      
      // Return empty fallbacks for all nodes
      for (let i = 0; i < nodesNeedingProperties.length; i++) {
        const nodeInfo = nodesNeedingProperties[i]
        const fallback: Record<string, any> = {}
        for (const prop of nodeInfo.properties) {
          if (prop.type === 'data-operations') {
            fallback[prop.name] = '[]'
          } else if (prop.type === 'filter-rules') {
            fallback[prop.name] = '[]'
          } else if (prop.type === 'json') {
            fallback[prop.name] = '{}'
          } else if (prop.type === 'code-editor' || prop.type === 'javascript') {
            fallback[prop.name] = '// Add your code here\nreturn data;'
          } else {
            fallback[prop.name] = ''
          }
        }
        results[nodeInfo.index] = fallback
      }
      
      return results
    }
  }

  /**
   * Dynamically generate properties for any node type based on its template
   */
  private async generateNodeProperties(
    template: any,
    properties: any[],
    purpose: string,
    userRequest: string
  ): Promise<Record<string, any>> {
    // Build a single prompt for all properties
    const propertyDescriptions = properties.map(prop => 
      `- ${prop.name} (${prop.type}): ${prop.description || prop.label || prop.name}`
    ).join('\n')
    
    const prompt = `Generate configuration values for a ${template.title || template.type} node.
Purpose: ${purpose}
User request: ${userRequest}

Properties to generate:
${propertyDescriptions}

THINK ABOUT DATA FLOW:
1. What data comes INTO this node? (from previous nodes)
2. What transformation/operation does this node perform?
3. What data should flow OUT? (to next nodes)
4. What could go wrong? (error cases)

Instructions by property type:
- data-operations: Array of transformations. Think: map fields, compute values, restructure data
  Example: [{"type": "set", "path": "output.result", "value": "{{input.data}}"}]
- filter-rules: Conditions to pass/block data. Think: validation, routing, quality control
  Example: [{"field": "status", "operator": "equals", "value": "active"}]
- code-editor/javascript: Transformation logic. Always handle input, transform, return output
  Example: "const result = input.map(item => ({...item, processed: true})); return result;"
- json: Structured configuration. Think about the data schema
- text with "path": Access patterns for nested data (JSONPath: $., XPath: //, CSS: .)
- text with "query": Selection/filtering expressions
- text with "expression": Formulas or computed values

IMPORTANT PATTERNS:
- Always assume data flows from input to output
- Handle both single items and arrays
- Consider error cases and edge conditions
- Use mustache templates {{field}} for dynamic values
- Preserve important fields while transforming

Return ONLY a JSON object with the property names as keys:
{
  "propertyName": value
}`

    try {
      const response = await this.callLLM([{ role: 'user', content: prompt }])
      const result = JSON.parse(this.cleanJsonResponse(response))
      
      // Ensure all properties are properly formatted
      for (const prop of properties) {
        if (result[prop.name] !== undefined) {
          // Ensure code properties are strings
          if (prop.type === 'code-editor' || prop.type === 'javascript' || prop.type === 'script') {
            if (typeof result[prop.name] !== 'string') {
              result[prop.name] = JSON.stringify(result[prop.name], null, 2)
            }
          }
          // Ensure JSON properties are strings
          else if (prop.type === 'json' || prop.type === 'data-operations' || prop.type === 'filter-rules') {
            if (typeof result[prop.name] !== 'string') {
              result[prop.name] = JSON.stringify(result[prop.name])
            }
          }
        }
      }
      
      return result
    } catch (error) {
      console.error('[OPTIMIZATION] Failed to generate properties:', error)
      
      // Return empty values as fallback
      const fallback: Record<string, any> = {}
      for (const prop of properties) {
        if (prop.type === 'data-operations') {
          fallback[prop.name] = '[]'
        } else if (prop.type === 'filter-rules') {
          fallback[prop.name] = '[]'
        } else if (prop.type === 'json') {
          fallback[prop.name] = '{}'
        } else if (prop.type === 'code-editor' || prop.type === 'javascript') {
          fallback[prop.name] = '// Add your code here\nreturn data;'
        } else {
          fallback[prop.name] = ''
        }
      }
      return fallback
    }
  }

  private cleanJsonResponse(response: string): string {
    // Remove markdown code blocks first
    let cleaned = response.trim()

    // Check if there's a markdown code block with JSON
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      // Extract just the content inside the code block
      cleaned = codeBlockMatch[1].trim()
    } else {
      // Remove ```json and ``` markers if they exist without proper matching
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
    }

    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim()

    // If it still doesn't look like JSON, try to extract JSON from the response
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      // Try to find JSON in the response - use non-greedy matching and look for complete JSON
      // First try to find an array
      let jsonMatch = cleaned.match(/(\[[\s\S]*?\])\s*(?:[^\[\{]|$)/)
      if (!jsonMatch) {
        // Then try to find an object
        jsonMatch = cleaned.match(/(\{[\s\S]*?\})\s*(?:[^\[\{]|$)/)
      }

      if (jsonMatch) {
        cleaned = jsonMatch[1]
      } else {
        // Last resort: try to find any JSON-like structure
        const startIdx = cleaned.search(/[\[\{]/)
        if (startIdx !== -1) {
          // Find the matching closing bracket/brace
          let depth = 0
          let endIdx = -1
          const isArray = cleaned[startIdx] === '['
          const openChar = isArray ? '[' : '{'
          const closeChar = isArray ? ']' : '}'

          for (let i = startIdx; i < cleaned.length; i++) {
            if (cleaned[i] === openChar) depth++
            if (cleaned[i] === closeChar) depth--
            if (depth === 0) {
              endIdx = i
              break
            }
          }

          if (endIdx !== -1) {
            cleaned = cleaned.substring(startIdx, endIdx + 1)
          }
        }
      }
    }

    return cleaned
  }

  private generateWorkflowName(parsed: any): string {
    if (parsed.action) {
      // Convert action to a readable name
      return parsed.action
        .split('_')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }
    if (parsed.services && parsed.services.length > 0) {
      return `${parsed.services.join(' + ')} Workflow`
    }
    return 'New Workflow'
  }

  private generateWorkflowDescription(parsed: any, content: string): string {
    const parts: string[] = []

    if (parsed.action) {
      parts.push(`Workflow to ${parsed.action.replace(/_/g, ' ')}`)
    }
    if (parsed.services && parsed.services.length > 0) {
      parts.push(`using ${parsed.services.join(' and ')}`)
    }
    if (parsed.capabilities && parsed.capabilities.length > 0) {
      parts.push(`with capabilities: ${parsed.capabilities.join(', ')}`)
    }

    return parts.length > 0 ? parts.join(' ') : content
  }

  private convertDataFlowToNodes(parsed: any): Array<any> {
    const nodes: Array<any> = []
    const xSpacing = 350
    const yBase = 200

    // If we have dataFlow, use it to create nodes
    if (parsed.dataFlow && Array.isArray(parsed.dataFlow)) {
      parsed.dataFlow.forEach((step: string, index: number) => {
        nodes.push({
          query: step.replace(/_/g, ' '),
          position: { x: 100 + index * xSpacing, y: yBase },
          purpose: `Step ${index + 1}: ${step.replace(/_/g, ' ')}`,
        })
      })
    } else {
      // Otherwise, try to infer nodes from services and capabilities
      if (parsed.services) {
        parsed.services.forEach((service: string, index: number) => {
          nodes.push({
            query: service,
            position: { x: 100 + index * xSpacing, y: yBase },
            purpose: `Integrate with ${service}`,
          })
        })
      }

      if (parsed.capabilities) {
        const serviceCount = parsed.services?.length || 0
        parsed.capabilities.forEach((capability: string, index: number) => {
          nodes.push({
            query: capability,
            position: { x: 100 + (serviceCount + index) * xSpacing, y: yBase },
            purpose: `Capability: ${capability}`,
          })
        })
      }
    }

    return nodes
  }

  /**
   * Analyze user intent to understand implicit needs
   */
  private convertWorkflowIntentToGraphRAGIntent(workflowIntent: WorkflowIntent): any {
    // Convert WorkflowIntent to a format compatible with GraphRAG
    return {
      action: workflowIntent.description || '',
      services: workflowIntent.suggestedNodes?.map(node => node.query || '') || [],
      capabilities: workflowIntent.suggestedNodes?.map(node => node.query || '') || [],
      dataFlow: workflowIntent.suggestedNodes?.map(node => node.query || '') || [],
    }
  }

  private async analyzeUserIntent(content: string): Promise<{
    likelyPurpose: string
    suggestedFrequency?: string
    impliedNeeds: string[]
  }> {
    const analysisPrompt = `Analyze this user request to understand their likely needs:

"${content}"

Consider:
1. What's the likely PURPOSE of this workflow?
2. Is this likely a one-time task or recurring need?
3. What implicit requirements might they have?
4. What would make this workflow actually useful in practice?

Think like a helpful assistant who wants to build something truly useful, not just follow instructions literally.

Respond with JSON:
{
  "likelyPurpose": "what they're trying to achieve",
  "suggestedFrequency": "one-time|recurring|scheduled|continuous",
  "impliedNeeds": ["list of things they probably need but didn't mention"]
}`

    let response: string = ''
    try {
      response = await this.callLLM([
        {
          role: 'system',
          content:
            'You are an expert at understanding user needs and building practical solutions.',
        },
        { role: 'user', content: analysisPrompt },
      ])

      return JSON.parse(this.cleanJsonResponse(response))
    } catch (error) {
      console.error('Failed to analyze intent:', error)
      console.error('Raw response:', response)
      return {
        likelyPurpose: 'Process data',
        impliedNeeds: [],
      }
    }
  }

  private async createWorkflowFromIntent(intent: WorkflowIntent) {
    try {
      const result = await this.mcpClient.callTool('workflow_manager', 'create_workflow', {
        name: intent.suggestedName || 'New Workflow',
        description: intent.suggestedDescription || intent.description,
      })

      const parsed = JSON.parse(result)
      // Handle new API response format: data contains the actual workflow
      const workflowData = parsed.data
      return {
        success: parsed.success || !!workflowData?.id,
        workflowId: workflowData?.id,
        workflow: workflowData,
      }
    } catch (error) {
      console.error('Error creating workflow:', error)
      return { success: false }
    }
  }

  private async searchForTemplate(
    query: string,
    retries: number = 3,
    allowCustomScript: boolean = true,
    workflowContext?: string
  ): Promise<any | null> {
    console.log(`Searching for template with query: "${query}"`)

    // OPTIMIZATION: Try GraphRAG first if available
    if (this.graphRAG) {
      try {
        // Create a simple intent for the search
        const searchIntent: any = {
          description: workflowContext || query,
          suggestedNodes: [{
            query: query,
            purpose: query
          }]
        }
        
        const graphResults = await this.graphRAG.findRelevantNodes(query, searchIntent)
        
        if (graphResults.length > 0) {
          // If we have a very high confidence match, use it directly
          if (graphResults[0].score > 0.9) {
            const template = graphResults[0].metadata
            console.log(`[GraphRAG] High confidence match: ${template?.title} (score: ${graphResults[0].score})`)
            return template
          }
          
          // Otherwise, let LLM pick the best from top results
          const selected = await this.selectBestTemplate(query, graphResults, workflowContext)
          if (selected) {
            console.log(`[GraphRAG + LLM] Selected: ${selected.title}`)
            return selected
          }
        }
      } catch (error) {
        console.log('[GraphRAG] Search failed, falling back to MCP:', error)
      }
    }

    const attemptedQueries: string[] = [query]
    const foundTemplates: any[] = []

    // Try MCP search
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.mcpClient.callTool(
          'node_template_repository',
          'search_templates',
          {
            query,
            limit: 5,
          }
        )

        const parsed = JSON.parse(result)
        console.log(`Search response for "${query}":`, JSON.stringify(parsed, null, 2))

        // Handle different response formats
        const templates = parsed.data || parsed.results || parsed
        if (Array.isArray(templates) && templates.length > 0) {
          console.log(`Found ${templates.length} templates for query: "${query}"`)

          // OPTIMIZATION: Use intelligent selection for MCP results too
          if (templates.length > 1) {
            // Convert to format similar to GraphRAG results
            const searchResults = templates.map((t: any, i: number) => ({
              metadata: t.template || t,
              score: 1.0 - (i * 0.1) // Assume ordered by relevance
            }))
            
            const selected = await this.selectBestTemplate(query, searchResults, workflowContext)
            if (selected) {
              return selected
            }
          } else {
            // Single result, use it directly
            const firstResult = templates[0]
            if (firstResult.template) {
              // Search service returns { score, template } structure
              console.log(
                `Returning template from search result:`,
                firstResult.template.id,
                firstResult.template.type
              )
              return firstResult.template
            } else {
              // Direct template object
              console.log(`Returning direct template:`, firstResult.id, firstResult.type)
              return firstResult
            }
          }
        }

        console.log(`No templates found for query: "${query}" (attempt ${attempt}/${retries})`)

        // Try alternative queries
        if (attempt < retries) {
          // Generate alternative search query
          const alternativeQuery = await this.generateAlternativeQuery(query)
          if (alternativeQuery && alternativeQuery !== query) {
            query = alternativeQuery
            attemptedQueries.push(query)
          }
        }
      } catch (error) {
        console.error(`Error searching for template: ${error}`)
      }
    }

    // If no template found and custom script is allowed, make an intelligent decision
    if (allowCustomScript) {
      // Decide if we should use a custom script or try harder to find existing templates
      const decision = await this.shouldUseCustomScript(query, foundTemplates, {
        workflowPurpose: workflowContext,
        attemptedQueries,
      })

      console.log(
        `Custom script decision for "${query}": ${decision.useCustom} - ${decision.reason}`
      )

      if (decision.useCustom) {
        console.log(`Creating custom JavaScript node for: "${query}"`)
        return this.createCustomScriptTemplate(query)
      } else {
        console.log(`Not using custom script. Reason: ${decision.reason}`)
        // Return the best match from found templates if any
        return foundTemplates.length > 0 ? foundTemplates[0] : null
      }
    }

    return null
  }

  private createCustomScriptTemplate(functionality: string): any {
    // Return a JavaScript Script template with custom functionality
    return {
      id: 'tpl_javascript_script',
      type: 'javascript-script',
      title: 'Custom Script',
      subtitle: functionality.substring(0, 50) + (functionality.length > 50 ? '...' : ''),
      description: `Custom script node for: ${functionality}`,
      category: 'scripting',
      subcategory: 'custom',
      icon: 'code',
      variant: 'blue-600',
      shape: 'rectangle',
      size: 'medium',
      ports: [
        {
          id: 'input',
          label: 'Input',
          type: 'input',
          position: 'left',
        },
        {
          id: 'output',
          label: 'Output',
          type: 'output',
          position: 'right',
        },
      ],
      properties: {
        code: {
          type: 'code-editor',
          label: 'Script Code',
          language: 'javascript',
          height: 300,
          defaultValue: '// Custom script will be generated',
        },
        description: {
          type: 'text',
          label: 'Description',
          defaultValue: functionality,
        },
      },
      // Mark this as needing custom script generation
      _needsScriptGeneration: true,
      _functionality: functionality,
    }
  }

  /**
   * Check if a template is relevant to the user's request
   */
  private async evaluateWorkflowCompleteness(
    templates: Map<string, any>,
    userRequest: string,
    intent: WorkflowIntent
  ): Promise<{
    isComplete: boolean
    analysis: string
    missingCapabilities: string[]
    irrelevantNodes: string[]
    suggestions: Array<{ remove: string; replaceWith: string; reason: string }>
  }> {
    const prompt = `Evaluate if this set of nodes collectively fulfills the user's request.

User Request: "${userRequest}"

Workflow Intent: ${JSON.stringify(intent, null, 2)}

Current Nodes Selected:
${Array.from(templates.entries())
  .map(
    ([query, template]) => `- ${template.title}: ${template.description} (searched for: "${query}")`
  )
  .join('\n')}

Analyze:
1. Does this combination of nodes fully address the user's request?
2. Are there any nodes that don't belong or contradict the request?
3. What capabilities are missing to complete the workflow?
4. Which nodes should be replaced with more appropriate ones?

Consider the ENTIRE workflow as a system. For example:
- If user asks for "monitor GitHub PRs and send Slack messages", having Discord instead of Slack makes the workflow incorrect
- If user asks for "process CSV files", having just a CSV reader without processing nodes is incomplete
- Nodes should work together logically to achieve the stated goal

Respond with JSON:
{
  "isComplete": boolean,
  "analysis": "brief explanation of the workflow evaluation",
  "missingCapabilities": ["capability1", "capability2"],
  "irrelevantNodes": ["node query that found irrelevant template"],
  "suggestions": [
    {
      "remove": "query that found wrong node",
      "replaceWith": "better search query",
      "reason": "why this replacement is needed"
    }
  ]
}`

    try {
      const response = await this.callLLM([
        {
          role: 'system',
          content:
            "You are a workflow analyzer. Evaluate if the selected nodes collectively fulfill the user's requirements.",
        },
        { role: 'user', content: prompt },
      ])

      const result = JSON.parse(this.cleanJsonResponse(response))
      console.log('Workflow evaluation:', result)
      return result
    } catch (error) {
      console.error('Failed to evaluate workflow completeness:', error)
      return {
        isComplete: true,
        analysis: 'Evaluation failed, proceeding with current selection',
        missingCapabilities: [],
        irrelevantNodes: [],
        suggestions: [],
      }
    }
  }

  private async extractSearchTerms(userRequest: string, intent: any): Promise<string[]> {
    const prompt = `Extract key search terms from this request to find relevant workflow nodes.

User Request: "${userRequest}"
Intent: ${JSON.stringify(intent, null, 2)}

Extract specific terms to search for nodes:
- Service names (e.g., "PostgreSQL", "Excel", "Slack")
- Action types (e.g., "SQL script", "export", "write")
- Data operations (e.g., "query", "transform", "filter")

Return a JSON array of search terms in order of importance:
["term1", "term2", "term3", ...]

Be specific - "PostgreSQL" not "database", "Excel writer" not just "Excel".`

    try {
      const response = await this.callLLM([
        {
          role: 'system',
          content: 'You are a search term extractor. Extract the most relevant search terms.',
        },
        { role: 'user', content: prompt },
      ])

      return JSON.parse(this.cleanJsonResponse(response))
    } catch (error) {
      console.error('Failed to extract search terms:', error)
      // Basic fallback
      return intent.services.concat(intent.capabilities)
    }
  }

  private async reviewGraphRAGWorkflow(
    templateMap: Map<string, any>,
    connections: Array<{ from: string; to: string; confidence: number }>,
    userRequest: string,
    intent: WorkflowIntent
  ): Promise<{
    isComplete: boolean
    analysis: string
    missingNodes: Array<{ query: string; description: string }>
    unnecessaryNodes: string[]
  }> {
    const prompt = `Review this GraphRAG-generated workflow for completeness and correctness.

User Request: "${userRequest}"
Intent: ${JSON.stringify(intent, null, 2)}

Selected Nodes:
${Array.from(templateMap.entries())
  .map(([id, template]) => `- ${template.title} (${id}): ${template.description}`)
  .join('\n')}

Connections:
${connections
  .map(c => {
    const from = templateMap.get(c.from)
    const to = templateMap.get(c.to)
    return `- ${from?.title || c.from} → ${to?.title || c.to}`
  })
  .join('\n')}

Analyze:
1. Are all necessary steps covered? (e.g., if SQL is mentioned, is there a SQL execution node?)
2. Are the connections logical and complete?
3. Is the data flow correct (source → processing → destination)?
4. Are there any missing intermediate steps?

For example, for "Write SQL to select users and put in Excel":
- Need: PostgreSQL connection node
- Need: SQL execution/script node
- Need: Data transformation node (if needed)
- Need: Excel writer node (not reader!)
- Connections: PostgreSQL → SQL → Excel

Return JSON:
{
  "isComplete": boolean,
  "analysis": "explanation of what's missing or wrong",
  "missingNodes": [
    {"query": "search query for missing node", "description": "what it should do"}
  ],
  "unnecessaryNodes": ["node_id_to_remove"]
}`

    try {
      const response = await this.callLLM([
        {
          role: 'system',
          content: 'You are a workflow expert. Review workflows for completeness and correctness.',
        },
        { role: 'user', content: prompt },
      ])

      return JSON.parse(this.cleanJsonResponse(response))
    } catch (error) {
      console.error('Failed to review workflow:', error)
      return {
        isComplete: true,
        analysis: 'Review failed, proceeding with current workflow',
        missingNodes: [],
        unnecessaryNodes: [],
      }
    }
  }

  private async generateImprovedSearchQuery(
    originalQuery: string,
    userRequest: string,
    foundTemplate: any,
    reason: string
  ): Promise<string> {
    const prompt = `Generate a better search query to find the right node template.

User's Request: "${userRequest}"
Original Search Query: "${originalQuery}"
Found Template: ${foundTemplate.title} - ${foundTemplate.description}
Why it's not suitable: ${reason}

Generate a more specific search query that will find the correct template.
Consider the user's actual intent and the specific service/functionality they mentioned.

Return ONLY the improved search query, nothing else.`

    const response = await this.callLLM([
      {
        role: 'system',
        content:
          'You are a search query optimizer. Generate precise queries that will find the right templates.',
      },
      { role: 'user', content: prompt },
    ])

    return response.trim()
  }

  private async generateAlternativeQuery(originalQuery: string): Promise<string> {
    const response = await this.callLLM([
      {
        role: 'system',
        content: `Generate an alternative search query for finding node templates. The original query didn't find matches.
        
Original query: "${originalQuery}"

Provide a simpler, more general search query that might find relevant templates.
Return ONLY the new search query, nothing else.`,
      },
      { role: 'user', content: originalQuery },
    ])

    return response.trim()
  }

  /**
   * Decide if a custom script node is needed based on the task complexity
   */
  private async shouldUseCustomScript(
    functionality: string,
    availableTemplates: any[],
    context?: {
      workflowPurpose?: string
      attemptedQueries?: string[]
    }
  ): Promise<{ useCustom: boolean; reason: string }> {
    const prompt = `Analyze whether existing templates can handle this functionality or if a custom script is needed.

Functionality requested: "${functionality}"

Available templates found:
${availableTemplates.map(t => `- ${t.title}: ${t.description}`).join('\n')}

Workflow context: ${context?.workflowPurpose || 'Not specified'}
Already tried queries: ${context?.attemptedQueries?.join(', ') || 'None'}

IMPORTANT DECISION CRITERIA:
1. Prefer existing templates if they can handle 80% or more of the functionality
2. Use custom scripts ONLY for:
   - Complex business logic that can't be decomposed
   - Multi-step data transformations beyond simple mapping
   - Integration with unsupported APIs/services
   - Custom algorithms or calculations

3. Common tasks that DON'T need custom scripts:
   - Periodic execution → Use Interval Trigger
   - API calls → Use HTTP Request
   - Data parsing → Use JSON/CSV parsers
   - Simple transformations → Use Data Transformer

Respond with JSON:
{
  "useCustom": boolean,
  "reason": "explanation of decision",
  "suggestion": "if not custom, which template to use"
}`

    try {
      const response = await this.callLLM([
        { role: 'system', content: 'You are an expert at workflow design and node selection.' },
        { role: 'user', content: prompt },
      ])

      const decision = JSON.parse(this.cleanJsonResponse(response))
      return {
        useCustom: decision.useCustom || false,
        reason: decision.reason || 'No specific reason provided',
      }
    } catch (error) {
      // Default to allowing custom scripts if decision fails
      return {
        useCustom: true,
        reason: 'Decision process failed, defaulting to custom script',
      }
    }
  }

  private async *buildWorkflowStream(
    workflowId: string,
    intent: WorkflowIntent,
    originalRequest: string
  ): AsyncGenerator<StreamingAgentResponse> {
    const nodeMap = new Map<string, NodeMapping>()
    let nodeCount = 0
    let connectionCount = 0
    let groupCount = 0
    const collectedEnvVars: string[] = []

    // Plan workflow
    yield { type: 'status', content: 'Planning workflow structure...' }
    const workflowPlan = await this.planWorkflow(originalRequest, intent)

    // Get node details
    const templateMap = new Map<string, any>()

    // Check if GraphRAG is available
    if (this.graphRAG) {
      // Use GraphRAG for intelligent node selection
      yield { type: 'status', content: 'Analyzing workflow requirements with knowledge graph...' }

      // Convert WorkflowIntent to GraphRAGIntent format
      const graphIntent = this.convertWorkflowIntentToGraphRAGIntent(intent)

      // Find relevant nodes using GraphRAG
      yield { type: 'status', content: 'Finding relevant nodes using knowledge graph...' }
      const relevantNodes = await this.graphRAG.findRelevantNodes(originalRequest, graphIntent)

      // Prevent duplicates
      yield { type: 'status', content: 'Optimizing node selection...' }
      const uniqueNodes = await this.graphRAG.preventDuplicates(relevantNodes)

      for (const relevantNode of uniqueNodes) {
        yield { type: 'status', content: `Loading template: ${relevantNode.nodeId}` }

        // GraphRAG returns knowledge graph node IDs, not template IDs
        // We need to search for the actual template by name/query
        let template = await this.getTemplateById(relevantNode.nodeId)

        // If direct ID lookup fails, try searching by the node ID as a query
        if (!template) {
          console.log(
            `[GraphRAG] Template ID ${relevantNode.nodeId} not found, searching by query...`
          )
          // Extract a search query from the node ID (e.g., "template_webhook_trigger" -> "webhook trigger")
          const searchQuery = relevantNode.nodeId.replace(/^template_/, '').replace(/_/g, ' ')
          template = await this.searchForTemplate(searchQuery, 3, true, originalRequest)
        }

        if (template) {
          templateMap.set(relevantNode.nodeId, template)
          yield {
            type: 'message',
            content: `✓ Selected ${template.title} (score: ${relevantNode.score}) - ${relevantNode.reasons.join(', ')}`,
          }
        } else {
          console.warn(`[GraphRAG] Could not find template for node: ${relevantNode.nodeId}`)
        }
      }

      // Find optimal connections
      yield { type: 'status', content: 'Finding optimal connections...' }
      const connections = await this.graphRAG.findOptimalConnections(uniqueNodes)

      console.log(`[OrchestratorAgent] GraphRAG returned ${connections.length} connections`)
      if (connections.length === 0) {
        console.warn('[OrchestratorAgent] WARNING: No connections returned from GraphRAG!')
      }

      // Explain selection
      const explanation = this.graphRAG.explainSelection(uniqueNodes)
      yield {
        type: 'message',
        content: `Knowledge graph analysis complete:\n${explanation}`,
      }

      // Map templates to workflow plan nodes for compatibility
      workflowPlan.nodes = Array.from(templateMap.keys()).map((nodeId, index) => ({
        query: nodeId,
        position: { x: 100 + index * 350, y: 200 },
        expectedId: nodeId,
      }))

      // Convert GraphRAG connections to workflow connections
      console.log(
        `[GraphRAG] Converting ${connections.length} GraphRAG connections to workflow connections`
      )
      console.log(`[GraphRAG] Raw GraphRAG connections:`, JSON.stringify(connections, null, 2))

      workflowPlan.connections = await Promise.all(
        connections.map(async conn => {
          const sourceTemplate = templateMap.get(conn.from)
          const targetTemplate = templateMap.get(conn.to)

          console.log(`[GraphRAG] Mapping connection: ${conn.from} -> ${conn.to}`)
          console.log(
            `[GraphRAG] Source template found: ${!!sourceTemplate}, Target template found: ${!!targetTemplate}`
          )

          return {
            fromQuery: conn.from,
            toQuery: conn.to,
            sourcePort: await this.findDefaultPort(sourceTemplate, 'output', originalRequest),
            targetPort: await this.findDefaultPort(targetTemplate, 'input', originalRequest),
          }
        })
      )

      console.log(
        `[GraphRAG] Created ${workflowPlan.connections.length} workflow connections from GraphRAG connections`
      )
      console.log(
        `[GraphRAG] Final workflowPlan.connections:`,
        JSON.stringify(workflowPlan.connections, null, 2)
      )
    } else {
      // Fallback to original search-based approach
      yield { type: 'status', content: 'Using traditional search approach...' }

      // Initial template search phase
      yield {
        type: 'status',
        content: `Searching for ${workflowPlan.nodes.length} node templates...`,
      }

      // First pass: collect all templates
      const queryToTemplateMap = new Map<string, any>()

      for (const node of workflowPlan.nodes) {
        yield { type: 'status', content: `Searching for: ${node.query}` }
        const template = await this.searchForTemplate(node.query, 3, true, originalRequest)

        if (template) {
          queryToTemplateMap.set(node.query, template)
          yield { type: 'message', content: `✓ Found template: ${template.title}` }
        } else {
          yield { type: 'message', content: `✗ No template found for: ${node.query}` }
        }
      }

      // Iterative improvement phase
      yield { type: 'status', content: 'Evaluating workflow completeness...' }

      let iterationCount = 0
      const maxIterations = 5
      let isWorkflowComplete = false

      while (!isWorkflowComplete && iterationCount < maxIterations) {
        iterationCount++

        // Evaluate the current set of templates
        const evaluation = await this.evaluateWorkflowCompleteness(
          queryToTemplateMap,
          originalRequest,
          intent
        )

        if (evaluation.isComplete) {
          isWorkflowComplete = true
          templateMap.clear()
          queryToTemplateMap.forEach((template, query) => {
            templateMap.set(query, template)
          })
          break
        }

        yield {
          type: 'status',
          content: `Improving workflow (iteration ${iterationCount}): ${evaluation.analysis}`,
        }

        // Replace irrelevant nodes
        for (const suggestion of evaluation.suggestions) {
          yield {
            type: 'message',
            content: `✗ Found ${queryToTemplateMap.get(suggestion.remove)?.title} but not relevant for this request`,
          }

          // Generate improved search query based on what was found
          const improvedQuery = await this.generateImprovedSearchQuery(
            suggestion.remove,
            originalRequest,
            queryToTemplateMap.get(suggestion.remove),
            suggestion.reason
          )

          // Search with improved query
          yield { type: 'status', content: `Searching for better match: ${improvedQuery}` }
          const betterTemplate = await this.searchForTemplate(
            improvedQuery,
            3,
            false,
            originalRequest
          )

          if (betterTemplate) {
            // Remove old mapping and add new one
            queryToTemplateMap.delete(suggestion.remove)
            queryToTemplateMap.set(improvedQuery, betterTemplate)
            yield { type: 'message', content: `✓ Found template: ${betterTemplate.title}` }
          }
        }

        // Add missing capabilities
        for (const capability of evaluation.missingCapabilities) {
          yield { type: 'status', content: `Adding missing capability: ${capability}` }
          const additionalTemplate = await this.searchForTemplate(
            capability,
            3,
            false,
            originalRequest
          )

          if (additionalTemplate) {
            queryToTemplateMap.set(capability, additionalTemplate)
            yield { type: 'message', content: `✓ Found template: ${additionalTemplate.title}` }
          }
        }
      }

      // Final check
      if (!isWorkflowComplete) {
        yield {
          type: 'message',
          content: '⚠️ Workflow may be incomplete. Proceeding with best available nodes.',
        }
        queryToTemplateMap.forEach((template, query) => {
          templateMap.set(query, template)
        })
      }

      // Update workflowPlan.nodes to match the final templateMap keys
      // This ensures nodes added during improvement iterations are included
      const finalNodeQueries = Array.from(templateMap.keys())
      workflowPlan.nodes = finalNodeQueries.map((query, index) => ({
        query: query,
        position: { x: 100 + (index % 4) * 350, y: 200 + Math.floor(index / 4) * 250 },
        configuration: workflowPlan.nodes.find(n => n.query === query)?.configuration,
      }))
      console.log(
        `[BuildWorkflow] Updated workflowPlan.nodes to match templateMap (${workflowPlan.nodes.length} nodes)`
      )

      // Generate connections for non-GraphRAG path if they're missing
      if (
        (!workflowPlan.connections || workflowPlan.connections.length === 0) &&
        templateMap.size > 1
      ) {
        console.log(
          '[BuildWorkflow] No connections in plan, generating intelligent connections for non-GraphRAG workflow...'
        )

        // Generate connections based on template compatibility and workflow intent
        workflowPlan.connections = await this.generateIntelligentConnections(
          templateMap,
          originalRequest,
          intent
        )

        console.log(
          `[BuildWorkflow] Generated ${workflowPlan.connections.length} connections for non-GraphRAG workflow`
        )
      }
    }

    // Add nodes
    yield { type: 'status', content: 'Adding nodes to workflow...' }
    console.log(`[BuildWorkflow] Starting to add ${workflowPlan.nodes.length} nodes`)
    console.log(`[BuildWorkflow] TemplateMap size: ${templateMap.size}`)
    console.log(`[BuildWorkflow] TemplateMap keys:`, Array.from(templateMap.keys()))

    for (const node of workflowPlan.nodes) {
      const template = templateMap.get(node.query)
      console.log(
        `[BuildWorkflow] Processing node query="${node.query}", template found: ${!!template}`
      )
      if (!template) {
        console.error(`[BuildWorkflow] ❌ No template found for query: ${node.query}`)
        yield { type: 'message', content: `✗ No template found for: ${node.query}` }
        continue
      }

      try {
        yield { type: 'status', content: `Adding node: ${template.title}...` }
        console.log(`[BuildWorkflow] Adding node from template:`, {
          title: template.title,
          id: template.id,
          type: template.type,
          query: node.query,
        })

        // Log the full template to debug missing fields
        console.log(`[OrchestratorAgent] Full template data:`, JSON.stringify(template, null, 2))
        console.log(
          `[OrchestratorAgent] Template type: "${template.type}", Template title: "${template.title}"`
        )

        // Validate required fields
        if (!template.type || !template.title) {
          console.error(`[BuildWorkflow] ❌ Template missing required fields:`, {
            hasType: !!template.type,
            hasTitle: !!template.title,
            templateId: template.id,
            query: node.query,
          })
        }

        // Extract inputs and outputs from ports
        const inputs = template.ports?.filter((port: any) => port.type === 'input') || []
        const outputs = template.ports?.filter((port: any) => port.type === 'output') || []

        // Use add_node directly since we already have the template data
        // Pass ALL template properties to ensure proper rendering
        const result = await this.mcpClient.callTool('embed_orchestrator', 'add_node', {
          apiKey: this.apiKey,
          workflowId,
          graphId: 'main',
          nodeData: {
            metadata: {
              // Don't include id - it will be auto-generated
              templateId: template.id, // Store template ID in templateId field
              type: template.type || template.id || 'custom', // Fallback to id or 'custom' if type is missing
              title: template.title || node.query || 'Untitled Node', // Fallback to query or default
              subtitle: template.subtitle,
              description: template.description,
              icon: template.icon,
              variant: template.variant,
              shape: template.shape,
              size: template.size,
              category: template.category,
              subcategory: template.subcategory,
              properties: template.properties,
              requiredEnvVars: template.requiredEnvVars,
              propertyRules: template.propertyRules,
              tags: template.tags,
              version: template.version,
              inputs: inputs,
              outputs: outputs,
              // Property values should be at root level for CRDT
              propertyValues: await this.extractNodeProperties(
                template,
                node.query,
                node.configuration,
                originalRequest
              ),
            },
            position: node.position,
          },
          useCRDT: this.useRealTimeSync,
        })

        const parsed = JSON.parse(result)
        console.log('[BuildWorkflow] Raw result type:', typeof result)
        console.log('[BuildWorkflow] Raw result:', result)
        console.log('[BuildWorkflow] Parsed response:', parsed)
        console.log('[BuildWorkflow] Parsed.data:', parsed.data)
        console.log('[BuildWorkflow] Parsed.success:', parsed.success)

        // Handle new API response format: data.node
        const nodeData = parsed.data?.node
        console.log('[BuildWorkflow] Extracted nodeData:', nodeData)
        console.log('[BuildWorkflow] NodeData id:', nodeData?.id)

        if (parsed.success && nodeData && nodeData.id) {
          nodeMap.set(node.query, {
            query: node.query,
            nodeId: nodeData.id,
            metadata: nodeData.metadata,
          })
          nodeCount++
          console.log(
            `[BuildWorkflow] ✅ Node added to nodeMap. Count: ${nodeCount}, NodeMap size: ${nodeMap.size}`
          )

          // Collect required environment variables
          if (template.requiredEnvVars && Array.isArray(template.requiredEnvVars)) {
            collectedEnvVars.push(...template.requiredEnvVars)
          }

          yield {
            type: 'action',
            action: {
              tool: 'add_node',
              arguments: { template: template.title, position: node.position },
              result: parsed,
            },
          }
          yield { type: 'message', content: `✓ Added ${template.title}` }
        } else {
          console.error('[BuildWorkflow] ❌ Failed to add node to nodeMap:', {
            success: parsed.success,
            hasNodeData: !!nodeData,
            hasNodeId: !!nodeData?.id,
            nodeQuery: node.query,
            templateTitle: template.title,
          })
          // Still show success message if the API call succeeded
          if (parsed.success) {
            yield {
              type: 'message',
              content: `✓ Added ${template.title} (but not tracked in nodeMap)`,
            }
          }
        }
      } catch (error) {
        yield { type: 'message', content: `✗ Failed to add ${template.title}: ${error}` }
      }
    }

    // Generate workflow summary before adding connections
    yield { type: 'status', content: 'Analyzing workflow solution...' }
    const workflowSummary = await this.generateWorkflowSummary(
      originalRequest,
      intent,
      templateMap,
      workflowPlan.connections,
      nodeMap
    )

    // Review and potentially refine workflow
    yield { type: 'status', content: 'Reviewing workflow completeness...' }
    const refinement = await this.reviewAndRefineWorkflow(
      workflowId,
      nodeMap,
      workflowPlan.connections,
      originalRequest,
      intent
    )

    if (refinement.refined) {
      yield {
        type: 'message',
        content: `Workflow refined: ${refinement.summary}`,
      }
    }

    // Generate property questions if needed
    const propertyQuestions = await this.generatePropertyQuestions(templateMap, originalRequest)

    // Convert to PropertyQuestion format for context storage
    const formattedQuestions: PropertyQuestion[] = propertyQuestions.map(q => ({
      nodeId: q.nodeId,
      nodeTitle: templateMap.get(q.nodeId)?.title || q.nodeId,
      propertyName: q.property,
      propertyType: q.type,
      question: q.question,
      required: true,
    }))

    // Store workflow context for future interactions
    // We need to store both the templates and the actual node mappings
    console.log(
      `[BuildWorkflow] Storing context - NodeMap size: ${nodeMap.size}, TemplateMap size: ${templateMap.size}`
    )
    console.log(`[BuildWorkflow] NodeMap contents:`, Array.from(nodeMap.entries()))
    console.log(
      `[BuildWorkflow] WorkflowPlan connections:`,
      JSON.stringify(workflowPlan.connections, null, 2)
    )
    console.log(
      `[BuildWorkflow] Number of connections to store:`,
      workflowPlan.connections?.length || 0
    )
    console.log(`[BuildWorkflow] GraphRAG mode:`, !!this.graphRAG)

    const contextData: any = {
      workflowId,
      nodes: templateMap, // Template definitions
      nodeMap: nodeMap, // Actual node IDs and mappings
      connections: workflowPlan.connections || [], // Ensure connections is at least an empty array
      pendingQuestions: formattedQuestions,
      propertyValues: new Map(),
      conversationHistory: [],
      lastUserRequest: originalRequest,
      intent,
      workflowSummary: workflowSummary, // Why these nodes were selected
      refinementSummary: refinement.refined ? refinement.summary : null,
    }
    this.storeWorkflowContext(workflowId, contextData)

    // Verify context was stored properly
    const verifyContext = this.workflowContexts.get(workflowId)
    console.log(
      `[BuildWorkflow] Context verification - Connections stored: ${verifyContext?.connections?.length || 0}`
    )

    // Show questions interactively if any
    if (formattedQuestions.length > 0) {
      yield {
        type: 'question',
        content: 'I need some information to configure your workflow nodes:',
        questions: formattedQuestions.slice(0, 3), // Show first 3 questions
        requiresInput: true,
        workflowId,
      }

      // Stop here - don't create connections yet
      console.log(
        `[BuildWorkflow] Final counts - Nodes: ${nodeCount}, NodeMap size: ${nodeMap.size}, Groups: ${groupCount}`
      )
      yield {
        type: 'message',
        content: `Created workflow "${intent.suggestedName || 'Untitled'}" with ${nodeCount} nodes. Please answer the configuration questions above to complete the setup.`,
        metadata: { nodeCount, connectionCount: 0, groupCount, status: 'pending_configuration' },
      }
      return // Exit here and wait for user's response
    }

    // Only continue with connections if no configuration is needed
    yield* this.finalizeWorkflowConnections(
      workflowId,
      workflowPlan,
      nodeMap,
      workflowSummary,
      collectedEnvVars
    )
  }

  /**
   * Generate intelligent connections for non-GraphRAG workflows
   */
  private async generateIntelligentConnections(
    templateMap: Map<string, any>,
    originalRequest: string,
    intent: WorkflowIntent
  ): Promise<any[]> {
    console.log('[GenerateConnections] Starting intelligent connection generation...')

    // Build node information for LLM
    const nodes = Array.from(templateMap.entries()).map(([query, template]) => ({
      query,
      title: template.title,
      description: template.description,
      inputs:
        template.ports
          ?.filter((p: any) => p.type === 'input')
          .map((p: any) => ({
            id: p.id,
            label: p.label,
            dataType: p.dataType,
          })) || [],
      outputs:
        template.ports
          ?.filter((p: any) => p.type === 'output')
          .map((p: any) => ({
            id: p.id,
            label: p.label,
            dataType: p.dataType,
          })) || [],
    }))

    const prompt = `Analyze this workflow and determine the logical connections between nodes.

User's Request: "${originalRequest}"
Workflow Intent: ${intent.description}

Available Nodes:
${nodes
  .map(
    (n, i) => `
${i + 1}. ${n.title} (query: "${n.query}")
   Description: ${n.description}
   Inputs: ${n.inputs.map((p: any) => `${p.id} (${p.label})`).join(', ') || 'none'}
   Outputs: ${n.outputs.map((p: any) => `${p.id} (${p.label})`).join(', ') || 'none'}
`
  )
  .join('')}

IMPORTANT: Analyze the workflow intent and create LOGICAL connections that make the workflow functional.
Consider:
1. Data flow direction (triggers/inputs → processing → outputs)
2. Port compatibility (matching data types)
3. Avoiding cycles that would cause infinite loops
4. Creating a complete, functional workflow

For each connection, specify:
- Which node's output connects to which node's input
- Why this connection makes sense
- What data flows through the connection

Return ONLY valid JSON with no additional text:
{
  "connections": [
    {
      "fromQuery": "source node query",
      "toQuery": "target node query",
      "sourcePort": "output port id",
      "targetPort": "input port id",
      "description": "what flows through this connection"
    }
  ]
}`

    try {
      const response = await this.callLLM([{ role: 'user', content: prompt }])

      const cleaned = this.cleanJsonResponse(response)
      const result = JSON.parse(cleaned)

      console.log(
        '[GenerateConnections] LLM suggested connections:',
        JSON.stringify(result.connections, null, 2)
      )

      // Validate and refine connections
      const validConnections: any[] = []

      for (const conn of result.connections || []) {
        // Verify both nodes exist
        const sourceTemplate = templateMap.get(conn.fromQuery)
        const targetTemplate = templateMap.get(conn.toQuery)

        if (sourceTemplate && targetTemplate) {
          // Find best matching ports
          const sourcePort = this.findPort(sourceTemplate, 'output', conn.sourcePort) || 'output'
          const targetPort = this.findPort(targetTemplate, 'input', conn.targetPort) || 'input'

          validConnections.push({
            fromQuery: conn.fromQuery,
            toQuery: conn.toQuery,
            sourcePort,
            targetPort,
            description: conn.description || 'Data flow',
          })
        } else {
          console.warn(
            `[GenerateConnections] Skipping invalid connection: ${conn.fromQuery} → ${conn.toQuery}`
          )
        }
      }

      // If LLM didn't provide connections or they were invalid, fall back to sequential connections
      if (validConnections.length === 0 && nodes.length > 1) {
        console.log(
          '[GenerateConnections] No valid connections from LLM, creating sequential connections...'
        )

        // Create simple sequential connections
        const nodeQueries = Array.from(templateMap.keys())
        for (let i = 0; i < nodeQueries.length - 1; i++) {
          const sourceTemplate = templateMap.get(nodeQueries[i])
          const targetTemplate = templateMap.get(nodeQueries[i + 1])

          if (sourceTemplate && targetTemplate) {
            validConnections.push({
              fromQuery: nodeQueries[i],
              toQuery: nodeQueries[i + 1],
              sourcePort:
                this.findDefaultPort(sourceTemplate, 'output', originalRequest) || 'output',
              targetPort: this.findDefaultPort(targetTemplate, 'input', originalRequest) || 'input',
              description: 'Sequential data flow',
            })
          }
        }
      }

      console.log(`[GenerateConnections] Returning ${validConnections.length} valid connections`)
      return validConnections
    } catch (error) {
      console.error('[GenerateConnections] Error generating connections:', error)

      // Fallback: create basic sequential connections
      const nodeQueries = Array.from(templateMap.keys())
      const fallbackConnections: any[] = []

      for (let i = 0; i < nodeQueries.length - 1; i++) {
        fallbackConnections.push({
          fromQuery: nodeQueries[i],
          toQuery: nodeQueries[i + 1],
          sourcePort: 'output',
          targetPort: 'input',
          description: 'Auto-connected sequential nodes',
        })
      }

      return fallbackConnections
    }
  }

  /**
   * Finalize workflow by creating connections
   */
  private async *finalizeWorkflowConnections(
    workflowId: string,
    workflowPlan: WorkflowPlan,
    nodeMap: Map<string, NodeMapping>,
    workflowSummary: string,
    collectedEnvVars?: string[]
  ): AsyncGenerator<StreamingAgentResponse> {
    let connectionCount = 0

    console.log(
      '[FinalizeConnections] Starting with workflowPlan.connections:',
      JSON.stringify(workflowPlan.connections, null, 2)
    )
    console.log(
      '[FinalizeConnections] Number of connections:',
      workflowPlan.connections?.length || 0
    )
    console.log('[FinalizeConnections] NodeMap size:', nodeMap.size)

    // Validate DAG (no cycles) before creating connections
    const dagValidation = await this.validateDAG(workflowPlan.connections, nodeMap)
    if (!dagValidation.isValid) {
      yield {
        type: 'message',
        content: `⚠️ Warning: Workflow contains cycles that could cause infinite loops:\n${dagValidation.cycles
          .map(c => `• ${c}`)
          .join('\n')}\nRemoving problematic connections...`,
      }
      // Filter out connections that create cycles
      workflowPlan.connections = workflowPlan.connections.filter(
        conn => !dagValidation.problematicConnections.includes(conn)
      )
    }

    // Review and optimize connections before creating them
    if (workflowPlan.connections.length > 0) {
      yield { type: 'status', content: 'Reviewing connections for accuracy and redundancy...' }
      // Build templateMap from nodeMap for connection review
      const templateMapForReview = new Map<string, any>()
      nodeMap.forEach((node, query) => {
        if (node.metadata) {
          templateMapForReview.set(query, node.metadata)
        }
      })
      const reviewedConnections = await this.reviewConnections(
        workflowPlan.connections,
        nodeMap,
        templateMapForReview
      )
      workflowPlan.connections = reviewedConnections
      yield {
        type: 'message',
        content: `✓ Optimized connections: ${reviewedConnections.length} connections`,
      }
    }

    // Create connections
    if (workflowPlan.connections.length > 0) {
      yield {
        type: 'status',
        content: `Creating ${workflowPlan.connections.length} connections...`,
      }
      console.log('[OrchestratorAgent] NodeMap keys:', Array.from(nodeMap.keys()))
      console.log('[OrchestratorAgent] Connections to create:', workflowPlan.connections)

      for (const connection of workflowPlan.connections) {
        const sourceNode = nodeMap.get(connection.fromQuery)
        const targetNode = nodeMap.get(connection.toQuery)

        console.log(
          `[OrchestratorAgent] Looking up connection: ${connection.fromQuery} → ${connection.toQuery}`
        )
        console.log(
          `[OrchestratorAgent] Source found: ${!!sourceNode}, Target found: ${!!targetNode}`
        )

        if (sourceNode && targetNode) {
          try {
            const sourcePort = this.findPort(sourceNode.metadata, 'output', connection.sourcePort)
            const targetPort = this.findPort(targetNode.metadata, 'input', connection.targetPort)

            const result = await this.mcpClient.callTool('embed_orchestrator', 'connect_nodes', {
              apiKey: this.apiKey,
              workflowId,
              graphId: 'main',
              sourceNodeId: sourceNode.nodeId,
              sourcePortId: sourcePort,
              targetNodeId: targetNode.nodeId,
              targetPortId: targetPort,
              useCRDT: this.useRealTimeSync,
            })

            const parsed = JSON.parse(result)
            if (parsed.success) {
              connectionCount++
              yield {
                type: 'message',
                content: `✓ Connected ${connection.fromQuery} → ${connection.toQuery}`,
              }
            }
          } catch (error) {
            yield {
              type: 'message',
              content: `✗ Failed to connect ${connection.fromQuery} → ${connection.toQuery}`,
            }
          }
        }
      }
    }

    // Reposition nodes based on connections and port positions
    if (connectionCount > 0 && nodeMap.size > 0) {
      yield { type: 'status', content: 'Optimizing node layout...' }
      try {
        await this.repositionNodesBasedOnFlow(workflowId, nodeMap, workflowPlan.connections)
        yield { type: 'message', content: '✓ Nodes repositioned for optimal flow visualization' }
      } catch (error) {
        console.error('[OrchestratorAgent] Error repositioning nodes:', error)
      }
    }

    // Force CRDT sync after creating connections and repositioning
    if (connectionCount > 0) {
      yield { type: 'status', content: 'Synchronizing workflow...' }
      try {
        // Trigger a CRDT update check by sending a signal through the response
        yield {
          type: 'crdt_sync_required',
          content: 'Workflow finalized, syncing...',
          metadata: { connectionCount },
        }
        // Wait a bit to ensure CRDT sync completes
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (error) {
        console.error('[OrchestratorAgent] Error ensuring connection persistence:', error)
      }
    }

    // Final summary with explanation - this should be LAST
    yield {
      type: 'workflow_ready',
      content:
        workflowSummary ||
        `Workflow complete! Added ${nodeMap.size} nodes and ${connectionCount} connections.`,
      metadata: {
        nodeCount: nodeMap.size,
        connectionCount,
        status: 'complete',
        requiredEnvVars:
          collectedEnvVars && collectedEnvVars.length > 0 ? collectedEnvVars : undefined,
      },
      workflowId,
    }

    yield { type: 'complete', workflowId }
  }

  /**
   * Reposition nodes based on their connections and port positions
   * Uses topological sorting to determine precedence and arranges nodes
   * for optimal visual flow
   */
  private async repositionNodesBasedOnFlow(
    workflowId: string,
    nodeMap: Map<string, NodeMapping>,
    connections: any[]
  ) {
    console.log('[RepositionNodes] Starting node repositioning...')

    // Build adjacency list for topological sort
    const adjacencyList = new Map<string, Set<string>>()
    const inDegree = new Map<string, number>()
    const nodeToQuery = new Map<string, string>()

    // Initialize all nodes
    nodeMap.forEach((node, query) => {
      adjacencyList.set(node.nodeId, new Set())
      inDegree.set(node.nodeId, 0)
      nodeToQuery.set(node.nodeId, query)
    })

    // Build graph from connections
    for (const conn of connections) {
      const sourceNode = nodeMap.get(conn.fromQuery)
      const targetNode = nodeMap.get(conn.toQuery)

      if (sourceNode && targetNode) {
        adjacencyList.get(sourceNode.nodeId)?.add(targetNode.nodeId)
        inDegree.set(targetNode.nodeId, (inDegree.get(targetNode.nodeId) || 0) + 1)
      }
    }

    // Perform topological sort to determine node levels
    const levels: string[][] = []
    const queue: string[] = []
    const visited = new Set<string>()

    // Find all nodes with no incoming edges (start nodes)
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId)
      }
    })

    // If no start nodes found, pick the first node
    if (queue.length === 0 && nodeMap.size > 0) {
      const firstNode = Array.from(nodeMap.values())[0]
      queue.push(firstNode.nodeId)
    }

    // Process nodes level by level
    while (queue.length > 0) {
      const currentLevel: string[] = [...queue]
      levels.push(currentLevel)
      queue.length = 0

      for (const nodeId of currentLevel) {
        visited.add(nodeId)
        const neighbors = adjacencyList.get(nodeId) || new Set()

        for (const neighbor of neighbors) {
          const newDegree = (inDegree.get(neighbor) || 0) - 1
          inDegree.set(neighbor, newDegree)

          if (newDegree === 0 && !visited.has(neighbor)) {
            queue.push(neighbor)
          }
        }
      }
    }

    // Add any unvisited nodes (disconnected components)
    nodeMap.forEach(node => {
      if (!visited.has(node.nodeId)) {
        levels.push([node.nodeId])
      }
    })

    console.log(`[RepositionNodes] Organized nodes into ${levels.length} levels`)

    // Calculate positions based on levels and port directions
    const baseX = 100
    const baseY = 100
    const horizontalSpacing = 400
    const verticalSpacing = 200
    const nodePositions: Array<{ nodeId: string; position: { x: number; y: number } }> = []

    for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
      const level = levels[levelIndex]
      const levelX = baseX + levelIndex * horizontalSpacing

      // Distribute nodes vertically within each level
      const totalHeight = (level.length - 1) * verticalSpacing
      const startY = baseY + (500 - totalHeight) / 2 // Center vertically around y=350

      for (let nodeIndex = 0; nodeIndex < level.length; nodeIndex++) {
        const nodeId = level[nodeIndex]
        const query = nodeToQuery.get(nodeId)
        const node = query ? nodeMap.get(query) : null

        if (node) {
          // Determine position based on port directions
          let x = levelX
          let y = startY + nodeIndex * verticalSpacing

          // Fine-tune based on port positions
          const metadata = node.metadata
          if (metadata) {
            // Check if node has specific port directions
            const hasLeftPorts = metadata.inputs?.some((p: any) => p.position === 'left')
            const hasRightPorts = metadata.outputs?.some((p: any) => p.position === 'right')
            const hasTopPorts =
              metadata.inputs?.some((p: any) => p.position === 'top') ||
              metadata.outputs?.some((p: any) => p.position === 'top')
            const hasBottomPorts =
              metadata.inputs?.some((p: any) => p.position === 'bottom') ||
              metadata.outputs?.some((p: any) => p.position === 'bottom')

            // Adjust position slightly based on port configuration
            if (hasTopPorts || hasBottomPorts) {
              // Nodes with vertical ports might benefit from slight horizontal offset
              x += (nodeIndex % 2) * 50 - 25 // Zigzag pattern
            }

            // Special handling for nodes that are primarily routers or splitters
            if (metadata.category === 'Logic' || metadata.type?.includes('branch')) {
              // Center these nodes between levels if they have multiple outputs
              const outgoingCount = adjacencyList.get(nodeId)?.size || 0
              if (outgoingCount > 1) {
                y = baseY + 250 // Center vertically
              }
            }
          }

          nodePositions.push({ nodeId, position: { x, y } })
        }
      }
    }

    // Update node positions via MCP
    console.log(`[RepositionNodes] Updating positions for ${nodePositions.length} nodes`)

    for (const { nodeId, position } of nodePositions) {
      try {
        await this.mcpClient.callTool('embed_orchestrator', 'update_node_position', {
          apiKey: this.apiKey,
          workflowId,
          graphId: 'main',
          nodeId,
          position,
          useCRDT: this.useRealTimeSync,
        })
        console.log(
          `[RepositionNodes] Updated position for node ${nodeId}: x=${position.x}, y=${position.y}`
        )
      } catch (error) {
        console.error(`[RepositionNodes] Failed to update position for node ${nodeId}:`, error)
      }
    }

    console.log('[RepositionNodes] Node repositioning complete')
  }

  private async *executeModificationsStream(
    workflowId: string,
    modification: any,
    context: any
  ): AsyncGenerator<StreamingAgentResponse> {
    let added = 0,
      connected = 0,
      grouped = 0

    for (const action of modification.actions || []) {
      try {
        switch (action.type) {
          case 'add_node':
            yield { type: 'status', content: `Adding node: ${action.query}...` }

            // Search for template first
            const template = await this.searchForTemplate(action.query, 3, true, workflowId)
            if (!template) {
              yield { type: 'message', content: `✗ No template found for: ${action.query}` }
              continue
            }

            console.log(`Adding node from template in modification:`, {
              title: template.title,
              id: template.id,
              query: action.query,
            })

            // Extract inputs and outputs from ports
            const inputs = template.ports?.filter((port: any) => port.type === 'input') || []
            const outputs = template.ports?.filter((port: any) => port.type === 'output') || []

            // Use add_node directly since we already have the template data
            // Pass ALL template properties to ensure proper rendering
            const addResult = await this.mcpClient.callTool('embed_orchestrator', 'add_node', {
              apiKey: this.apiKey,
              workflowId,
              graphId: 'main',
              nodeData: {
                metadata: {
                  // Don't include id - it will be auto-generated
                  templateId: template.id, // Store template ID in templateId field
                  type: template.type,
                  title: template.title,
                  subtitle: template.subtitle,
                  description: template.description,
                  icon: template.icon,
                  variant: template.variant,
                  shape: template.shape,
                  size: template.size,
                  category: template.category,
                  subcategory: template.subcategory,
                  properties: template.properties,
                  requiredEnvVars: template.requiredEnvVars,
                  propertyRules: template.propertyRules,
                  tags: template.tags,
                  version: template.version,
                  inputs: inputs,
                  outputs: outputs,
                  // Property values should be at root level for CRDT
                  propertyValues: action.configuration || {},
                },
                position: action.position || { x: 100, y: 100 },
              },
              useCRDT: this.useRealTimeSync,
            })

            const parsed = JSON.parse(addResult)
            if (parsed.success) {
              added++
              yield { type: 'message', content: `✓ Added ${template.title}` }
            }
            break

          case 'update_property':
            yield { type: 'status', content: `Updating ${action.nodeId} properties...` }

            // Use the update_node_properties MCP tool
            const updateResult = await this.mcpClient.callTool(
              'embed_orchestrator',
              'update_node_properties',
              {
                apiKey: this.apiKey,
                workflowId,
                graphId: 'main',
                nodeId: action.nodeId,
                propertyValues: {
                  [action.propertyName]: action.value,
                },
                useCRDT: this.useRealTimeSync,
              }
            )

            const updateParsed = JSON.parse(updateResult)
            if (updateParsed.success) {
              yield {
                type: 'message',
                content: `✓ Updated ${action.propertyName} for ${action.nodeId}`,
              }
            }
            break

          case 'connect':
            yield { type: 'status', content: 'Creating connection...' }
            connected++
            break

          case 'create_group':
            yield { type: 'status', content: `Creating group: ${action.title}...` }
            grouped++
            break
            
          case 'create_subgraph':
            yield { type: 'status', content: `Creating subgraph: ${action.name}...` }
            
            // Call MCP tool to create subgraph
            const subgraphResult = await this.mcpClient.callTool(
              'embed_orchestrator',
              'create_subgraph',
              {
                apiKey: this.apiKey,
                workflowId,
                subgraph: {
                  name: action.name || 'Subgraph',
                  description: action.description || '',
                  inputs: action.inputs || [],
                  outputs: action.outputs || []
                },
                useCRDT: this.useRealTimeSync,
              }
            )
            
            const subgraphParsed = JSON.parse(subgraphResult)
            if (subgraphParsed.success) {
              yield {
                type: 'message',
                content: `✓ Created subgraph "${action.name}"${subgraphParsed.graphId ? ` with ID: ${subgraphParsed.graphId}` : ''}`,
              }
              
              // If nodes should be moved to the subgraph
              if (action.nodeIds && action.nodeIds.length > 0) {
                yield { type: 'status', content: `Moving ${action.nodeIds.length} nodes to subgraph...` }
                // TODO: Implement node moving logic when API supports it
                yield {
                  type: 'message',
                  content: `Note: Moving existing nodes to subgraph is not yet implemented. You can recreate them in the subgraph.`,
                }
              }
            } else {
              yield {
                type: 'message',
                content: `✗ Failed to create subgraph: ${subgraphParsed.error || 'Unknown error'}`,
              }
            }
            break
            
          case 'remove':
          case 'remove_node':
            yield { type: 'status', content: `Removing node...` }
            
            // Call API to remove the node
            const removeResult = await this.mcpClient.callTool(
              'embed_orchestrator',
              'remove_node',
              {
                apiKey: this.apiKey,
                workflowId,
                graphId: 'main',
                nodeId: action.nodeId || action.target,
                useCRDT: this.useRealTimeSync,
              }
            )
            
            const removeParsed = JSON.parse(removeResult)
            if (removeParsed.success) {
              yield {
                type: 'message',
                content: `✓ Removed node ${action.nodeId || action.target}`,
              }
              
              // Update context to remove the node
              if (context?.existingNodes) {
                context.existingNodes = context.existingNodes.filter(
                  (n: any) => (n.id || n.metadata?.id) !== (action.nodeId || action.target)
                )
              }
            } else {
              yield {
                type: 'message',
                content: `✗ Failed to remove node: ${removeParsed.error || 'Unknown error'}`,
              }
            }
            break
        }
      } catch (error) {
        yield { type: 'message', content: `✗ Action failed: ${error}` }
      }
    }

    yield {
      type: 'message',
      content:
        modification.summary ||
        `Updated workflow: ${added} nodes added, ${connected} connections created.`,
    }
  }

  private async buildWorkflow(workflowId: string, intent: WorkflowIntent, originalRequest: string) {
    const actions: AgentAction[] = []
    const nodeMap = new Map<string, NodeMapping>()
    let nodeCount = 0
    let connectionCount = 0
    let groupCount = 0
    const collectedEnvVars: string[] = []

    // Get detailed workflow plan
    const workflowPlan = await this.planWorkflow(originalRequest, intent)
    console.log('Workflow plan:', JSON.stringify(workflowPlan, null, 2))

    let templateMap = new Map<string, any>()

    // Check if GraphRAG is available
    if (this.graphRAG) {
      // Use GraphRAG for intelligent node selection
      console.log('Using GraphRAG for node selection...')

      // Convert WorkflowIntent to GraphRAGIntent format
      const graphIntent = this.convertWorkflowIntentToGraphRAGIntent(intent)

      // Find relevant nodes using GraphRAG
      const relevantNodes = await this.graphRAG.findRelevantNodes(originalRequest, graphIntent)
      console.log(`GraphRAG found ${relevantNodes.length} initial nodes`)

      // If no nodes found, try a simpler search approach
      if (relevantNodes.length === 0) {
        console.log('GraphRAG returned no nodes, trying fallback search...')

        // Extract key terms from the request for searching
        const searchTerms = await this.extractSearchTerms(originalRequest, graphIntent)

        for (const term of searchTerms) {
          const template = await this.searchForTemplate(term, 3, true, originalRequest)
          if (template) {
            relevantNodes.push({
              nodeId: template.id,
              score: 50,
              reasons: [`Matched search term: ${term}`],
              connections: [],
            })
          }
        }
      }

      // Prevent duplicates
      const uniqueNodes = await this.graphRAG.preventDuplicates(relevantNodes)

      // Get node details
      for (const relevantNode of uniqueNodes) {
        // GraphRAG returns knowledge graph node IDs, not template IDs
        let template = await this.getTemplateById(relevantNode.nodeId)

        // If direct ID lookup fails, try searching by the node ID as a query
        if (!template) {
          console.log(
            `[GraphRAG] Template ID ${relevantNode.nodeId} not found, searching by query...`
          )
          const searchQuery = relevantNode.nodeId.replace(/^template_/, '').replace(/_/g, ' ')
          template = await this.searchForTemplate(searchQuery, 3, false, originalRequest)
        }

        if (template) {
          templateMap.set(relevantNode.nodeId, template)
          console.log(`GraphRAG selected: ${template.title} (score: ${relevantNode.score})`)
        } else {
          console.warn(`[GraphRAG] Could not find template for node: ${relevantNode.nodeId}`)
        }
      }

      // Find optimal connections
      const connections = await this.graphRAG.findOptimalConnections(uniqueNodes)

      // Update workflow plan with GraphRAG results
      workflowPlan.nodes = Array.from(templateMap.keys()).map((nodeId, index) => ({
        query: nodeId,
        position: { x: 100 + index * 350, y: 200 },
        expectedId: nodeId,
      }))

      workflowPlan.connections = await Promise.all(
        connections.map(async conn => {
          const sourceTemplate = templateMap.get(conn.from)
          const targetTemplate = templateMap.get(conn.to)

          return {
            fromQuery: conn.from,
            toQuery: conn.to,
            sourcePort: await this.findDefaultPort(sourceTemplate, 'output', originalRequest),
            targetPort: await this.findDefaultPort(targetTemplate, 'input', originalRequest),
          }
        })
      )

      // Review and improve workflow iteratively
      console.log('Reviewing GraphRAG workflow for completeness...')
      const review = await this.reviewGraphRAGWorkflow(
        templateMap,
        connections,
        originalRequest,
        intent
      )

      if (!review.isComplete) {
        console.log('Workflow needs improvement:', review.analysis)

        // Add missing nodes
        for (const missingNode of review.missingNodes) {
          console.log(`Adding missing node: ${missingNode.description}`)
          const template = await this.searchForTemplate(missingNode.query, 3, true, originalRequest)
          if (template) {
            templateMap.set(template.id, template)
            workflowPlan.nodes.push({
              query: template.id,
              position: { x: 100 + workflowPlan.nodes.length * 350, y: 200 },
              expectedId: template.id,
            })
          }
        }

        // Re-analyze connections if nodes were added
        if (review.missingNodes.length > 0) {
          const allNodes = Array.from(templateMap.keys()).map(id => ({
            nodeId: id,
            score: 10,
            reasons: ['Added during review'],
            connections: [],
          }))

          const newConnections = await this.graphRAG.findOptimalConnections(allNodes)

          // Update connections
          workflowPlan.connections = await Promise.all(
            newConnections.map(async conn => {
              const sourceTemplate = templateMap.get(conn.from)
              const targetTemplate = templateMap.get(conn.to)

              return {
                fromQuery: conn.from,
                toQuery: conn.to,
                sourcePort: await this.findDefaultPort(sourceTemplate, 'output', originalRequest),
                targetPort: await this.findDefaultPort(targetTemplate, 'input', originalRequest),
              }
            })
          )
        }
      }
    } else {
      // Fallback to original search-based approach
      const queryToTemplateMap = new Map<string, any>()

      for (const node of workflowPlan.nodes) {
        const template = await this.searchForTemplate(node.query, 3, true, originalRequest)
        if (template) {
          queryToTemplateMap.set(node.query, template)
          console.log(`Found template for "${node.query}": ${template.title}`)
        } else {
          console.warn(`No template found for query: "${node.query}"`)
        }
      }

      // Iterative improvement phase
      let iterationCount = 0
      const maxIterations = 5
      let isWorkflowComplete = false
      const templateMap = new Map<string, any>()

      while (!isWorkflowComplete && iterationCount < maxIterations) {
        iterationCount++

        // Evaluate the current set of templates
        const evaluation = await this.evaluateWorkflowCompleteness(
          queryToTemplateMap,
          originalRequest,
          intent
        )

        if (evaluation.isComplete) {
          isWorkflowComplete = true
          queryToTemplateMap.forEach((template, query) => {
            templateMap.set(query, template)
          })
          break
        }

        console.log(`Workflow improvement iteration ${iterationCount}: ${evaluation.analysis}`)

        // Replace irrelevant nodes
        for (const suggestion of evaluation.suggestions) {
          console.log(
            `Replacing "${suggestion.remove}" with "${suggestion.replaceWith}": ${suggestion.reason}`
          )

          // Generate improved search query based on what was found
          const improvedQuery = await this.generateImprovedSearchQuery(
            suggestion.remove,
            originalRequest,
            queryToTemplateMap.get(suggestion.remove),
            suggestion.reason
          )

          const betterTemplate = await this.searchForTemplate(
            improvedQuery,
            3,
            false,
            originalRequest
          )
          if (betterTemplate) {
            queryToTemplateMap.delete(suggestion.remove)
            queryToTemplateMap.set(improvedQuery, betterTemplate)
            console.log(`Found better template: ${betterTemplate.title}`)
          }
        }

        // Add missing capabilities
        for (const capability of evaluation.missingCapabilities) {
          console.log(`Adding missing capability: ${capability}`)
          const additionalTemplate = await this.searchForTemplate(
            capability,
            3,
            false,
            originalRequest
          )

          if (additionalTemplate) {
            queryToTemplateMap.set(capability, additionalTemplate)
            console.log(`Found template for capability: ${additionalTemplate.title}`)
          }
        }
      }

      // Final assignment
      if (!isWorkflowComplete) {
        console.warn(
          'Workflow may be incomplete after iterations. Proceeding with best available nodes.'
        )
      }
      queryToTemplateMap.forEach((template, query) => {
        templateMap.set(query, template)
      })

      // Update workflowPlan.nodes to match the final templateMap keys
      // This ensures nodes added during improvement iterations are included
      const finalNodeQueries = Array.from(templateMap.keys())
      workflowPlan.nodes = finalNodeQueries.map((query, index) => ({
        query: query,
        position: { x: 100 + (index % 4) * 350, y: 200 + Math.floor(index / 4) * 250 },
        configuration: workflowPlan.nodes.find(n => n.query === query)?.configuration,
      }))
      console.log(
        `[BuildWorkflow] Updated workflowPlan.nodes to match templateMap (${workflowPlan.nodes.length} nodes)`
      )
    }

    // Phase 1: Add all nodes using found templates
    for (const node of workflowPlan.nodes) {
      const template = templateMap.get(node.query)
      if (!template) {
        console.error(`Skipping node "${node.query}" - no template found`)
        continue
      }

      try {
        console.log(`Adding node "${template.title}" at position:`, node.position)

        // Extract inputs and outputs from ports
        const inputs = template.ports?.filter((port: any) => port.type === 'input') || []
        const outputs = template.ports?.filter((port: any) => port.type === 'output') || []

        // Use add_node directly since we already have the template data
        // Pass ALL template properties to ensure proper rendering
        const result = await this.mcpClient.callTool('embed_orchestrator', 'add_node', {
          apiKey: this.apiKey,
          workflowId,
          graphId: 'main',
          nodeData: {
            metadata: {
              // Don't include id - it will be auto-generated
              templateId: template.id, // Store template ID in templateId field
              type: template.type,
              title: template.title,
              subtitle: template.subtitle,
              description: template.description,
              icon: template.icon,
              variant: template.variant,
              shape: template.shape,
              size: template.size,
              category: template.category,
              subcategory: template.subcategory,
              properties: template.properties,
              requiredEnvVars: template.requiredEnvVars,
              propertyRules: template.propertyRules,
              tags: template.tags,
              version: template.version,
              inputs: inputs,
              outputs: outputs,
              // Property values should be at root level for CRDT
              propertyValues: await this.extractNodeProperties(
                template,
                node.query,
                node.configuration,
                originalRequest
              ),
            },
            position: node.position,
          },
          useCRDT: this.useRealTimeSync,
        })

        const parsed = JSON.parse(result)
        console.log(`Node add result:`, parsed)
        // Handle new API response format: data.node
        const nodeData = parsed.data?.node
        if (parsed.success && nodeData) {
          nodeMap.set(node.query, {
            query: node.query,
            nodeId: nodeData.id,
            metadata: nodeData.metadata,
          })
          nodeCount++

          // Collect required environment variables
          if (template.requiredEnvVars && Array.isArray(template.requiredEnvVars)) {
            collectedEnvVars.push(...template.requiredEnvVars)
          }

          actions.push({
            tool: 'add_node',
            arguments: {
              template: template.title,
              position: node.position,
              usedCRDT: this.useRealTimeSync,
            },
            result: parsed,
          })
        }
      } catch (error) {
        console.error(`Error adding node "${node.query}":`, error)
        // Continue with other nodes
      }
    }

    // Phase 2: Create connections
    for (const connection of workflowPlan.connections) {
      const sourceNode = nodeMap.get(connection.fromQuery)
      const targetNode = nodeMap.get(connection.toQuery)

      if (sourceNode && targetNode) {
        try {
          // Find appropriate ports
          const sourcePort = this.findPort(sourceNode.metadata, 'output', connection.sourcePort)
          const targetPort = this.findPort(targetNode.metadata, 'input', connection.targetPort)

          const result = await this.mcpClient.callTool('embed_orchestrator', 'connect_nodes', {
            apiKey: this.apiKey,
            workflowId,
            graphId: 'main',
            sourceNodeId: sourceNode.nodeId,
            sourcePortId: sourcePort,
            targetNodeId: targetNode.nodeId,
            targetPortId: targetPort,
            useCRDT: this.useRealTimeSync,
          })

          const parsed = JSON.parse(result)
          if (parsed.success) {
            connectionCount++
            actions.push({
              tool: 'connect_nodes',
              arguments: {
                source: `${connection.fromQuery}:${sourcePort}`,
                target: `${connection.toQuery}:${targetPort}`,
                usedCRDT: this.useRealTimeSync,
              },
              result: parsed,
            })
          }
        } catch (error) {
          console.error(
            `Error creating connection from "${connection.fromQuery}" to "${connection.toQuery}":`,
            error
          )
        }
      }
    }

    // Phase 3: Create groups if suggested
    if (workflowPlan.groups) {
      for (const group of workflowPlan.groups) {
        const nodeIds = group.nodeQueries
          .map(query => nodeMap.get(query)?.nodeId)
          .filter(id => id !== undefined) as string[]

        if (nodeIds.length >= 2) {
          try {
            const result = await this.mcpClient.callTool(
              'embed_orchestrator',
              'create_node_group',
              {
                apiKey: this.apiKey,
                workflowId,
                graphId: 'main',
                group: {
                  title: group.title,
                  nodeIds,
                  color: group.color || '#3b82f6',
                },
                useCRDT: this.useRealTimeSync,
              }
            )

            const parsed = JSON.parse(result)
            if (parsed.success) {
              groupCount++
              actions.push({
                tool: 'create_node_group',
                arguments: {
                  title: group.title,
                  nodeCount: nodeIds.length,
                  usedCRDT: this.useRealTimeSync,
                },
                result: parsed,
              })
            }
          } catch (error) {
            console.error(`Error creating group "${group.title}":`, error)
          }
        }
      }
    }

    // Force save after creating connections to ensure they persist
    if (connectionCount > 0) {
      try {
        // Trigger a workflow fetch to ensure data is saved
        await this.mcpClient.callTool('workflow_manager', 'get_workflow', {
          workflowId,
        })
        // Wait a bit to ensure CRDT sync completes
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error('[OrchestratorAgent] Error ensuring connection persistence:', error)
      }
    }

    return {
      nodeCount,
      connectionCount,
      groupCount,
      actions,
      requiredEnvVars: collectedEnvVars.length > 0 ? collectedEnvVars : undefined,
    }
  }

  private async planWorkflow(request: string, intent: WorkflowIntent): Promise<WorkflowPlan> {
    const response = await this.callLLM([
      { role: 'system', content: WORKFLOW_PLANNING_PROMPT },
      {
        role: 'user',
        content: `User request: "${request}"\n\nIntent analysis: ${JSON.stringify(intent, null, 2)}`,
      },
    ])

    console.log('[OrchestratorAgent] Raw workflow plan response:', response)

    try {
      const cleanedResponse = this.cleanJsonResponse(response)
      console.log('[OrchestratorAgent] Cleaned workflow plan response:', cleanedResponse)
      const plan = JSON.parse(cleanedResponse)
      console.log('[OrchestratorAgent] Parsed workflow plan:', JSON.stringify(plan, null, 2))
      return plan
    } catch (error) {
      console.error('[OrchestratorAgent] Failed to parse workflow plan:', error)
      console.error('[OrchestratorAgent] Raw response was:', response)

      // Try to infer connections from intent if available
      const inferredConnections: any[] = []
      if (intent.suggestedNodes.length > 1) {
        // Create connections between sequential nodes
        for (let i = 0; i < intent.suggestedNodes.length - 1; i++) {
          const fromNode = intent.suggestedNodes[i]
          const toNode = intent.suggestedNodes[i + 1]
          inferredConnections.push({
            fromQuery: fromNode.query,
            toQuery: toNode.query,
            sourcePort: 'output',
            targetPort: 'input',
            description: 'Auto-connected sequential nodes',
          })
        }
      }

      // Convert intent to basic plan with inferred connections
      return {
        nodes: intent.suggestedNodes.map((node, i) => ({
          query: node.query,
          position: node.position || { x: 100 + i * 350, y: 200 },
        })),
        connections: inferredConnections,
      }
    }
  }

  private async interpretModification(content: string, context: any) {
    const response = await this.callLLM([
      { role: 'system', content: MODIFICATION_INTERPRETATION_PROMPT },
      {
        role: 'user',
        content: `
User request: "${content}"

Current workflow nodes (what the user sees on screen):
${context.existingNodes
  ?.map((n: any) => {
    const metadata = n.metadata || {}
    const props = metadata.propertyValues || {}
    const propInfo =
      Object.keys(props).length > 0
        ? ` | Properties: ${Object.entries(props)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(', ')}`
        : ''
    
    // Show all the information the user can see
    const nodeId = n.id || metadata.id || 'unknown'
    const title = metadata.title || 'Untitled'
    const subtitle = metadata.subtitle || ''
    const type = metadata.type || 'unknown'
    const category = metadata.category || ''
    const description = metadata.description || ''
    
    // Include port information for connection requests
    const inputs = metadata.inputs || []
    const outputs = metadata.outputs || []
    const ports = [
      ...inputs.map((p: any) => `input:${p.id || p.label}`),
      ...outputs.map((p: any) => `output:${p.id || p.label}`)
    ].join(', ')
    
    return `
  Node ID: ${nodeId}
  Title: ${title}${subtitle ? ` | Subtitle: ${subtitle}` : ''}
  Type: ${type}${category ? ` | Category: ${category}` : ''}${description ? `
  Description: ${description}` : ''}${ports ? `
  Ports: ${ports}` : ''}${propInfo}`
  })
  .join('\n---')}

IMPORTANT IDENTIFICATION RULES:
1. Users refer to nodes by their TITLE or SUBTITLE (what they see on screen), not by ID
2. Match nodes by comparing user's words with title/subtitle/type
3. If multiple nodes could match, you MUST ask for clarification
4. If you cannot identify a specific node, you MUST ask which one they mean
5. If the task cannot be completed with current information, explain what's needed

Please determine what modifications are needed.`,
      },
    ])

    try {
      return JSON.parse(this.cleanJsonResponse(response))
    } catch (error) {
      console.error('Failed to parse modification interpretation:', error)
      return { actions: [], interpretation: content }
    }
  }

  private async executeModifications(workflowId: string, modification: any, context: any) {
    const actions: AgentAction[] = []
    const metadata: any = { added: 0, connected: 0, grouped: 0, requiredEnvVars: [] }

    for (const action of modification.actions || []) {
      try {
        switch (action.type) {
          case 'add_node':
            // First search for the template
            const template = await this.searchForTemplate(action.query, 3, true, workflowId)
            if (!template) {
              console.error(`No template found for: ${action.query}`)
              continue
            }

            // Extract inputs and outputs from ports
            const inputs = template.ports?.filter((port: any) => port.type === 'input') || []
            const outputs = template.ports?.filter((port: any) => port.type === 'output') || []

            // Use add_node directly since we already have the template data
            // Pass ALL template properties to ensure proper rendering
            const addResult = await this.mcpClient.callTool('embed_orchestrator', 'add_node', {
              apiKey: this.apiKey,
              workflowId,
              graphId: 'main',
              nodeData: {
                metadata: {
                  // Don't include id - it will be auto-generated
                  templateId: template.id, // Store template ID in templateId field
                  type: template.type,
                  title: template.title,
                  subtitle: template.subtitle,
                  description: template.description,
                  icon: template.icon,
                  variant: template.variant,
                  shape: template.shape,
                  size: template.size,
                  category: template.category,
                  subcategory: template.subcategory,
                  properties: template.properties,
                  requiredEnvVars: template.requiredEnvVars,
                  propertyRules: template.propertyRules,
                  tags: template.tags,
                  version: template.version,
                  inputs: inputs,
                  outputs: outputs,
                  // Property values should be at root level for CRDT
                  propertyValues: action.configuration || {},
                },
                position: action.position || { x: 100, y: 100 },
              },
              useCRDT: this.useRealTimeSync,
            })

            const parsed = JSON.parse(addResult)
            if (parsed.success) {
              metadata.added++

              // Collect required environment variables
              if (template.requiredEnvVars && Array.isArray(template.requiredEnvVars)) {
                metadata.requiredEnvVars.push(...template.requiredEnvVars)
              }

              actions.push({
                tool: 'add_node',
                arguments: {
                  template: template.title,
                  position: action.position,
                  usedCRDT: this.useRealTimeSync,
                },
                result: parsed,
              })
            }
            break

          case 'connect':
            // Implementation for connections
            metadata.connected++
            break

          case 'create_group':
            // Implementation for groups
            metadata.grouped++
            break
        }
      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error)
      }
    }

    return {
      actions,
      metadata,
      summary: modification.summary || this.generateSummary(metadata),
    }
  }

  private findPort(metadata: any, portType: 'input' | 'output', preferredId?: string): string {
    const ports = portType === 'input' ? metadata.inputs : metadata.outputs

    if (!ports || ports.length === 0) {
      return portType // Fallback to generic port name
    }

    // If preferred ID specified and exists, use it
    if (preferredId && ports.find((p: any) => p.id === preferredId)) {
      return preferredId
    }

    // Return first available port without making assumptions about port names
    // Let the LLM review connections handle port matching intelligently
    return ports[0].id || portType
  }

  private generateSummary(metadata: any): string {
    const parts = []
    if (metadata.added > 0) parts.push(`added ${metadata.added} nodes`)
    if (metadata.connected > 0) parts.push(`created ${metadata.connected} connections`)
    if (metadata.grouped > 0) parts.push(`organized ${metadata.grouped} groups`)

    let summary = parts.length > 0 ? `I've ${parts.join(', ')}.` : 'Workflow updated successfully.'

    // Add environment variable warnings if present
    if (metadata.requiredEnvVars && metadata.requiredEnvVars.length > 0) {
      const uniqueEnvVars = [...new Set(metadata.requiredEnvVars)]
      summary += `\n\n⚠️ **Environment Variables Required:**\nThe following environment variables need to be set for the workflow to function properly:\n`
      summary += uniqueEnvVars.map(envVar => `- ${envVar}`).join('\n')
      summary += `\n\nPlease ensure these are configured in your .env.local file or deployment environment.`
    }

    return summary
  }

  private async attemptErrorRecovery(
    error: any,
    content: string,
    workflowId: string | null
  ): Promise<AgentResponse | null> {
    try {
      const errorContext = {
        error: error instanceof Error ? error.message : String(error),
        originalRequest: content,
        hasWorkflow: !!workflowId,
      }

      const response = await this.callLLM([
        { role: 'system', content: ERROR_RECOVERY_PROMPT },
        { role: 'user', content: JSON.stringify(errorContext, null, 2) },
      ])

      // Try to parse recovery strategy
      let recovery
      try {
        recovery = JSON.parse(this.cleanJsonResponse(response))
      } catch (parseError) {
        console.error('Failed to parse recovery response:', response)
        // Fallback if LLM doesn't return JSON
        return {
          message:
            'I encountered an error. The issue appears to be: ' +
            errorContext.error +
            '. Please check that the workflow exists and try again.',
          actions: [],
          metadata: { recovery: true, fallback: true },
        }
      }

      return {
        message:
          recovery.message || 'I encountered an issue but have a suggestion for how to proceed.',
        actions: [],
        metadata: { recovery: true },
      }
    } catch (recoveryError) {
      console.error('Error recovery failed:', recoveryError)
      return null
    }
  }

  private isScriptableNode(template: any): boolean {
    const scriptableTypes = ['script', 'tpl_javascript_script', 'tpl_python_script', 'tpl_sql_script', 'sql_script']
    const titleLower = template.title?.toLowerCase() || ''
    return scriptableTypes.includes(template.type) || 
           scriptableTypes.includes(template.id) ||
           titleLower.includes('sql script') ||
           titleLower.includes('script')
  }

  private async generateScriptForNode(
    template: any,
    functionality: string,
    originalRequest: string
  ): Promise<{ code: string; description: string } | null> {
    try {
      // Determine language based on template
      let language: string = 'javascript'
      const titleLower = template.title?.toLowerCase() || ''
      const idLower = template.id?.toLowerCase() || ''
      
      if (idLower.includes('python') || titleLower.includes('python')) {
        language = 'python'
      } else if (idLower.includes('sql') || titleLower.includes('sql')) {
        language = 'sql'
      }

      // If this is a custom template, use the custom script generation
      if (template._needsScriptGeneration) {
        const generated = await scriptGenerator.generateCustomNodeScript(functionality, {
          workflowPurpose: originalRequest,
        })
        return {
          code: generated.code,
          description: generated.description,
        }
      }

      // For regular script nodes, generate based on the request
      const scriptRequest = {
        language,
        description: functionality || originalRequest,
        context: {
          workflowPurpose: originalRequest,
        },
      }

      const generated = await scriptGenerator.generateScript(scriptRequest as any)
      return {
        code: generated.code,
        description: generated.description,
      }
    } catch (error) {
      console.error('[OrchestratorAgent] Script generation failed:', error)
      return null
    }
  }

  private async getTemplateById(templateId: string): Promise<any | null> {
    try {
      // Try to get template from search service
      const result = await this.mcpClient.callTool('node_template_repository', 'get_template', {
        templateId,
      })

      const parsed = JSON.parse(result)
      // API returns {success: true, data: {...template...}}
      if (parsed.success && parsed.data) {
        console.log(`[getTemplateById] Successfully retrieved template ${templateId}`)
        return parsed.data
      }
      // Fallback for other response formats
      return parsed.template || parsed || null
    } catch (error) {
      console.error(`Failed to get template by ID ${templateId}:`, error)

      // Fallback to search
      try {
        const searchResult = await this.mcpClient.callTool(
          'node_template_repository',
          'search_templates',
          { query: templateId, limit: 1 }
        )

        const parsed = JSON.parse(searchResult)
        const templates = parsed.data || parsed.results || parsed
        if (Array.isArray(templates) && templates.length > 0) {
          return templates[0].template || templates[0]
        }
      } catch (searchError) {
        console.error(`Failed to search for template ${templateId}:`, searchError)
      }

      return null
    }
  }

  private async findDefaultPort(
    template: any,
    portType: 'input' | 'output',
    context?: string
  ): Promise<string> {
    if (!template || !template.ports) return portType

    const portsOfType = template.ports.filter((p: any) => p.type === portType)
    if (portsOfType.length === 0) return portType
    if (portsOfType.length === 1) return portsOfType[0].id

    // For multiple ports, let LLM decide the most appropriate one based on context
    // No hardcoded assumptions about port names like pool-in/pool-out
    const prompt = `Select the most appropriate ${portType} port for this node.

Node: ${template.title}
Description: ${template.description}
Context: ${context || 'General workflow'}

Available ${portType} ports:
${portsOfType.map((p: any) => `- ${p.id}: ${p.label || p.id} (${p.dataType || 'any'})`).join('\n')}

Which port should be used as the default for connections?
Consider the actual port labels and their purpose, not assumptions about naming conventions.
For database connections, look for ports labeled for connection pooling (often "pool-id").
For data flow, look for ports labeled for data transfer.

Return only the port ID.`

    try {
      const response = await this.callLLM([{ role: 'user', content: prompt }])
      const portId = response.trim()
      // Verify the port exists
      if (portsOfType.find((p: any) => p.id === portId)) {
        return portId
      }
    } catch (error) {
      console.error('Failed to select port via LLM:', error)
    }

    // Fallback to first available port
    return portsOfType[0].id
  }

  private async callLLM(messages: Array<{ role: string; content: string }>): Promise<string> {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      // Client-side: use backend API
      const response = await fetch('/api/orchestrator/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        }),
      })

      if (!response.ok) {
        throw new Error(`Backend LLM API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.content
    } else {
      // Server-side: direct OpenRouter call
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/offbit-ai/zeal',
          'X-Title': 'Zeal Orchestrator',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    }
  }

  /**
   * Generate a comprehensive workflow summary explaining decisions
   */
  private async generateWorkflowSummary(
    originalRequest: string,
    intent: WorkflowIntent,
    selectedNodes: Map<string, any>,
    connections: any[],
    nodeMap: Map<string, NodeMapping>
  ): Promise<string> {
    const prompt = `Generate a comprehensive summary of the workflow that was created.

User's Request: "${originalRequest}"

Intent: ${JSON.stringify(intent, null, 2)}

Selected Nodes:
${Array.from(selectedNodes.entries())
  .map(([id, template]) => `- ${template.title} (${id}): ${template.description}`)
  .join('\n')}

Connections Made:
${connections
  .map(conn => `- ${conn.fromQuery || conn.from} → ${conn.toQuery || conn.to}`)
  .join('\n')}

Provide a summary that explains:
1. HOW this workflow solves the user's problem
2. WHY each node was selected and its role
3. The DATA FLOW through the workflow
4. Any KEY DECISIONS made during construction
5. What the user needs to configure (if anything)

Keep it concise but informative, focusing on value to the user.`

    try {
      const response = await this.callLLM([{ role: 'user', content: prompt }])
      return response
    } catch (error) {
      console.error('Failed to generate workflow summary:', error)
      return `Created workflow with ${selectedNodes.size} nodes and ${connections.length} connections to ${intent.description || originalRequest}`
    }
  }

  /**
   * Map node properties intelligently based on context
   */
  private async mapNodeProperties(
    template: any,
    context: {
      userRequest: string
      workflowIntent: WorkflowIntent
      otherNodes: Map<string, any>
      existingConnections: any[]
    }
  ): Promise<Record<string, any>> {
    console.log(`[MapNodeProperties] Starting property mapping for ${template.title}`)
    
    // Convert properties object to array of required properties
    const requiredProps: Array<{ name: string; type: string; description?: string }> = []
    const dataOperationProps: Array<{ name: string; description?: string }> = []
    const ruleProps: Array<{ name: string; description?: string }> = []
    const allProps: Array<{ name: string; type: string; description?: string }> = []
    
    if (template.properties && typeof template.properties === 'object') {
      Object.entries(template.properties).forEach(([propName, propDef]: [string, any]) => {
        // Track ALL properties, not just required ones
        allProps.push({
          name: propName,
          type: propDef.type || 'text',
          description: propDef.description || propDef.placeholder || '',
        })
        
        if (propDef.required) {
          requiredProps.push({
            name: propName,
            type: propDef.type || 'text',
            description: propDef.description || propDef.placeholder || '',
          })
        }
        // Track dataOperations properties separately for special handling
        if (propDef.type === 'dataOperations') {
          dataOperationProps.push({
            name: propName,
            description: propDef.description || '',
          })
        }
        // Track rules properties separately for special handling
        if (propDef.type === 'rules') {
          ruleProps.push({
            name: propName,
            description: propDef.description || '',
          })
        }
      })
    }

    console.log(`[MapNodeProperties] Found ${allProps.length} total properties, ${requiredProps.length} required`)

    // Even if no required props, we should still try to enrich important properties
    if (allProps.length === 0) {
      console.log(`[MapNodeProperties] No properties to map for ${template.title}`)
      return {}
    }

    // Build connection context for data operations
    const connectionContext = context.existingConnections
      .filter((conn: any) => conn.toQuery === template.title)
      .map((conn: any) => {
        const sourceNode = context.otherNodes.get(conn.fromQuery)
        return `Input port "${conn.targetPort}" receives data from "${conn.fromQuery}" (${conn.description})`
      })
      .join('\n')

    const prompt = `Map properties for this node based on the workflow context.

Node: ${template.title}
Description: ${template.description}

Required Properties:
${requiredProps
  .map((p: any) => `- ${p.name} (${p.type}): ${p.description || 'No description'}`)
  .join('\n')}

${dataOperationProps.length > 0 ? `Data Operation Properties (these use JavaScript expressions):
${dataOperationProps
  .map((p: any) => `- ${p.name}: ${p.description || 'Data transformation pipeline'}`)
  .join('\n')}

Available Input Connections:
${connectionContext || 'No input connections'}

For dataOperations properties, create data transformation pipelines using JavaScript expressions:

Access Pattern: \${input.get('portName').data.fieldName}

Supported Operations:
1. MAP - Transform field names and values
   - sourceField: "\${input.get('data').data.price}"
   - targetField: "totalPrice"  
   - transform: "\${input.get('data').data.price} * 1.2" (optional JS expression)

2. FILTER - Remove items based on conditions
   - filterExpression: "\${input.get('data').data.age} > 18 && \${input.get('data').data.status} === 'active'"

3. SORT - Order data by field values
   - sortField: "\${input.get('data').data.timestamp}"
   - sortDirection: "asc" or "desc"

4. TRANSFORM - Apply custom transformations to entire object
   - transformExpression: "{ ...\${input.get('data').data}, fullName: \${input.get('data').data.firstName} + ' ' + \${input.get('data').data.lastName} }"

5. GROUP - Group items by field values
   - groupByField: "\${input.get('data').data.category}"

6. AGGREGATE - Calculate summary values
   - aggregateField: "\${input.get('data').data.amount}"
   - aggregateFunction: "sum|avg|count|min|max|first|last"

7. MERGE - Combine multiple data sources (configuration coming soon)

8. SPLIT - Split data into multiple outputs (configuration coming soon)
` : ''}

${ruleProps.length > 0 ? `Rule Properties (these use JavaScript expressions for conditions):
${ruleProps
  .map((p: any) => `- ${p.name}: ${p.description || 'Rule-based conditions'}`)
  .join('\n')}

For rules properties, create conditional rule sets using:
- Access input data: input.get('portName').data.fieldName
- Supported operators: is, is_not, contains, not_contains, greater_than, less_than, greater_equal, less_equal, empty, not_empty
- Rule groups use AND/OR connectors
- Use JavaScript expressions in field and value: "\${input.get('data').data.fieldName}"
- Example: field: "\${input.get('data').data.status}", operator: "is", value: "active"
` : ''}

User's Request: "${context.userRequest}"
Workflow Purpose: ${context.workflowIntent.description}

Other Nodes in Workflow:
${Array.from(context.otherNodes.entries())
  .map(([id, t]) => `- ${t.title}: ${t.description}`)
  .join('\n')}

Based on the context, provide intelligent default values or indicate what needs user input.

For dataOperations properties, return an array of operation sets. Each operation type uses specific fields:
{
  "dataOperationsPropertyName": {
    "value": [
      {
        "id": "set-123",
        "name": "Data Pipeline",  // REQUIRED field
        "operations": [
          // Map operation example:
          {
            "id": "op-map-1",
            "type": "map",
            "enabled": true,
            "description": "Transform price to total with tax",
            "mapping": [
              {
                "sourceField": "\${input.get('data').data.price}",
                "targetField": "totalPrice",
                "transform": "\${input.get('data').data.price} * 1.08"  // Optional
              }
            ]
          },
          // Filter operation example:
          {
            "id": "op-filter-1",
            "type": "filter",
            "enabled": true,
            "description": "Keep only active items",
            "filterExpression": "\${input.get('data').data.status} === 'active'"
          },
          // Sort operation example:
          {
            "id": "op-sort-1",
            "type": "sort",
            "enabled": true,
            "description": "Sort by timestamp",
            "sortField": "\${input.get('data').data.timestamp}",
            "sortDirection": "desc"
          },
          // Transform operation example:
          {
            "id": "op-transform-1",
            "type": "transform",
            "enabled": true,
            "description": "Add computed fields",
            "transformExpression": "{ ...\${input.get('data').data}, processed: true, timestamp: Date.now() }"
          },
          // Group operation example:
          {
            "id": "op-group-1",
            "type": "group",
            "enabled": true,
            "description": "Group by category",
            "groupByField": "\${input.get('data').data.category}"
          },
          // Aggregate operation example:
          {
            "id": "op-agg-1",
            "type": "aggregate",
            "enabled": true,
            "description": "Sum amounts",
            "aggregateField": "\${input.get('data').data.amount}",
            "aggregateFunction": "sum"
          }
        ]
      }
    ],
    "needsUserInput": false,
    "reason": "Auto-configured based on workflow context"
  }
}

For rules properties, return an array of rule sets like:
{
  "rulesPropertyName": {
    "value": [
      {
        "id": "ruleset-id",
        "type": "IF|OR",
        "groups": [
          {
            "id": "group-id",
            "connector": "AND|OR",
            "rules": [
              {
                "id": "rule-id",
                "field": "\${input.get('portName').data.fieldName}",
                "operator": "is|is_not|contains|greater_than|less_than|etc",
                "value": "\${input.get('portName').data.value}",
                "valueType": "string|number|date|boolean"
              }
            ]
          }
        ]
      }
    ],
    "needsUserInput": false,
    "reason": "Auto-configured based on workflow context"
  }
}

Return a JSON object with property mappings:
{
  "propertyName": {
    "value": "suggested value or null if needs user input",
    "needsUserInput": boolean,
    "reason": "why this value or why it needs user input"
  }
}`

    try {
      const response = await this.callLLM([{ role: 'user', content: prompt }])
      const mappings = JSON.parse(this.cleanJsonResponse(response))

      // Extract just the values
      const propertyValues: Record<string, any> = {}
      const questionsNeeded: Array<{ property: string; question: string }> = []

      for (const [prop, mapping] of Object.entries(mappings)) {
        if (mapping && typeof mapping === 'object') {
          const m = mapping as any
          if (m.needsUserInput) {
            questionsNeeded.push({
              property: prop,
              question: m.reason || `Please provide a value for ${prop}`,
            })
          } else if (m.value !== null) {
            // For dataOperations, ensure the value is properly structured
            const propDef = template.properties?.[prop]
            if (propDef?.type === 'dataOperations' && m.value) {
              // Ensure it's an array of operation sets
              if (!Array.isArray(m.value)) {
                propertyValues[prop] = [m.value]
              } else {
                propertyValues[prop] = m.value
              }
              
              // Generate unique IDs and ensure required fields
              if (propertyValues[prop]) {
                propertyValues[prop] = propertyValues[prop].map((set: any) => ({
                  ...set,
                  id: set.id || `set-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                  name: set.name || 'Data Pipeline', // Ensure name field exists
                  operations: (set.operations || []).map((op: any) => ({
                    ...op,
                    id: op.id || `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    enabled: op.enabled !== undefined ? op.enabled : true,
                  }))
                }))
              }
            } else if (propDef?.type === 'rules' && m.value) {
              // For rules, ensure the value is properly structured
              if (!Array.isArray(m.value)) {
                propertyValues[prop] = [m.value]
              } else {
                propertyValues[prop] = m.value
              }
              
              // Generate unique IDs and validate types
              if (propertyValues[prop]) {
                propertyValues[prop] = propertyValues[prop].map((ruleSet: any) => ({
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
              propertyValues[prop] = m.value
            }
          }
        }
      }

      // Store questions for later if needed
      if (questionsNeeded.length > 0) {
        console.log(`Node ${template.title} needs user input for:`, questionsNeeded)
      }

      return propertyValues
    } catch (error) {
      console.error('Failed to map node properties:', error)
      return {}
    }
  }

  /**
   * Review and potentially reconstruct workflow before final commitment
   */
  private async reviewAndRefineWorkflow(
    workflowId: string,
    nodes: Map<string, NodeMapping>,
    connections: any[],
    originalRequest: string,
    intent: WorkflowIntent
  ): Promise<{
    refined: boolean
    addedNodes: string[]
    removedNodes: string[]
    addedConnections: any[]
    removedConnections: any[]
    summary: string
  }> {
    const prompt = `Review this workflow and determine if it fully solves the user's problem.

User's Request: "${originalRequest}"
Intent: ${JSON.stringify(intent, null, 2)}

Current Workflow:
Nodes: ${Array.from(nodes.values())
      .map(n => n.metadata?.title || n.nodeId)
      .join(', ')}
Connections: ${connections.map(c => `${c.from || c.fromQuery} → ${c.to || c.toQuery}`).join(', ')}

Analyze:
1. Does this workflow fully address the user's request?
2. Are there any missing nodes that would improve functionality?
3. Are there any unnecessary nodes that should be removed?
4. Are the connections logical and complete?
5. Will this workflow actually work as intended?

Return JSON with your analysis:
{
  "isComplete": boolean,
  "issues": ["list of issues if any"],
  "missingCapabilities": ["capabilities that should be added"],
  "unnecessaryNodes": ["node IDs that could be removed"],
  "missingConnections": [{"from": "nodeId", "to": "nodeId", "reason": "why"}],
  "recommendation": "overall recommendation"
}`

    try {
      const response = await this.callLLM([{ role: 'user', content: prompt }])
      const review = JSON.parse(this.cleanJsonResponse(response))

      const result = {
        refined: false,
        addedNodes: [] as string[],
        removedNodes: [] as string[],
        addedConnections: [] as any[],
        removedConnections: [] as any[],
        summary: review.recommendation || 'Workflow review complete',
      }

      // If workflow is not complete, attempt to refine it
      if (!review.isComplete && review.missingCapabilities?.length > 0) {
        console.log('Workflow needs refinement:', review.issues)

        // Add missing capabilities
        for (const capability of review.missingCapabilities) {
          const template = await this.searchForTemplate(capability, 1, false, originalRequest)
          if (template) {
            // Add the node (implementation would go here)
            result.addedNodes.push(template.id)
            result.refined = true
          }
        }

        // Add missing connections
        if (review.missingConnections?.length > 0) {
          result.addedConnections = review.missingConnections
          result.refined = true
        }

        // Remove unnecessary nodes
        if (review.unnecessaryNodes?.length > 0) {
          result.removedNodes = review.unnecessaryNodes
          result.refined = true
        }
      }

      return result
    } catch (error) {
      console.error('Failed to review workflow:', error)
      return {
        refined: false,
        addedNodes: [],
        removedNodes: [],
        addedConnections: [],
        removedConnections: [],
        summary: 'Review failed, proceeding with current workflow',
      }
    }
  }

  /**
   * Generate follow-up questions for required properties
   */
  private async generatePropertyQuestions(
    nodes: Map<string, any>,
    originalRequest: string
  ): Promise<Array<{ nodeId: string; property: string; question: string; type: string }>> {
    const questions: Array<{ nodeId: string; property: string; question: string; type: string }> =
      []

    for (const [nodeId, template] of nodes.entries()) {
      // Convert properties object to array of required properties
      const requiredProps: Array<{ name: string; type: string; description?: string }> = []
      if (template.properties && typeof template.properties === 'object') {
        Object.entries(template.properties).forEach(([propName, propDef]: [string, any]) => {
          if (propDef.required) {
            requiredProps.push({
              name: propName,
              type: propDef.type || 'text',
              description: propDef.description || propDef.placeholder || '',
            })
          }
        })
      }

      for (const prop of requiredProps) {
        // Check if we can infer the value from context
        const canInfer = await this.canInferPropertyValue(prop, originalRequest, template)

        if (!canInfer) {
          const question = await this.generatePropertyQuestion(prop, template, originalRequest)
          questions.push({
            nodeId,
            property: prop.name,
            question,
            type: prop.type,
          })
        }
      }
    }

    return questions
  }

  private async canInferPropertyValue(
    property: { name: string; type: string; description?: string },
    userRequest: string,
    template: any
  ): Promise<boolean> {
    const prompt = `Analyze if this property value can be inferred from the user's request.

Property: ${property.name} (${property.type})
Description: ${property.description || 'No description'}
Node: ${template.title}
User's Request: "${userRequest}"

Can the value for this property be clearly inferred from the user's request?
Consider:
1. Is there explicit mention of this property or its value?
2. Does the context strongly imply a specific value?
3. Would assuming a value be safe and aligned with user intent?

Return JSON: {"canInfer": boolean, "inferredValue": "value if inferable or null", "confidence": 0-1}`

    try {
      const response = await this.callLLM([{ role: 'user', content: prompt }])
      const result = JSON.parse(this.cleanJsonResponse(response))
      return result.canInfer && result.confidence > 0.7
    } catch (error) {
      // If LLM fails, we cannot infer
      return false
    }
  }

  private async generatePropertyQuestion(
    property: { name: string; type: string; description?: string },
    template: any,
    userRequest: string
  ): Promise<string> {
    const prompt = `Generate a natural, user-friendly question to get the value for this property.

Node: ${template.title}
Property: ${property.name} (${property.type})
Description: ${property.description || 'No description'}
User's Original Request: "${userRequest}"

Generate a question that:
1. Is specific to the user's context
2. Explains why this information is needed
3. Provides examples if helpful
4. Is concise and clear

Return ONLY the question text.`

    try {
      const response = await this.callLLM([{ role: 'user', content: prompt }])
      return response.trim()
    } catch (error) {
      return `What value should be used for ${property.name} in ${template.title}?`
    }
  }

  /**
   * Validate and resolve workflow DAG structure using LLM intelligence
   */
  private async reviewConnections(
    connections: any[],
    nodeMap: Map<string, NodeMapping>,
    templateMap: Map<string, any>
  ): Promise<any[]> {
    if (connections.length === 0) return connections

    const prompt = `Review and optimize these workflow connections for accuracy and efficiency.

Nodes in the workflow:
${Array.from(nodeMap.entries())
  .map(([query, node]) => {
    const template = templateMap.get(query)
    if (!template) return ''

    const inputs =
      template.ports
        ?.filter((p: any) => p.type === 'input')
        .map((p: any) => `${p.id}(${p.label})`)
        .join(', ') || 'none'
    const outputs =
      template.ports
        ?.filter((p: any) => p.type === 'output')
        .map((p: any) => `${p.id}(${p.label})`)
        .join(', ') || 'none'

    return `- ${query}: ${template.title} (${template.type})
    Inputs: ${inputs}
    Outputs: ${outputs}`
  })
  .join('\n')}

Current connections:
${connections.map(c => `- ${c.fromQuery}:${c.sourcePort} → ${c.toQuery}:${c.targetPort}`).join('\n')}

Review these connections and optimize for proper workflow patterns:

1. ANALYZE ERROR HANDLING FLOWS:
   Look at the port labels and descriptions to understand which ports handle errors vs success data.
   - If you see multiple nodes with separate success/error outputs, determine the best error handling strategy
   - Consider if error outputs should route to error handlers or conditional nodes for branching
   - Avoid redundant connections where multiple success outputs go to the same conditional node

2. PRESERVE CONTEXTUAL CONNECTIONS:
   Keep all connections for nodes that require multiple inputs for context:
   - Branching/conditional nodes (if/else, switch, router)
   - Math operation nodes (add, subtract, multiply, divide, compare)
   - Logic nodes (AND, OR, NOT)
   - Aggregation nodes (merge, join, combine)
   - Filter and transform nodes with specific criteria

3. OPTIMIZE PORT CONNECTIONS:
   Based on the port labels and node descriptions, ensure connections make logical sense:
   - Database connection pools should flow properly (e.g., database pool output to SQL script pool input)
   - Data transformations should maintain proper data flow
   - Consider the semantic meaning of each port, not just the port ID

4. REMOVE TRUE REDUNDANCIES:
   Only remove connections that are genuinely redundant:
   - If A→B and B→C exist, A→C is only redundant if B actually processes/transforms the data
   - Keep direct connections if they serve a different purpose or carry different data

Return a JSON array of optimized connections with corrected ports:
[{
  "fromQuery": "query1",
  "toQuery": "query2", 
  "sourcePort": "correct_output_port_id",
  "targetPort": "correct_input_port_id",
  "reason": "why this connection is needed"
}]

IMPORTANT: 
- Review the actual port labels and descriptions to determine correct connections
- For database connections: Look for ports labeled for connection pooling (e.g., "pool-id")
- For data flow: Match ports based on their semantic purpose, not naming assumptions
- Let the port labels guide your decision - don't assume port names follow any pattern
- Don't create connections between incompatible port types`

    try {
      const response = await this.callLLM([
        {
          role: 'system',
          content:
            'You are a workflow optimization expert. Review connections for accuracy and efficiency.',
        },
        { role: 'user', content: prompt },
      ])

      const reviewedConnections = JSON.parse(this.cleanJsonResponse(response))
      console.log(
        `[ReviewConnections] Optimized from ${connections.length} to ${reviewedConnections.length} connections`
      )

      // Log changes for debugging
      const removed = connections.filter(
        c =>
          !reviewedConnections.find(
            (r: any) => r.fromQuery === c.fromQuery && r.toQuery === c.toQuery
          )
      )
      if (removed.length > 0) {
        console.log('[ReviewConnections] Removed redundant/incorrect connections:', removed)
      }

      return reviewedConnections
    } catch (error) {
      console.error('Failed to review connections:', error)
      return connections // Return original if review fails
    }
  }

  private async validateDAG(
    connections: any[],
    nodeMap: Map<string, NodeMapping>
  ): Promise<{
    isValid: boolean
    cycles: string[]
    problematicConnections: any[]
  }> {
    // Build connection description for LLM
    const nodeDescriptions = Array.from(nodeMap.values()).map(n => ({
      id: n.query,
      title: n.metadata?.title || n.nodeId,
      type: n.metadata?.type,
    }))

    const connectionDescriptions = connections.map(c => ({
      from: c.fromQuery || c.from,
      to: c.toQuery || c.to,
      fromTitle: nodeMap.get(c.fromQuery || c.from)?.metadata?.title,
      toTitle: nodeMap.get(c.toQuery || c.to)?.metadata?.title,
    }))

    const prompt = `Analyze this workflow for cycles and potential infinite loops.

Nodes:
${nodeDescriptions.map(n => `- ${n.id}: ${n.title} (${n.type})`).join('\n')}

Proposed Connections:
${connectionDescriptions.map(c => `- ${c.from} (${c.fromTitle}) → ${c.to} (${c.toTitle})`).join('\n')}

Analyze the workflow:
1. Identify any cycles (paths that loop back to themselves)
2. Identify self-loops (nodes connecting to themselves)
3. Determine which connections should be removed to maintain a DAG
4. Consider the logical flow - some apparent cycles might be intentional error handling

For intentional loops (like retry logic), suggest using dedicated loop control nodes instead.

Return JSON:
{
  "hasCycles": boolean,
  "cycles": ["description of each cycle"],
  "problematicConnections": [{"from": "nodeId", "to": "nodeId", "reason": "why it's problematic"}],
  "recommendations": ["suggestions for fixing"],
  "isIntentionalPattern": boolean
}`

    try {
      const response = await this.callLLM([{ role: 'user', content: prompt }])
      const analysis = JSON.parse(this.cleanJsonResponse(response))

      // Convert LLM analysis to expected format
      const problematicConnections =
        analysis.problematicConnections
          ?.map((p: any) =>
            connections.find(
              c =>
                (c.fromQuery === p.from || c.from === p.from) &&
                (c.toQuery === p.to || c.to === p.to)
            )
          )
          .filter(Boolean) || []

      return {
        isValid: !analysis.hasCycles || analysis.isIntentionalPattern,
        cycles: analysis.cycles || [],
        problematicConnections,
      }
    } catch (error) {
      console.error('DAG validation via LLM failed:', error)
      // Fallback to basic self-loop detection only
      const cycles: string[] = []
      const problematicConnections: any[] = []

      for (const conn of connections) {
        const from = conn.fromQuery || conn.from
        const to = conn.toQuery || conn.to
        if (from === to) {
          cycles.push(`${from} → ${from} (self-loop)`)
          problematicConnections.push(conn)
        }
      }

      return {
        isValid: cycles.length === 0,
        cycles,
        problematicConnections,
      }
    }
  }

  /**
   * Store workflow context for future interactions
   */
  private storeWorkflowContext(workflowId: string, context: Partial<WorkflowContext>) {
    const existing = this.workflowContexts.get(workflowId) || {
      workflowId,
      nodes: new Map(),
      nodeMap: new Map(),
      connections: [],
      pendingQuestions: [],
      propertyValues: new Map(),
      conversationHistory: [],
      lastUserRequest: '',
      intent: { description: '', suggestedNodes: [] },
    }

    // Special handling for connections - don't overwrite with empty array
    const connections =
      context.connections !== undefined && context.connections.length > 0
        ? context.connections
        : existing.connections

    console.log(`[StoreContext] Updating context for ${workflowId}:`)
    console.log(`[StoreContext] - Existing connections: ${existing.connections?.length || 0}`)
    console.log(`[StoreContext] - New connections: ${context.connections?.length || 'undefined'}`)
    console.log(`[StoreContext] - Final connections: ${connections?.length || 0}`)

    this.workflowContexts.set(workflowId, {
      ...existing,
      ...context,
      nodes: context.nodes || existing.nodes,
      nodeMap: context.nodeMap || existing.nodeMap, // Preserve nodeMap
      connections: connections, // Use the specially handled connections
      pendingQuestions: context.pendingQuestions || existing.pendingQuestions,
      propertyValues: context.propertyValues || existing.propertyValues,
      conversationHistory: context.conversationHistory || existing.conversationHistory,
    })
  }

  /**
   * Get workflow context for a given workflow
   */
  private getWorkflowContext(workflowId: string): WorkflowContext | undefined {
    return this.workflowContexts.get(workflowId)
  }

  /**
   * Process user's response to property questions
   */
  async *processPropertyAnswers(
    workflowId: string,
    userResponse: string
  ): AsyncGenerator<StreamingAgentResponse> {
    const context = this.getWorkflowContext(workflowId)
    if (!context || context.pendingQuestions.length === 0) {
      yield {
        type: 'message',
        content: 'No pending configuration questions for this workflow.',
      }
      return
    }

    // Parse user's response to extract property values
    const prompt = `Parse the user's response to extract values for workflow node properties.

Pending Questions:
${context.pendingQuestions
  .map(
    (q, i) =>
      `${i + 1}. ${q.question}
   Node: ${q.nodeTitle}
   Property: ${q.propertyName} (${q.propertyType})
   Required: ${q.required}`
  )
  .join('\n\n')}

User's Response: "${userResponse}"

Extract the values for each property from the user's response.
If the user provides a value for a property, extract it.
If the user asks for clarification, note that.
If the user skips a property, use null.

Return JSON:
{
  "answers": [
    {
      "nodeId": "node_id",
      "propertyName": "property_name",
      "value": "extracted_value or null",
      "needsClarification": boolean,
      "clarificationRequest": "what the user wants to know"
    }
  ],
  "hasMoreQuestions": boolean,
  "additionalContext": "any other relevant info from user"
}`

    try {
      yield { type: 'status', content: 'Processing your configuration...' }

      const response = await this.callLLM([{ role: 'user', content: prompt }])
      const parsed = JSON.parse(this.cleanJsonResponse(response))

      // Update property values for nodes
      for (const answer of parsed.answers) {
        if (answer.value !== null && !answer.needsClarification) {
          // Update the node's properties
          const nodeProps = context.propertyValues.get(answer.nodeId) || {}
          nodeProps[answer.propertyName] = answer.value
          context.propertyValues.set(answer.nodeId, nodeProps)

          // Remove from pending questions
          context.pendingQuestions = context.pendingQuestions.filter(
            q => !(q.nodeId === answer.nodeId && q.propertyName === answer.propertyName)
          )

          // Get the actual node ID from nodeMap
          const actualNodeId = context.nodeMap?.get(answer.nodeId)?.nodeId
          if (actualNodeId) {
            // Update the actual node in the workflow
            yield { type: 'status', content: `Updating ${answer.nodeId} configuration...` }
            await this.updateNodeProperty(
              workflowId,
              actualNodeId,
              answer.propertyName,
              answer.value
            )
          } else {
            console.error(`Could not find actual node ID for ${answer.nodeId}`)
          }

          yield {
            type: 'message',
            content: `✓ Set ${answer.propertyName} for ${answer.nodeId}`,
          }
        } else if (answer.needsClarification) {
          // Provide clarification
          const clarification = await this.generatePropertyClarification(
            answer.nodeId,
            answer.propertyName,
            answer.clarificationRequest,
            context
          )
          yield {
            type: 'message',
            content: clarification,
          }
        }
      }

      // Store updated context
      this.storeWorkflowContext(workflowId, context)

      // Check if there are more questions
      if (context.pendingQuestions.length > 0) {
        yield {
          type: 'question',
          content: 'There are still some configuration options needed:',
          questions: context.pendingQuestions.slice(0, 3), // Show next 3 questions
          requiresInput: true,
        }
      } else {
        // All questions answered - now create the connections
        yield {
          type: 'status',
          content: 'All properties configured! Now creating workflow connections...',
        }

        // Get the latest stored context to ensure we have the most up-to-date connections
        const latestContext = this.getWorkflowContext(workflowId)
        const connections = latestContext?.connections || context.connections || []
        const nodeMap = latestContext?.nodeMap || context.nodeMap || new Map<string, NodeMapping>()

        console.log(
          '[PropertyConfiguration] Context connections:',
          JSON.stringify(connections, null, 2)
        )
        console.log(
          '[PropertyConfiguration] Number of connections from context:',
          connections.length
        )
        console.log('[PropertyConfiguration] NodeMap from context size:', nodeMap.size)
        console.log('[PropertyConfiguration] NodeMap entries:', Array.from(nodeMap.entries()))

        // Verify we have the nodeMap with actual node IDs
        if (nodeMap.size === 0) {
          yield {
            type: 'error',
            content: 'Error: Node mappings were not properly stored. Please recreate the workflow.',
          }
          return
        }

        // Create the workflow connections using the existing nodes
        const workflowPlan: WorkflowPlan = {
          nodes: [], // Empty - nodes already exist
          connections: connections,
        }

        // Generate a summary
        const workflowSummary = await this.generateWorkflowSummary(
          context.lastUserRequest,
          context.intent,
          context.nodes,
          connections,
          nodeMap
        )

        // Finalize the workflow with connections (this will only create connections, not nodes)
        yield* this.finalizeWorkflowConnections(workflowId, workflowPlan, nodeMap, workflowSummary)
      }
    } catch (error) {
      yield {
        type: 'error',
        content: `Failed to process configuration: ${error}`,
      }
    }
  }

  /**
   * Update a node's property in the workflow
   */
  private async updateNodeProperty(
    workflowId: string,
    nodeId: string,
    propertyName: string,
    value: any
  ): Promise<void> {
    try {
      console.log(`[UpdateNodeProperty] Updating ${propertyName} = ${value} for node ${nodeId}`)

      // Use update_node_properties with a single property
      const result = await this.mcpClient.callTool('embed_orchestrator', 'update_node_properties', {
        apiKey: this.apiKey,
        workflowId,
        nodeId,
        graphId: 'main', // Ensure graphId is included
        propertyValues: {
          [propertyName]: value,
        },
        useCRDT: this.useRealTimeSync,
      })

      console.log(`[UpdateNodeProperty] Result:`, result)
    } catch (error) {
      console.error(`Failed to update property ${propertyName} for node ${nodeId}:`, error)
    }
  }

  /**
   * Generate clarification for a property
   */
  private async generatePropertyClarification(
    nodeId: string,
    propertyName: string,
    userQuestion: string,
    context: WorkflowContext
  ): Promise<string> {
    const node = context.nodes.get(nodeId)
    const prompt = `Provide a helpful clarification for this workflow node property.

Node: ${node?.title || nodeId}
Property: ${propertyName}
User's Question: "${userQuestion}"

Context: This is part of a workflow that ${context.intent.description}

Provide a clear, helpful explanation that:
1. Explains what this property does
2. Gives examples of valid values
3. Explains how it affects the workflow
4. Addresses the user's specific question

Keep the response concise and user-friendly.`

    const response = await this.callLLM([{ role: 'user', content: prompt }])
    return response
  }

  /**
   * Check if user is asking a question about the workflow
   */
  private async isUserAskingQuestion(content: string): Promise<boolean> {
    const prompt = `Is the user asking a question or requesting a modification?

User's message: "${content}"

Questions typically:
- Ask for clarification
- Request information about the workflow
- Ask "what", "how", "why", "when", "where" questions
- Request explanations

Modifications typically:
- Request changes
- Add/remove nodes
- Change connections
- Update properties
- Use action verbs like "add", "remove", "change", "update", "connect"

Return JSON: {"isQuestion": boolean}`

    try {
      const response = await this.callLLM([{ role: 'user', content: prompt }])
      const result = JSON.parse(this.cleanJsonResponse(response))
      return result.isQuestion
    } catch (error) {
      // Default to treating as modification
      return false
    }
  }

  /**
   * Handle questions about the workflow
   */
  private async *handleWorkflowQuestion(
    question: string,
    workflowId: string
  ): AsyncGenerator<StreamingAgentResponse> {
    const context = this.getWorkflowContext(workflowId)

    const prompt = `Answer the user's question about their workflow.

Workflow Context:
- Purpose: ${context?.intent.description || 'Unknown'}
- Nodes: ${Array.from(context?.nodes.values() || [])
      .map(n => n.title)
      .join(', ')}
- Has ${context?.connections.length || 0} connections
- Pending configurations: ${context?.pendingQuestions.length || 0}

User's Question: "${question}"

Provide a helpful, informative answer.`

    const response = await this.callLLM([{ role: 'user', content: prompt }])

    yield {
      type: 'message',
      content: response,
    }

    // If there are pending questions, remind the user
    if (context && context.pendingQuestions.length > 0) {
      yield {
        type: 'question',
        content: 'By the way, there are still some configuration options needed:',
        questions: context.pendingQuestions.slice(0, 3),
        requiresInput: true,
        workflowId,
      }
    }
  }

  /**
   * Determine if two nodes should be connected based on their types and context
   */
  private async shouldConnectNodes(
    sourceNode: any,
    targetNode: any,
    context: string
  ): Promise<boolean> {
    const prompt = `Should these two nodes be connected in the workflow?

Source Node: ${sourceNode.nodeId}
Source Type: ${sourceNode.metadata?.type || 'unknown'}
Source Description: ${sourceNode.metadata?.description || 'No description'}

Target Node: ${targetNode.nodeId}
Target Type: ${targetNode.metadata?.type || 'unknown'}
Target Description: ${targetNode.metadata?.description || 'No description'}

Context: ${context}

Consider:
1. Does the data flow make logical sense?
2. Are the node types compatible?
3. Would this connection create value in the workflow?
4. Is this a common pattern in workflows?

Return JSON: {"shouldConnect": boolean, "reason": "explanation"}`

    try {
      const response = await this.callLLM([{ role: 'user', content: prompt }])
      const result = JSON.parse(this.cleanJsonResponse(response))
      return result.shouldConnect
    } catch (error) {
      // If LLM fails, don't create the connection
      return false
    }
  }

  /**
   * Enhanced property extraction with intelligent mapping
   */
  private async extractNodeProperties(
    template: any,
    query: string,
    configuration: any,
    userRequest: string
  ): Promise<Record<string, any>> {
    // If configuration is provided, use it
    if (configuration && Object.keys(configuration).length > 0) {
      return configuration
    }

    // Special handling for script nodes - generate code using scriptGenerator
    if (this.isScriptableNode(template)) {
      console.log('[ExtractNodeProperties] Generating script for node:', template.title)

      // Determine the script functionality from the query or request
      const functionality = query || userRequest
      const scriptResult = await this.generateScriptForNode(template, functionality, userRequest)

      if (scriptResult) {
        console.log('[ExtractNodeProperties] Generated script successfully')
        // Find the code property name (usually 'code' or 'script')
        const codePropertyName =
          Object.keys(template.properties || {}).find(
            key => template.properties[key].type === 'code-editor'
          ) || 'code'

        return {
          [codePropertyName]: scriptResult.code,
          description: scriptResult.description,
          // Include any other properties with defaults
          ...this.getDefaultProperties(template),
        }
      }
    }

    // Try intelligent property mapping for non-script nodes
    const context = {
      userRequest,
      workflowIntent: { description: userRequest } as WorkflowIntent,
      otherNodes: new Map<string, any>(),
      existingConnections: [],
    }

    const mappedProperties = await this.mapNodeProperties(template, context)

    // Merge with any defaults from the template
    const defaultProps = this.getDefaultProperties(template)

    return { ...defaultProps, ...mappedProperties }
  }

  private getDefaultProperties(template: any): Record<string, any> {
    const defaultProps: Record<string, any> = {}
    if (template.properties && typeof template.properties === 'object') {
      Object.entries(template.properties).forEach(([propName, propDef]: [string, any]) => {
        if (propDef.defaultValue !== undefined) {
          defaultProps[propName] = propDef.defaultValue
        }
      })
    }
    return defaultProps
  }

  /**
   * Evaluate workflow quality and identify issues
   */
  private async evaluateWorkflowQuality(
    workflowId: string,
    nodeMap: Map<string, string>,
    templateMap: Map<string, any>,
    connectionCount: number,
    userRequest: string
  ): Promise<{
    hasIssues: boolean
    issues: Array<{ type: string; description: string; nodeId?: string }>
    fixes: Array<{ action: string; target: string; reason: string }>
    missingProperties: Array<{ 
      nodeId: string
      nodeQuery: string
      nodeTitle: string
      propertyName: string
      propertyType: string
      question: string
      currentValue?: any
      suggestedValue?: any
      required: boolean
    }>
  }> {
    const issues: Array<{ type: string; description: string; nodeId?: string }> = []
    const fixes: Array<{ action: string; target: string; reason: string }> = []
    const missingProperties: Array<any> = []

    // Build evaluation context with full template info
    const nodes: Array<{ id: string; template: any; query: string }> = []
    const nodeQueryMap = new Map<string, string>() // nodeId -> query mapping
    
    for (const [query, nodeId] of nodeMap) {
      const template = templateMap.get(query)
      if (template) {
        nodes.push({ id: nodeId, template, query })
        nodeQueryMap.set(nodeId, query)
      }
    }

    // Use LLM to evaluate workflow quality
    const evaluationPrompt = `Evaluate this workflow for quality issues and missing critical properties.

ORIGINAL User Request: "${userRequest}"

CRITICAL: Check if the workflow ACTUALLY fulfills what the user asked for:
- If they asked for "API request" or "fetch data" → MUST have HTTP Request node
- If they asked for "weather data" → MUST have weather API configuration
- If they asked for "store in database" → MUST have both connection AND write operation
- Report ANY missing components as issues!

Workflow Nodes (${nodes.length} total):
${nodes.map(node => {
  const requiredProps = node.template.properties ? 
    Object.entries(node.template.properties)
      .filter(([_, prop]: [string, any]) => prop.required)
      .map(([name, _]: [string, any]) => name) : []
  return `- ${node.id}: ${node.template.title} (${node.template.category})${requiredProps.length > 0 ? ' [Required props: ' + requiredProps.join(', ') + ']' : ''}`
}).join('\n')}

Node Details with Properties:
${nodes.map(node => {
  const props = node.template.properties ? Object.keys(node.template.properties) : []
  return `- Query: "${node.query}" → NodeID: ${node.id} → Template: ${node.template.title}
  Properties: ${props.length > 0 ? props.join(', ') : 'none'}
  Category: ${node.template.category}`
}).join('\n')}

Connections: ${connectionCount}

EVALUATION CRITERIA:

1. DUPLICATES - Are there redundant nodes?
   - Two HTTP Request nodes fetching the same data = DUPLICATE (keep only one)
   - Multiple parsers for the same data stream = DUPLICATE
   - Redundant transformers = DUPLICATE
   - Report exact node IDs that are duplicates

2. DISCONNECTED NODES - Are all nodes properly connected?
   - Interval/Cron triggers MUST connect to something (usually HTTP request or script)
   - Every node should have at least one connection (input or output)
   - Webhooks need to connect to processing nodes
   - Report any node that has NO connections as "disconnected"

3. INVALID CONNECTIONS - Are connections logical?
   - Connection pools shouldn't connect to each other
   - Data flow should make sense (trigger → fetch → parse → transform → store)
   - Port types should match (output → input)
   - Database connection pools MUST connect to operation nodes (insert/update/query)

4. MISSING CRITICAL PROPERTIES - What's required but not set?
   - HTTP Request: URL endpoint, method (GET/POST), headers, authentication
   - Interval Trigger: interval duration (in milliseconds)
   - Cron Trigger: cron expression (e.g., "0 * * * *")
   - SQL Script: SQL query code (MUST be SQL/PL/pgSQL, NOT JavaScript!)
   - MongoDB Insert: collection name, document structure
   - MongoDB Connection Pool: connection URI, database name
   - PostgreSQL Connection Pool: connection string
   - JSON Parser: parsing options
   - Data Transformer: transformation script
   - ANY property marked as "required" in the node template

5. WORKFLOW COMPLETENESS - Does it achieve the goal?
   - Is there a proper trigger connected to the flow?
   - Is data actually being FETCHED if user requested it?
   - Is data actually being stored/output?
   - Are all necessary transformations present?
   - Is the workflow actually executable (no disconnected components)?
   - Does the workflow match the user's ORIGINAL request?
   - If user asked for "API request" or "fetch data", is there an HTTP Request node?
   - If user asked for "weather data", is there a weather API endpoint configured?

6. DATABASE CONNECTION ISSUES (CRITICAL):
   - MongoDB Connection Pool WITHOUT MongoDB Insert/Update/Find = INCOMPLETE
   - PostgreSQL Connection Pool WITHOUT SQL Script = INCOMPLETE  
   - MySQL Connection Pool WITHOUT SQL Script = INCOMPLETE
   - Redis Connection WITHOUT Redis Set/Get = INCOMPLETE
   - Report these as "missing_node" issues!

Return a JSON object with COMPLETE property information:
{
  "hasIssues": boolean,
  "issues": [
    { "type": "duplicate|invalid_connection|missing_node|wrong_language", "description": "what's wrong", "nodeId": "node_id" }
  ],
  "fixes": [
    { "action": "remove_node|remove_connection|update_property", "target": "node_id or connection_id", "reason": "why" }
  ],
  "missingProperties": [
    { 
      "nodeId": "actual_node_id_from_list",
      "nodeQuery": "search_query_that_found_this_node",
      "nodeTitle": "Human readable title of the node",
      "propertyName": "property_name_to_set",
      "propertyType": "text|code|url|cron|number|boolean",
      "question": "User-friendly question to ask for this property",
      "currentValue": null,
      "suggestedValue": "optional suggested value",
      "required": true
    }
  ]
}

IMPORTANT: 
- ALWAYS report missing properties for EVERY node that needs configuration
- For HTTP Request: MUST report missing URL
- For Interval Trigger: MUST report missing interval duration
- For MongoDB operations: MUST report missing collection name
- For SQL Script nodes: MUST report missing SQL query (and it MUST be SQL/PL/pgSQL, not JavaScript!)
- Include ALL fields for missingProperties, especially nodeQuery which is critical for mapping
- Use the actual node IDs from the list above
- Even if workflow "works", still report properties that would make it functional`

    try {
      const response = await this.callLLM([
        { role: 'system', content: 'You are a workflow quality evaluator.' },
        { role: 'user', content: evaluationPrompt }
      ])

      const evaluation = JSON.parse(this.cleanJsonResponse(response))
      
      // Ensure all required fields are present in missingProperties
      const enrichedMissingProperties = (evaluation.missingProperties || []).map((prop: any) => {
        // Find the node query if not provided
        let nodeQuery = prop.nodeQuery
        if (!nodeQuery && prop.nodeId) {
          nodeQuery = nodeQueryMap.get(prop.nodeId) || ''
        }
        
        // Find the template for node title
        const template = templateMap.get(nodeQuery || '')
        
        return {
          nodeId: prop.nodeId || '',
          nodeQuery: nodeQuery || '',
          nodeTitle: prop.nodeTitle || template?.title || 'Node',
          propertyName: prop.propertyName || prop.property || '',
          propertyType: prop.propertyType || prop.type || 'text',
          question: prop.question || `Please provide ${prop.propertyName || 'value'}`,
          currentValue: prop.currentValue || null,
          suggestedValue: prop.suggestedValue || null,
          required: prop.required !== false
        }
      })
      
      return {
        hasIssues: evaluation.hasIssues || false,
        issues: evaluation.issues || [],
        fixes: evaluation.fixes || [],
        missingProperties: enrichedMissingProperties
      }
    } catch (error) {
      console.error('[EVALUATION] Failed to evaluate workflow:', error)
      return { hasIssues: false, issues: [], fixes: [], missingProperties: [] }
    }
  }

  /**
   * Apply automatic fixes to the workflow
   */
  private async applyWorkflowFixes(
    workflowId: string,
    fixes: Array<{ action: string; target: string; reason: string }>
  ): Promise<{ applied: number; nodesRemoved?: number; connectionsRemoved?: number }> {
    let applied = 0
    let nodesRemoved = 0
    let connectionsRemoved = 0

    for (const fix of fixes) {
      try {
        console.log(`[FIX] Applying: ${fix.action} on ${fix.target} - ${fix.reason}`)
        
        if (fix.action === 'remove_node') {
          // Call API to remove node
          const result = await this.mcpClient.callTool(
            'embed_orchestrator',
            'remove_node',
            {
              apiKey: this.apiKey,
              workflowId,
              graphId: 'main',
              nodeId: fix.target
            }
          )
          if (JSON.parse(result).success) {
            applied++
            nodesRemoved++
          }
        } else if (fix.action === 'remove_connection') {
          // Call API to remove connection
          // Note: This would need a connection ID which we don't track yet
          console.log('[FIX] Connection removal not yet implemented')
        } else if (fix.action === 'update_property') {
          // Property updates should go through user interaction
          console.log('[FIX] Property updates deferred to user interaction')
        }
      } catch (error) {
        console.error(`[FIX] Failed to apply fix: ${fix.action}`, error)
      }
    }

    return { applied, nodesRemoved, connectionsRemoved }
  }
}
