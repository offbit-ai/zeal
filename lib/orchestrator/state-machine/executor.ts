/**
 * State Machine Executor
 * Manages state transitions and executes state actions
 */

import {
  StateType,
  DynamicState,
  StateContext,
  StateExecutionResult,
  StreamingResponse,
  StateMachineConfig,
  Goal,
  StateTransition,
  LLMAction,
  ToolAction,
  CollectAction,
  DecisionAction,
  CompositeAction,
  PropertyQuestion
} from './types'
import { MCPClient } from '../mcp-client'
import { getLLMService } from './llm-service'

export class StateMachineExecutor {
  private config: StateMachineConfig
  private context: StateContext
  private mcpClient: MCPClient
  private apiKey: string
  private llmService = getLLMService()
  
  constructor(
    config: StateMachineConfig,
    mcpClient: MCPClient,
    apiKey: string,
    initialContext?: Partial<StateContext>
  ) {
    this.config = config
    this.mcpClient = mcpClient
    this.apiKey = apiKey
    
    // Initialize context
    this.context = {
      currentState: config.initialState,
      stateHistory: [],
      graphId: 'main',
      existingNodes: [],
      existingConnections: [],
      existingGroups: [],
      existingGraphs: ['main'],
      originalRequest: '',
      chatHistory: [],
      nodeMap: new Map(),
      templateMap: new Map(),
      pendingQuestions: [],
      collectedProperties: new Map(),
      goalStack: [],
      errorCount: 0,
      dynamicContext: new Map(),
      ...initialContext
    }
  }
  
