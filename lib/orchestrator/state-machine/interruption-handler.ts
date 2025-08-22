/**
 * Interruption Handler for State Machine
 * Manages goal stack and context preservation during interruptions
 */

import {
  StateType,
  StateContext,
  Goal,
  StreamingResponse
} from './types'

export interface InterruptionContext {
  originalGoal: Goal
  interruptionReason: string
  preservedState: StateType
  preservedContext: Map<string, any>
}

/**
 * Handles interruptions and goal management
 */
export class InterruptionHandler {
  private interruptionHistory: InterruptionContext[] = []
  
  /**
   * Detect if input is an interruption
   */
  detectInterruption(input: string, context: StateContext): boolean {
    const interruptionPatterns = [
      // Explicit interruptions
      /wait|stop|pause|hold on|actually|nevermind/i,
      
      // Direction changes
      /instead|rather|change.*to|different|forget that/i,
      
      // Error corrections
      /no not|wrong|that's not|didn't mean/i,
      
      // New unrelated requests
      /^(create|build|make|add) (?!.*to existing)/i,
      
      // Questions that diverge from current task
      /^(what|how|why|can you|could you)/i
    ]
    
    // Check if in a state that can be interrupted
    if (!this.isInterruptibleState(context.currentState)) {
      return false
    }
    
    // Check for interruption patterns
    return interruptionPatterns.some(pattern => pattern.test(input))
  }
  
  /**
   * Check if current state can be interrupted
   */
  private isInterruptibleState(state: StateType): boolean {
    const nonInterruptibleStates = [
      StateType.ERROR_RECOVERY,
      StateType.COMPLETE
    ]
    return !nonInterruptibleStates.includes(state)
  }
  
  /**
   * Handle an interruption
   */
  handleInterruption(
    input: string,
    context: StateContext
  ): {
    newGoal: Goal
    response: StreamingResponse
  } {
    // Save current goal to stack
    const currentGoal = this.createGoalFromContext(context)
    context.goalStack.push(currentGoal)
    
    // Preserve interruption context
    this.interruptionHistory.push({
      originalGoal: currentGoal,
      interruptionReason: input,
      preservedState: context.currentState,
      preservedContext: new Map(context.dynamicContext)
    })
    
    // Analyze interruption type
    const interruptionType = this.classifyInterruption(input)
    
    // Create new goal based on interruption
    const newGoal = this.createGoalFromInterruption(input, interruptionType)
    
    // Generate response
    const response: StreamingResponse = {
      type: 'message',
      content: this.generateInterruptionResponse(interruptionType, currentGoal),
      metadata: {
        interrupted: true,
        originalGoal: currentGoal.description,
        newGoal: newGoal.description
      }
    }
    
    return { newGoal, response }
  }
  
  /**
   * Resume from interruption
   */
  resumeFromInterruption(context: StateContext): {
    resumedGoal: Goal | undefined
    response: StreamingResponse | null
  } {
    const resumedGoal = context.goalStack.pop()
    
    if (!resumedGoal) {
      return {
        resumedGoal: undefined,
        response: null
      }
    }
    
    // Restore context
    const interruption = this.interruptionHistory.find(
      i => i.originalGoal.id === resumedGoal.id
    )
    
    if (interruption) {
      // Restore preserved context
      for (const [key, value] of interruption.preservedContext) {
        context.dynamicContext.set(key, value)
      }
    }
    
    const response: StreamingResponse = {
      type: 'message',
      content: `Returning to: ${resumedGoal.description}`,
      metadata: {
        resumed: true,
        goal: resumedGoal
      }
    }
    
    return { resumedGoal, response }
  }
  
  /**
   * Create goal from current context
   */
  private createGoalFromContext(context: StateContext): Goal {
    return {
      id: `goal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: this.getGoalType(context),
      state: context.currentState,
      description: this.generateGoalDescription(context),
      context: new Map(context.dynamicContext),
      priority: this.calculatePriority(context)
    }
  }
  
  /**
   * Get goal type from context
   */
  private getGoalType(context: StateContext): Goal['type'] {
    if (context.pendingQuestions.length > 0) {
      return 'property_collection'
    }
    if (context.currentState === StateType.ANALYZE_MODIFICATION ||
        context.currentState === StateType.EXECUTE_MODIFICATION) {
      return 'modification'
    }
    if (context.currentState === StateType.ERROR_RECOVERY) {
      return 'error_recovery'
    }
    return 'workflow_creation'
  }
  
  /**
   * Generate goal description
   */
  private generateGoalDescription(context: StateContext): string {
    switch (context.currentState) {
      case StateType.CREATE_NODES:
        return `Creating ${context.intent?.suggestedNodes.length || 0} nodes`
      case StateType.CONNECT_NODES:
        return `Connecting nodes in workflow`
      case StateType.COLLECT_PROPERTIES:
        return `Collecting ${context.pendingQuestions.length} property values`
      case StateType.EVALUATE_WORKFLOW:
        return `Evaluating workflow completeness`
      default:
        return `${context.currentState.replace(/_/g, ' ').toLowerCase()}`
    }
  }
  
  /**
   * Calculate goal priority
   */
  private calculatePriority(context: StateContext): number {
    // Higher priority for later stages
    const statePriorities: Record<StateType, number> = {
      [StateType.IDLE]: 0,
      [StateType.ANALYZE_CONTEXT]: 1,
      [StateType.DETECT_INTENT]: 2,
      [StateType.CLARIFY_INTENT]: 2,
      [StateType.PLAN_WORKFLOW]: 3,
      [StateType.SEARCH_TEMPLATES]: 4,
      [StateType.CREATE_NODES]: 5,
      [StateType.CONNECT_NODES]: 6,
      [StateType.CREATE_GROUPS]: 6,
      [StateType.CREATE_SUBGRAPH]: 6,
      [StateType.EVALUATE_WORKFLOW]: 7,
      [StateType.COLLECT_PROPERTIES]: 8,
      [StateType.UPDATE_PROPERTIES]: 8,
      [StateType.ANALYZE_MODIFICATION]: 5,
      [StateType.EXECUTE_MODIFICATION]: 6,
      [StateType.REMOVE_NODES]: 6,
      [StateType.HANDLE_FEEDBACK]: 7,
      [StateType.HANDLE_INTERRUPTION]: 9,
      [StateType.ERROR_RECOVERY]: 10,
      [StateType.GENERATE_SUMMARY]: 3,
      [StateType.COMPLETE]: 0
    }
    
    return statePriorities[context.currentState] || 5
  }
  
  /**
   * Classify interruption type
   */
  private classifyInterruption(input: string): string {
    const lower = input.toLowerCase()
    
    if (/wait|stop|pause|hold/.test(lower)) {
      return 'pause'
    }
    if (/instead|rather|change.*to/.test(lower)) {
      return 'redirect'
    }
    if (/wrong|not right|mistake/.test(lower)) {
      return 'correction'
    }
    if (/forget|nevermind|cancel/.test(lower)) {
      return 'cancel'
    }
    if (/^(what|how|why|can)/.test(lower)) {
      return 'question'
    }
    
    return 'general'
  }
  
  /**
   * Create goal from interruption
   */
  private createGoalFromInterruption(input: string, type: string): Goal {
    return {
      id: `goal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: 'workflow_creation', // Will be updated based on intent
      state: StateType.DETECT_INTENT,
      description: `Handle ${type}: ${input.substring(0, 50)}...`,
      context: new Map(),
      priority: 10 // High priority for interruptions
    }
  }
  
  /**
   * Generate interruption response
   */
  private generateInterruptionResponse(type: string, originalGoal: Goal): string {
    const responses: Record<string, string> = {
      pause: `I'll pause working on "${originalGoal.description}". What would you like to do instead?`,
      redirect: `Understood. Let me switch focus from "${originalGoal.description}" to your new request.`,
      correction: `I see there was an issue. Let me correct that.`,
      cancel: `Canceling "${originalGoal.description}". What would you like to do next?`,
      question: `Let me answer your question first, then we can return to "${originalGoal.description}".`,
      general: `I'll handle this first, then return to "${originalGoal.description}".`
    }
    
    return responses[type] || responses.general
  }
  