  /**
   * Main execution loop
   */
  async *execute(input: string): AsyncGenerator<StreamingResponse> {
    this.context.currentInput = input
    
    // If no workflow ID, we're starting fresh
    if (!this.context.workflowId) {
      this.context.originalRequest = input
    }
    
    while (this.context.currentState !== StateType.COMPLETE) {
      const state = this.config.states.get(this.context.currentState)
      
      if (!state) {
        yield {
          type: 'error',
          content: `Unknown state: ${this.context.currentState}`
        }
        break
      }
      
      // Log state transition
      if (this.config.enableLogging) {
        console.log(`[StateMachine] Entering state: ${state.name}`)
        yield {
          type: 'state_change',
          content: `State: ${state.name}`,
          metadata: { state: this.context.currentState }
        }
      }
      
      try {
        // Execute onEnter hook
        if (state.onEnter) {
          await state.onEnter(this.context)
        }
        
        // Execute state action
        const result = await this.executeStateAction(state, input)
        
        // Yield any output
        if (result.shouldYield && result.yieldValue) {
          yield result.yieldValue
        }
        
        // Handle state transition
        if (result.success && result.nextState) {
          await this.transitionTo(result.nextState, state)
        } else if (!result.success) {
          // Handle error
          if (state.onError) {
            const errorState = await state.onError(this.context, result.error!)
            await this.transitionTo(errorState, state)
          } else {
            yield {
              type: 'error',
              content: `Error in state ${state.name}: ${result.error?.message}`
            }
            await this.transitionTo(StateType.ERROR_RECOVERY, state)
          }
        }
        
        // Check for timeout
        if (state.config.timeout) {
          // Implement timeout logic if needed
        }
        
      } catch (error) {
        console.error(`[StateMachine] Error in state ${state.name}:`, error)
        yield {
          type: 'error',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
        
        if (state.config.retryable && this.context.errorCount < (state.config.maxRetries || 3)) {
          this.context.errorCount++
          continue // Retry the same state
        } else {
          await this.transitionTo(StateType.ERROR_RECOVERY, state)
        }
      }
    }
    
    yield {
      type: 'complete',
      content: 'Workflow completed',
      workflowId: this.context.workflowId
    }
  }
  
  /**
   * Execute a state's action
   */
  private async executeStateAction(
    state: DynamicState,
    input: string
  ): Promise<StateExecutionResult> {
    const action = state.action
    
    switch (action.type) {
      case 'llm':
        return await this.executeLLMAction(action as LLMAction)
        
      case 'tool':
        return await this.executeToolAction(action as ToolAction)
        
      case 'collect':
        return await this.executeCollectAction(action as CollectAction, input)
        
      case 'decide':
        return await this.executeDecisionAction(action as DecisionAction)
        
      case 'composite':
        return await this.executeCompositeAction(action as CompositeAction, input)
        
      default:
        return {
          success: false,
          error: new Error(`Unknown action type: ${(action as any).type}`)
        }
    }
  }
  
  /**
   * Execute LLM action
   */
  private async executeLLMAction(action: LLMAction): Promise<StateExecutionResult> {
    try {
      // Build context for prompt
      const contextData: Record<string, any> = {}
      for (const key of action.contextKeys) {
        if (this.context.dynamicContext.has(key)) {
          contextData[key] = this.context.dynamicContext.get(key)
        } else if (key in this.context) {
          contextData[key] = (this.context as any)[key]
        }
      }
      
      // Replace context variables in prompt
      let prompt = action.prompt
      for (const [key, value] of Object.entries(contextData)) {
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), JSON.stringify(value))
      }
      
      // Make LLM call using the service
      console.log('[StateMachine] LLM call with prompt:', prompt.substring(0, 200) + '...')
      
      const llmResponse = await this.llmService.call({
        messages: [
          ...(action.systemPrompt ? [{ role: 'system' as const, content: action.systemPrompt }] : []),
          { role: 'user' as const, content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
      
      // Parse response based on expected output
      let parsedResponse: any
      if (action.parseResponse) {
        parsedResponse = action.parseResponse(llmResponse.content)
      } else if (action.expectedOutput === 'json') {
        try {
          parsedResponse = JSON.parse(llmResponse.content)
        } catch (e) {
          console.error('[StateMachine] Failed to parse JSON response:', e)
          parsedResponse = { error: 'Failed to parse response', raw: llmResponse.content }
        }
      } else {
        parsedResponse = llmResponse.content
      }
      
      // Store result in context
      this.context.dynamicContext.set('lastLLMResponse', parsedResponse)
      
      // Determine next state based on transitions
      const nextState = await this.evaluateTransitions(
        this.config.states.get(this.context.currentState)!.transitions,
        parsedResponse
      )
      
      return {
        success: true,
        nextState,
        output: parsedResponse
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error
      }
    }
  }
  
  /**
   * Execute tool action
   */
  private async executeToolAction(action: ToolAction): Promise<StateExecutionResult> {
    try {
      // Resolve parameters
      const params = typeof action.parameters === 'function'
        ? action.parameters(this.context)
        : action.parameters
      
      // Add API key
      const toolParams = {
        apiKey: this.apiKey,
        workflowId: this.context.workflowId,
        graphId: this.context.graphId,
        ...params
      }
      
      // Call MCP tool
      const result = await this.mcpClient.callTool(
        action.toolName as any,
        action.toolMethod,
        toolParams
      )
      
      // Parse and handle response
      const parsedResult = JSON.parse(result)
      const handledResult = action.handleResponse
        ? action.handleResponse(parsedResult)
        : parsedResult
      
      // Store result in context
      this.context.dynamicContext.set('lastToolResponse', handledResult)
      
      // Determine next state
      const nextState = await this.evaluateTransitions(
        this.config.states.get(this.context.currentState)!.transitions,
        handledResult
      )
      
      return {
        success: parsedResult.success !== false,
        nextState,
        output: handledResult,
        shouldYield: true,
        yieldValue: {
          type: 'message' as const,
          content: `✓ ${action.toolMethod} completed`,
          metadata: handledResult
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
   * Execute collect action
   */
  private async executeCollectAction(
    action: CollectAction,
    input: string
  ): Promise<StateExecutionResult> {
    // When there are pending questions, use LLM to analyze user intent
    if (this.context.pendingQuestions.length > 0) {
      const intent = await this.analyzeUserIntent(input, this.context.pendingQuestions)
      
      // Route based on intent
      if (intent.type === 'property_answer') {
        // User is answering the questions
        const propertyValues = this.extractPropertyValues(input, this.context.pendingQuestions)
        
        // Store the extracted values in context
        for (const [nodeId, values] of propertyValues.entries()) {
          const existing = this.context.collectedProperties.get(nodeId) || {}
          this.context.collectedProperties.set(nodeId, { ...existing, ...values })
        }
        
        // Store for next state
        this.context.dynamicContext.set('propertyValues', propertyValues)
        
        return {
          success: true,
          nextState: StateType.UPDATE_PROPERTIES,
          output: { 
            collected: input,
            propertyValues: Object.fromEntries(propertyValues)
          }
        }
      } else if (intent.type === 'modification_request') {
        // User wants to modify something
        this.context.dynamicContext.set('modificationRequest', input)
        return {
          success: true,
          nextState: StateType.HANDLE_FEEDBACK,
          output: { 
            intent: 'modification',
            request: input
          }
        }
      } else if (intent.type === 'clarification_question') {
        // User is asking for clarification
        return {
          success: true,
          nextState: StateType.CLARIFY_INTENT,
          output: { 
            intent: 'clarification',
            question: input
          },
          shouldYield: true,
          yieldValue: {
            type: 'message' as const,
            content: intent.response || 'Let me clarify that for you...'
          }
        }
      } else if (intent.type === 'new_request') {
        // User is making a completely new request
        // Save current state and start fresh
        this.pushGoal({
          id: `goal-${Date.now()}`,
          description: 'Resume property collection',
          type: 'property_collection',
          state: this.context.currentState,
          context: new Map(this.context.dynamicContext),
          priority: 1
        })
        
        return {
          success: true,
          nextState: StateType.DETECT_INTENT,
          output: { 
            intent: 'new_request',
            request: input
          }
        }
      }
    }
    
    // Check if this is an interruption
    if (action.allowInterruption && this.isInterruption(input)) {
      return {
        success: true,
        nextState: StateType.HANDLE_INTERRUPTION,
        output: { interrupted: true }
      }
    }
    
    // Validate input if validators provided
    if (action.validators) {
      for (const validator of action.validators) {
        if (!validator(input)) {
          return {
            success: false,
            error: new Error('Invalid input'),
            shouldYield: true,
            yieldValue: {
              type: 'message' as const,
              content: 'Invalid input. Please try again.'
            }
          }
        }
      }
    }
    
    // Store collected input
    this.context.dynamicContext.set('collectedInput', input)
    
    // Default behavior - treat as property answer
    const propertyValues = this.extractPropertyValues(input, this.context.pendingQuestions)
    
    // Store the extracted values in context
    for (const [nodeId, values] of propertyValues.entries()) {
      const existing = this.context.collectedProperties.get(nodeId) || {}
      this.context.collectedProperties.set(nodeId, { ...existing, ...values })
    }
    
    // Store for next state
    this.context.dynamicContext.set('propertyValues', propertyValues)
    
    return {
      success: true,
      nextState: StateType.UPDATE_PROPERTIES,
      output: { 
        collected: input,
        propertyValues: Object.fromEntries(propertyValues)
      }
    }
  }
  
  /**
   * Execute decision action
   */
  private async executeDecisionAction(action: DecisionAction): Promise<StateExecutionResult> {
    try {
      const nextState = action.decisionLogic(this.context) as StateType
      
      return {
        success: true,
        nextState,
        output: { decision: nextState }
      }
    } catch (error) {
      return {
        success: false,
        error: error as Error
      }
    }
  }
  
  /**
   * Execute composite action
   */
  private async executeCompositeAction(
    action: CompositeAction,
    input: string
  ): Promise<StateExecutionResult> {
    const results: any[] = []
    
    if (action.parallel) {
      // Execute actions in parallel
      const promises = action.actions.map(subAction =>
        this.executeStateAction(
          { ...this.config.states.get(this.context.currentState)!, action: subAction },
          input
        )
      )
      const parallelResults = await Promise.all(promises)
      results.push(...parallelResults)
    } else {
      // Execute actions sequentially
      for (const subAction of action.actions) {
        const result = await this.executeStateAction(
          { ...this.config.states.get(this.context.currentState)!, action: subAction },
          input
        )
        results.push(result)
        
        if (!result.success) {
          return result // Stop on first failure
        }
      }
    }
    
    // All succeeded
    const lastResult = results[results.length - 1]
    return {
      success: true,
      nextState: lastResult.nextState,
      output: results.map(r => r.output)
    }
  }
  
  /**
   * Evaluate transitions to determine next state
   */
  private async evaluateTransitions(
    transitions: StateTransition[],
    result: any
  ): Promise<StateType> {
    // Sort by priority if specified
    const sortedTransitions = [...transitions].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    )
    
    for (const transition of sortedTransitions) {
      let conditionMet = false
      
      if (typeof transition.condition === 'function') {
        conditionMet = transition.condition(this.context, result)
      } else if (transition.condition === 'always') {
        conditionMet = true
      } else {
        // Evaluate string condition (simplified)
        conditionMet = this.evaluateStringCondition(transition.condition, result)
      }
      
      if (conditionMet) {
        // Save specified fields to context
        if (transition.saveToContext) {
          for (const [resultKey, contextKey] of Object.entries(transition.saveToContext)) {
            const value = this.getNestedValue(result, resultKey)
            this.context.dynamicContext.set(contextKey, value)
          }
        }
        
        return transition.nextState
      }
    }
    
    // No transition matched, stay in current state
    return this.context.currentState
  }
  
  /**
   * Evaluate string-based condition
   */
  private evaluateStringCondition(condition: string, result: any): boolean {
    // Simple condition evaluation
    // Format: "result.field === value" or "result.field"
    
    if (condition.includes('===')) {
      const [field, value] = condition.split('===').map(s => s.trim())
      const actualValue = this.getNestedValue(result, field.replace('result.', ''))
      return actualValue === JSON.parse(value)
    }
    
    if (condition.startsWith('result.')) {
      const field = condition.replace('result.', '')
      return !!this.getNestedValue(result, field)
    }
    
    return false
  }
  
  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
  
  /**
   * Extract property values from user input
   */
  private extractPropertyValues(
    input: string,
    questions: PropertyQuestion[]
  ): Map<string, Record<string, any>> {
    const propertyValues = new Map<string, Record<string, any>>()
    
    // Parse different input formats
    // Format 1: Key-value pairs separated by newlines
    // Format 2: JSON object
    // Format 3: Natural language with values
    
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(input)
      if (typeof parsed === 'object') {
        // If it's a flat object with nodeId as keys
        for (const [nodeId, values] of Object.entries(parsed)) {
          if (typeof values === 'object') {
            propertyValues.set(nodeId, values as Record<string, any>)
          }
        }
        return propertyValues
      }
    } catch {
      // Not JSON, try other formats
    }
    
    // Parse line-by-line format
    const lines = input.split('\n').map(line => line.trim()).filter(Boolean)
    
    // Try to match each line with a question
    questions.forEach((question, index) => {
      const nodeValues = propertyValues.get(question.nodeId) || {}
      
      // Look for explicit key-value pairs
      const keyValuePattern = new RegExp(`${question.propertyName}\\s*[:=]\\s*(.+)`, 'i')
      for (const line of lines) {
        const match = line.match(keyValuePattern)
        if (match) {
          nodeValues[question.propertyName] = this.parseValue(match[1].trim(), question.propertyType)
          propertyValues.set(question.nodeId, nodeValues)
          return
        }
      }
      
      // If no explicit match, try to use line position (if user answered in order)
      if (index < lines.length) {
        const value = lines[index]
        // Check if this looks like a value for this property type
        if (this.looksLikeValue(value, question.propertyType)) {
          nodeValues[question.propertyName] = this.parseValue(value, question.propertyType)
          propertyValues.set(question.nodeId, nodeValues)
        }
      }
    })
    
    return propertyValues
  }
  
  /**
   * Parse a value based on property type
   */
  private parseValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return parseFloat(value)
      case 'boolean':
        return value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
      case 'url':
        // Clean up URL
        return value.replace(/^["']|["']$/g, '').trim()
      case 'cron':
        // Validate cron expression
        return value.trim()
      case 'code':
      case 'code-editor':
        // Preserve code formatting
        return value
      default:
        // String value - remove quotes if present
        return value.replace(/^["']|["']$/g, '').trim()
    }
  }
  
  /**
   * Check if a value looks like it matches the expected type
   */
  private looksLikeValue(value: string, type: string): boolean {
    switch (type) {
      case 'number':
        return !isNaN(parseFloat(value))
      case 'boolean':
        return /^(true|false|yes|no)$/i.test(value)
      case 'url':
        return /^(https?:\/\/|\/|\.\/)/i.test(value)
      case 'cron':
        // Basic cron pattern check
        return /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)/.test(value)
      default:
        return true // Accept any string
    }
  }
  
  /**
   * Analyze user intent when there are pending questions
   */
  private async analyzeUserIntent(
    input: string,
    pendingQuestions: PropertyQuestion[]
  ): Promise<{ type: string; response?: string }> {
    try {
      const INTENT_ANALYSIS_PROMPT = `You are analyzing user input in the context of a workflow configuration dialog.

The system just asked the user for these configuration values:
${JSON.stringify(pendingQuestions.map(q => ({
  node: q.nodeTitle,
  property: q.propertyName,
  question: q.question,
  type: q.propertyType
})), null, 2)}

User's response: "${input}"

Analyze the user's intent. They could be:
1. **property_answer**: Providing values for the requested properties
   - Examples: "use https://api.example.com", "5 minutes", "my-api-key-123"
   - Can be multiple values in one response
   
2. **modification_request**: Asking to change the workflow
   - Examples: "actually, add another node", "remove the MongoDB", "can you connect these differently?"
   - Keywords: add, remove, change, delete, modify, connect, different
   
3. **clarification_question**: Asking for more information
   - Examples: "what format should this be?", "what does this property do?", "can you give me an example?"
   - Keywords: what, how, why, example, explain, mean
   
4. **new_request**: Starting a completely different task
   - Examples: "create a new workflow for...", "forget this, I need..."
   - Clear indication they want to do something else entirely

Respond with ONLY JSON:
{
  "type": "property_answer|modification_request|clarification_question|new_request",
  "confidence": 0.0-1.0,
  "response": "Optional clarification message if type is clarification_question"
}`

      const response = await this.llmService.call({
        messages: [
          {
            role: 'system',
            content: 'You are an expert at understanding user intent in conversations. Respond with valid JSON only.'
          },
          {
            role: 'user',
            content: INTENT_ANALYSIS_PROMPT
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      })
      
      // Parse response
      let cleanContent = response.content.trim()
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '')
      
      const firstBrace = cleanContent.indexOf('{')
      const lastBrace = cleanContent.lastIndexOf('}')
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanContent = cleanContent.substring(firstBrace, lastBrace + 1)
      }
      
      return JSON.parse(cleanContent)
      
    } catch (error) {
      console.error('[Executor] Failed to analyze user intent:', error)
      // Default to treating as property answer
      return { type: 'property_answer' }
    }
  }
  
  /**
   * Check if input is an interruption
   */
  private isInterruption(input: string): boolean {
    const interruptPatterns = [
      'wait', 'stop', 'cancel', 'nevermind', 'forget it',
      'actually', 'instead', 'change', 'different',
      'you didn\'t', 'you forgot', 'missing', 'wrong'
    ]
    
    const lowerInput = input.toLowerCase()
    return interruptPatterns.some(pattern => lowerInput.includes(pattern))
  }
  
  /**
   * Transition to a new state
   */
  private async transitionTo(newState: StateType, fromState?: DynamicState) {
    // Execute onExit hook of current state
    if (fromState?.onExit) {
      await fromState.onExit(this.context)
    }
    
    // Update state history
    this.context.stateHistory.push(this.context.currentState)
    this.context.previousState = this.context.currentState
    this.context.currentState = newState
    
    // Reset error count on successful transition
    if (newState !== StateType.ERROR_RECOVERY) {
      this.context.errorCount = 0
    }
    
    console.log(`[StateMachine] Transitioned: ${this.context.previousState} → ${newState}`)
  }
  
  /**
   * Push a goal onto the stack (for interruption handling)
   */
  pushGoal(goal: Goal) {
    if (this.context.goalStack.length >= this.config.maxGoalStackDepth) {
      console.warn('[StateMachine] Goal stack depth exceeded, dropping oldest goal')
      this.context.goalStack.shift()
    }
    
    this.context.goalStack.push(goal)
    console.log(`[StateMachine] Pushed goal: ${goal.description}`)
  }
  
  /**
   * Pop a goal from the stack and restore context
   */
  popGoal(): Goal | undefined {
    const goal = this.context.goalStack.pop()
    
    if (goal) {
      // Restore relevant context
      for (const [key, value] of goal.context.entries()) {
        this.context.dynamicContext.set(key, value)
      }
      
      console.log(`[StateMachine] Popped goal: ${goal.description}`)
    }
    
    return goal
  }
  
  /**
   * Get current context (for debugging/inspection)
   */
  getContext(): StateContext {
    return { ...this.context }
  }
  
  /**
   * Generate Mermaid diagram of state machine
   */
  generateMermaidDiagram(): string {
    let mermaid = 'stateDiagram-v2\n'
    
    // Add states
    for (const [stateId, state] of this.config.states) {
      if (stateId === this.context.currentState) {
        mermaid += `    ${stateId} : ${state.name} <<current>>\n`
      } else {
        mermaid += `    ${stateId} : ${state.name}\n`
      }
    }
    
    // Add transitions
    for (const [stateId, state] of this.config.states) {
      for (const transition of state.transitions) {
        const condition = typeof transition.condition === 'string'
          ? transition.condition
          : 'custom'
        mermaid += `    ${stateId} --> ${transition.nextState} : ${condition}\n`
      }
    }
    
    return mermaid
  }
}