  /**
   * Check if should auto-resume
   */
  shouldAutoResume(context: StateContext): boolean {
    // Auto-resume if:
    // 1. Current task is complete
    // 2. There are goals on the stack
    // 3. No explicit "forget" command was given
    
    return (
      context.currentState === StateType.COMPLETE &&
      context.goalStack.length > 0 &&
      !this.hasExplicitForget(context)
    )
  }
  
  /**
   * Check if user explicitly said to forget previous task
   */
  private hasExplicitForget(context: StateContext): boolean {
    const lastInput = context.currentInput || ''
    return /forget|abandon|don't.*return|skip/i.test(lastInput)
  }
  
  /**
   * Generate resume prompt
   */
  generateResumePrompt(goal: Goal): string {
    return `Would you like me to continue with "${goal.description}"? (yes/no/modify)`
  }
  
  /**
   * Clear interruption history for a goal
   */
  clearInterruptionHistory(goalId: string) {
    this.interruptionHistory = this.interruptionHistory.filter(
      i => i.originalGoal.id !== goalId
    )
  }
  
  /**
   * Get interruption statistics
   */
  getInterruptionStats() {
    return {
      totalInterruptions: this.interruptionHistory.length,
      byType: this.interruptionHistory.reduce((acc, i) => {
        const type = this.classifyInterruption(i.interruptionReason)
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      averageDepth: this.calculateAverageStackDepth()
    }
  }
  
  /**
   * Calculate average goal stack depth
   */
  private calculateAverageStackDepth(): number {
    if (this.interruptionHistory.length === 0) return 0
    
    const depths = this.interruptionHistory.map((_, index) => index + 1)
    return depths.reduce((a, b) => a + b, 0) / depths.length
  }
}

/**
 * Conversational flow manager
 */
export class ConversationalFlowManager {
  private interruptionHandler: InterruptionHandler
  
  constructor() {
    this.interruptionHandler = new InterruptionHandler()
  }
  
  /**
   * Process input and determine flow
   */
  processInput(
    input: string,
    context: StateContext
  ): {
    isInterruption: boolean
    shouldResume: boolean
    action: 'continue' | 'interrupt' | 'resume' | 'complete'
    response?: StreamingResponse
  } {
    // Check for interruption
    if (this.interruptionHandler.detectInterruption(input, context)) {
      const { newGoal, response } = this.interruptionHandler.handleInterruption(input, context)
      context.currentGoal = newGoal
      
      return {
        isInterruption: true,
        shouldResume: false,
        action: 'interrupt',
        response
      }
    }
    
    // Check if should auto-resume
    if (this.interruptionHandler.shouldAutoResume(context)) {
      const { resumedGoal, response } = this.interruptionHandler.resumeFromInterruption(context)
      
      if (resumedGoal) {
        context.currentGoal = resumedGoal
        return {
          isInterruption: false,
          shouldResume: true,
          action: 'resume',
          response: response || undefined
        }
      }
    }
    
    // Continue normal flow
    return {
      isInterruption: false,
      shouldResume: false,
      action: context.currentState === StateType.COMPLETE ? 'complete' : 'continue'
    }
  }
  
  /**
   * Generate conversational response
   */
  generateConversationalResponse(
    context: StateContext,
    baseResponse: string
  ): string {
    const additions: string[] = []
    
    // Add goal stack info if relevant
    if (context.goalStack.length > 0) {
      additions.push(`(I'll return to ${context.goalStack[context.goalStack.length - 1].description} after this)`)
    }
    
    // Add progress info
    if (context.existingNodes.length > 0) {
      additions.push(`Progress: ${context.existingNodes.length} nodes created`)
    }
    
    // Combine base response with additions
    return additions.length > 0
      ? `${baseResponse} ${additions.join(' ')}`
      : baseResponse
  }
}