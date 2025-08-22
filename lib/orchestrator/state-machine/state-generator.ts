/**
 * Dynamic State Generator
 * Uses LLM to generate state machine configurations based on task requirements
 */

import {
  StateType,
  DynamicState,
  StateMachineConfig,
  StateTransition,
  LLMAction,
  ToolAction,
  CollectAction,
  DecisionAction,
  CompositeAction,
  StateContext
} from './types'

const STATE_GENERATION_PROMPT = `You are a state machine architect. Given a task description, generate a dynamic state machine configuration.

Available state types:
- IDLE: Waiting for input
- ANALYZE_CONTEXT: Analyze existing workflow/context
- DETECT_INTENT: Understand what user wants
- CLARIFY_INTENT: Ask for clarification
- PLAN_WORKFLOW: Plan the workflow structure
- SEARCH_TEMPLATES: Search for node templates
- CREATE_NODES: Create workflow nodes
- CONNECT_NODES: Connect nodes together
- CREATE_GROUPS: Group related nodes
- CREATE_SUBGRAPH: Create nested workflows
- EVALUATE_WORKFLOW: Check for issues/completeness
- COLLECT_PROPERTIES: Gather configuration values
- UPDATE_PROPERTIES: Apply property updates
- ANALYZE_MODIFICATION: Understand modification request
- EXECUTE_MODIFICATION: Apply modifications
- REMOVE_NODES: Delete nodes
- HANDLE_FEEDBACK: Process user feedback
- HANDLE_INTERRUPTION: Handle task interruption
- ERROR_RECOVERY: Recover from errors
- GENERATE_SUMMARY: Create workflow summary
- COMPLETE: Task completed

Action types you can use:
1. llm: Call LLM with prompt and context
2. tool: Call MCP tool (embed_orchestrator, node_template_repository, etc.)
3. collect: Collect input from user
4. decide: Make decision based on context
5. composite: Execute multiple actions

Return a JSON object with EXACTLY this structure:

{
  "initialState": "IDLE",
  "maxGoalStackDepth": 10,
  "defaultTimeout": 30000,
  "enableLogging": true,
  "enableVisualization": false,
  "states": {
    "IDLE": {
      "name": "Idle State",
      "description": "Waiting for user input",
      "action": {
        "type": "decide",
        "logic": "Determine next state based on input"
      },
      "transitions": [
        {
          "condition": "always",
          "nextState": "ANALYZE_CONTEXT",
          "priority": 1
        }
      ],
      "config": {
        "interruptible": true,
        "resumable": true,
        "timeout": null,
        "retryable": false,
        "maxRetries": 0
      }
    },
    "ANALYZE_CONTEXT": {
      "name": "Analyze Context",
      "description": "Load existing workflow and context",
      "action": {
        "type": "tool",
        "toolName": "embed_orchestrator",
        "toolMethod": "list_workflow_nodes",
        "parameters": {
          "workflowId": "{{workflowId}}",
          "graphId": "{{graphId}}"
        }
      },
      "transitions": [
        {
          "condition": "result.success === true",
          "nextState": "DETECT_INTENT",
          "saveToContext": {
            "nodes": "existingNodes"
          }
        },
        {
          "condition": "result.success === false",
          "nextState": "ERROR_RECOVERY"
        }
      ],
      "config": {
        "interruptible": false,
        "resumable": true,
        "timeout": 10000,
        "retryable": true,
        "maxRetries": 2
      }
    },
    "DETECT_INTENT": {
      "name": "Detect Intent",
      "description": "Understand user's request",
      "action": {
        "type": "llm",
        "prompt": "Extract intent from: {{currentInput}}",
        "systemPrompt": "You are an intent detection system",
        "contextKeys": ["currentInput", "existingNodes", "chatHistory"],
        "expectedOutput": "json",
        "parseResponse": "JSON.parse"
      },
      "transitions": [
        {
          "condition": "result.intent && result.intent.suggestedNodes",
          "nextState": "SEARCH_TEMPLATES",
          "saveToContext": {
            "intent": "intent"
          }
        },
        {
          "condition": "result.needsClarification === true",
          "nextState": "CLARIFY_INTENT"
        },
        {
          "condition": "result.isModification === true",
          "nextState": "ANALYZE_MODIFICATION"
        }
      ],
      "config": {
        "interruptible": false,
        "resumable": true,
        "timeout": 15000,
        "retryable": true,
        "maxRetries": 2
      }
    },
    "SEARCH_TEMPLATES": {
      "name": "Search Templates",
      "description": "Find matching node templates",
      "action": {
        "type": "composite",
        "parallel": true,
        "actions": [
          {
            "type": "tool",
            "toolName": "embed_orchestrator",
            "toolMethod": "search_node_templates",
            "parameters": {
              "query": "{{searchQuery}}",
              "limit": 10
            }
          }
        ]
      },
      "transitions": [
        {
          "condition": "result.results && result.results.length > 0",
          "nextState": "CREATE_NODES",
          "saveToContext": {
            "results": "templateMap"
          }
        },
        {
          "condition": "result.results && result.results.length === 0",
          "nextState": "CLARIFY_INTENT"
        }
      ],
      "config": {
        "interruptible": true,
        "resumable": true,
        "timeout": 10000,
        "retryable": true,
        "maxRetries": 2
      }
    },
    "CREATE_NODES": {
      "name": "Create Nodes",
      "description": "Create workflow nodes from templates",
      "action": {
        "type": "composite",
        "parallel": true,
        "actions": [
          {
            "type": "tool",
            "toolName": "embed_orchestrator",
            "toolMethod": "add_node_from_template",
            "parameters": {
              "apiKey": "{{apiKey}}",
              "workflowId": "{{workflowId}}",
              "templateQuery": "{{nodeQuery}}",
              "position": "{{position}}",
              "useCRDT": true
            }
          }
        ]
      },
      "transitions": [
        {
          "condition": "result.success === true",
          "nextState": "CONNECT_NODES",
          "saveToContext": {
            "nodeId": "nodeMap"
          }
        },
        {
          "condition": "result.success === false",
          "nextState": "ERROR_RECOVERY"
        }
      ],
      "config": {
        "interruptible": true,
        "resumable": true,
        "timeout": 20000,
        "retryable": true,
        "maxRetries": 2
      }
    },
    "CONNECT_NODES": {
      "name": "Connect Nodes",
      "description": "Create connections between nodes",
      "action": {
        "type": "tool",
        "toolName": "embed_orchestrator",
        "toolMethod": "connect_nodes",
        "parameters": {
          "apiKey": "{{apiKey}}",
          "workflowId": "{{workflowId}}",
          "sourceNodeId": "{{sourceId}}",
          "sourcePortId": "{{sourcePort}}",
          "targetNodeId": "{{targetId}}",
          "targetPortId": "{{targetPort}}",
          "useCRDT": true
        }
      },
      "transitions": [
        {
          "condition": "result.success === true",
          "nextState": "EVALUATE_WORKFLOW"
        },
        {
          "condition": "result.needsGroups === true",
          "nextState": "CREATE_GROUPS"
        }
      ],
      "config": {
        "interruptible": true,
        "resumable": true,
        "timeout": 15000,
        "retryable": true,
        "maxRetries": 3
      }
    },
    "EVALUATE_WORKFLOW": {
      "name": "Evaluate Workflow",
      "description": "Check workflow completeness and issues",
      "action": {
        "type": "decide",
        "logic": "Analyze workflow for missing properties, disconnected nodes, and other issues"
      },
      "transitions": [
        {
          "condition": "result.missingProperties && result.missingProperties.length > 0",
          "nextState": "COLLECT_PROPERTIES",
          "saveToContext": {
            "missingProperties": "pendingQuestions"
          }
        },
        {
          "condition": "result.hasIssues === true",
          "nextState": "HANDLE_FEEDBACK"
        },
        {
          "condition": "result.isComplete === true",
          "nextState": "GENERATE_SUMMARY"
        }
      ],
      "config": {
        "interruptible": true,
        "resumable": true,
        "timeout": 10000,
        "retryable": false
      }
    },
    "COLLECT_PROPERTIES": {
      "name": "Collect Properties",
      "description": "Gather missing configuration values from user",
      "action": {
        "type": "collect",
        "questions": "{{pendingQuestions}}",
        "validators": [],
        "allowInterruption": true
      },
      "transitions": [
        {
          "condition": "result.collected === true",
          "nextState": "UPDATE_PROPERTIES",
          "saveToContext": {
            "collectedValues": "propertyValues"
          }
        },
        {
          "condition": "result.interrupted === true",
          "nextState": "HANDLE_INTERRUPTION"
        }
      ],
      "config": {
        "interruptible": true,
        "resumable": true,
        "timeout": 300000,
        "retryable": false
      }
    },
    "UPDATE_PROPERTIES": {
      "name": "Update Properties",
      "description": "Apply collected property values to nodes",
      "action": {
        "type": "tool",
        "toolName": "embed_orchestrator",
        "toolMethod": "update_node_properties",
        "parameters": {
          "apiKey": "{{apiKey}}",
          "workflowId": "{{workflowId}}",
          "nodeId": "{{nodeId}}",
          "propertyValues": "{{propertyValues}}",
          "useCRDT": true
        }
      },
      "transitions": [
        {
          "condition": "result.success === true",
          "nextState": "EVALUATE_WORKFLOW"
        },
        {
          "condition": "result.success === false",
          "nextState": "ERROR_RECOVERY"
        }
      ],
      "config": {
        "interruptible": false,
        "resumable": true,
        "timeout": 10000,
        "retryable": true,
        "maxRetries": 2
      }
    },
    "HANDLE_FEEDBACK": {
      "name": "Handle Feedback",
      "description": "Process user feedback about the workflow",
      "action": {
        "type": "llm",
        "prompt": "Analyze feedback: {{feedback}}",
        "contextKeys": ["feedback", "existingNodes", "evaluationResult"],
        "expectedOutput": "json"
      },
      "transitions": [
        {
          "condition": "result.actions && result.actions.length > 0",
          "nextState": "EXECUTE_MODIFICATION"
        },
        {
          "condition": "result.needsClarification === true",
          "nextState": "CLARIFY_INTENT"
        },
        {
          "condition": "result.resolved === true",
          "nextState": "EVALUATE_WORKFLOW"
        }
      ],
      "config": {
        "interruptible": true,
        "resumable": true,
        "timeout": 15000,
        "retryable": false
      }
    },
    "HANDLE_INTERRUPTION": {
      "name": "Handle Interruption",
      "description": "Save context and handle user interruption",
      "action": {
        "type": "decide",
        "logic": "Save current goal to stack and process interruption"
      },
      "transitions": [
        {
          "condition": "result.newGoal === true",
          "nextState": "DETECT_INTENT"
        },
        {
          "condition": "result.resume === true",
          "nextState": "{{previousState}}"
        }
      ],
      "config": {
        "interruptible": false,
        "resumable": true,
        "timeout": 5000,
        "retryable": false
      }
    },
    "ERROR_RECOVERY": {
      "name": "Error Recovery",
      "description": "Recover from errors",
      "action": {
        "type": "decide",
        "logic": "Determine recovery strategy based on error type"
      },
      "transitions": [
        {
          "condition": "result.retry === true && context.errorCount < 3",
          "nextState": "{{previousState}}"
        },
        {
          "condition": "result.skip === true",
          "nextState": "EVALUATE_WORKFLOW"
        },
        {
          "condition": "context.errorCount >= 3",
          "nextState": "COMPLETE"
        }
      ],
      "config": {
        "interruptible": false,
        "resumable": true,
        "timeout": 5000,
        "retryable": false
      }
    },
    "GENERATE_SUMMARY": {
      "name": "Generate Summary",
      "description": "Create workflow completion summary",
      "action": {
        "type": "decide",
        "logic": "Generate summary of created workflow"
      },
      "transitions": [
        {
          "condition": "always",
          "nextState": "COMPLETE"
        }
      ],
      "config": {
        "interruptible": false,
        "resumable": false,
        "timeout": 5000,
        "retryable": false
      }
    },
    "COMPLETE": {
      "name": "Complete",
      "description": "Workflow creation completed",
      "action": {
        "type": "decide",
        "logic": "Finalize and return results"
      },
      "transitions": [],
      "config": {
        "interruptible": false,
        "resumable": false,
        "timeout": 1000,
        "retryable": false
      }
    }
  }
}`

export interface GeneratorOptions {
  taskDescription: string
  capabilities: string[]
  constraints?: string[]
  examples?: any[]
}

export class DynamicStateGenerator {
  constructor(
    private llmService: any
  ) {}
  
  /**
   * Generate a complete state machine configuration for a task
   */
  async generateStateMachine(options: GeneratorOptions): Promise<StateMachineConfig> {
    const prompt = this.buildPrompt(options)
    
    const response = await this.llmService.call({
      messages: [
        {
          role: 'system',
          content: STATE_GENERATION_PROMPT
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    })
    
    const generatedConfig = JSON.parse(response.content)
    
    // Convert to StateMachineConfig
    return this.parseGeneratedConfig(generatedConfig)
  }
  
  /**
   * Generate a single state dynamically
   */
  async generateState(
    stateType: StateType,
    context: any,
    requirements: string
  ): Promise<DynamicState> {
    const prompt = `Generate a state configuration for ${stateType} with these requirements:
${requirements}

Current context:
${JSON.stringify(context, null, 2)}

Return a JSON object with:
- name: Human-readable state name
- description: What this state does
- action: The action configuration
- transitions: Array of possible transitions
- config: State behavior configuration`
    
    const response = await this.llmService.call({
      messages: [
        {
          role: 'system',
          content: 'You are a state machine architect. Generate the requested state configuration.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 1500
    })
    
    const stateConfig = JSON.parse(response.content)
    
    return this.parseStateConfig(stateType, stateConfig)
  }
  
  /**
   * Adapt state machine based on runtime feedback
   */
  async adaptStateMachine(
    currentConfig: StateMachineConfig,
    feedback: string,
    performance: any
  ): Promise<StateMachineConfig> {
    const prompt = `The current state machine has this configuration:
${JSON.stringify(currentConfig, null, 2)}

Performance metrics:
${JSON.stringify(performance, null, 2)}

User feedback: ${feedback}

Suggest improvements to the state machine configuration. Return the updated configuration.`
    
    const response = await this.llmService.call({
      messages: [
        {
          role: 'system',
          content: 'You are a state machine optimizer. Improve the configuration based on feedback.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    })
    
    const updatedConfig = JSON.parse(response.content)
    return this.parseGeneratedConfig(updatedConfig)
  }
  
  /**
   * Build prompt for state machine generation
   */
  private buildPrompt(options: GeneratorOptions): string {
    let prompt = `Task: ${options.taskDescription}\n\n`
    
    if (options.capabilities && options.capabilities.length > 0) {
      prompt += `Available capabilities:\n`
      options.capabilities.forEach(cap => {
        prompt += `- ${cap}\n`
      })
      prompt += '\n'
    }
    
    if (options.constraints && options.constraints.length > 0) {
      prompt += `Constraints:\n`
      options.constraints.forEach(constraint => {
        prompt += `- ${constraint}\n`
      })
      prompt += '\n'
    }
    
    if (options.examples && options.examples.length > 0) {
      prompt += `Examples of similar workflows:\n`
      prompt += JSON.stringify(options.examples, null, 2)
      prompt += '\n'
    }
    
    prompt += `Generate a state machine configuration that:
1. Handles the main task flow
2. Includes error recovery states
3. Supports interruptions and resumption
4. Has proper state transitions
5. Uses appropriate actions for each state`
    
    return prompt
  }
  
  /**
   * Parse generated configuration into StateMachineConfig
   */
  private parseGeneratedConfig(config: any): StateMachineConfig {
    const states = new Map<StateType, DynamicState>()
    
    // Parse each state
    for (const [stateId, stateConfig] of Object.entries(config.states || {})) {
      const stateType = stateId as StateType
      states.set(stateType, this.parseStateConfig(stateType, stateConfig as any))
    }
    
    // Ensure required states exist
    this.ensureRequiredStates(states)
    
    return {
      states,
      initialState: config.initialState || StateType.IDLE,
      maxGoalStackDepth: config.maxGoalStackDepth || 10,
      defaultTimeout: config.defaultTimeout || 30000,
      enableLogging: config.enableLogging !== false,
      enableVisualization: config.enableVisualization || false
    }
  }
  
  /**
   * Parse a single state configuration
   */
  private parseStateConfig(stateType: StateType, config: any): DynamicState {
    return {
      id: stateType,
      name: config.name || stateType,
      description: config.description || '',
      action: this.parseAction(config.action),
      transitions: this.parseTransitions(config.transitions),
      config: {
        interruptible: config.config?.interruptible !== false,
        resumable: config.config?.resumable !== false,
        timeout: config.config?.timeout,
        retryable: config.config?.retryable || false,
        maxRetries: config.config?.maxRetries || 3
      },
      onEnter: config.onEnter,
      onExit: config.onExit,
      onError: config.onError
    }
  }
  
  /**
   * Parse action configuration
   */
  private parseAction(action: any): LLMAction | ToolAction | CollectAction | DecisionAction | CompositeAction {
    if (!action || !action.type) {
      // Default to decision action
      return {
        type: 'decide',
        decisionLogic: (context) => StateType.COMPLETE
      }
    }
    
    switch (action.type) {
      case 'llm':
        return {
          type: 'llm',
          prompt: action.prompt || '',
          systemPrompt: action.systemPrompt,
          contextKeys: action.contextKeys || [],
          expectedOutput: action.expectedOutput || 'text',
          parseResponse: action.parseResponse
        }
        
      case 'tool':
        return {
          type: 'tool',
          toolName: action.toolName,
          toolMethod: action.toolMethod,
          parameters: action.parameters || {},
          handleResponse: action.handleResponse
        }
        
      case 'collect':
        return {
          type: 'collect',
          questions: action.questions || [],
          validators: action.validators,
          allowInterruption: action.allowInterruption !== false
        }
        
      case 'decide':
        return {
          type: 'decide',
          decisionLogic: this.createDecisionFunction(action.logic)
        }
        
      case 'composite':
        return {
          type: 'composite',
          actions: (action.actions || []).map((a: any) => this.parseAction(a)),
          parallel: action.parallel || false
        }
        
      default:
        return {
          type: 'decide',
          decisionLogic: (context) => StateType.COMPLETE
        }
    }
  }
  
  /**
   * Parse state transitions
   */
  private parseTransitions(transitions: any[]): StateTransition[] {
    if (!transitions || !Array.isArray(transitions)) {
      return [{
        condition: 'always',
        nextState: StateType.COMPLETE
      }]
    }
    
    return transitions.map(t => ({
      condition: this.parseCondition(t.condition),
      nextState: t.nextState as StateType,
      priority: t.priority,
      saveToContext: t.saveToContext
    }))
  }
  
  /**
   * Parse transition condition
   */
  private parseCondition(condition: any): string | ((context: any, result: any) => boolean) {
    if (typeof condition === 'string') {
      return condition
    }
    
    if (typeof condition === 'object' && condition.type === 'function') {
      // Generate function from description
      return this.createConditionFunction(condition.logic)
    }
    
    return 'always'
  }
  
  /**
   * Create decision function from logic description
   */
  private createDecisionFunction(logic: any): (context: any) => string {
    if (typeof logic === 'function') {
      return logic
    }
    
    // Default decision function
    return (context) => {
      if (context.errorCount > 3) {
        return StateType.ERROR_RECOVERY
      }
      if (context.pendingQuestions.length > 0) {
        return StateType.COLLECT_PROPERTIES
      }
      if (context.evaluationResult?.hasIssues) {
        return StateType.HANDLE_FEEDBACK
      }
      return StateType.COMPLETE
    }
  }
  
  /**
   * Create condition function from logic description
   */
  private createConditionFunction(logic: any): (context: any, result: any) => boolean {
    if (typeof logic === 'function') {
      return logic
    }
    
    // Default condition function
    return (context, result) => {
      return result?.success === true
    }
  }
  
  /**
   * Ensure required states exist in the configuration
   */
  private ensureRequiredStates(states: Map<StateType, DynamicState>) {
    // Ensure IDLE state exists
    if (!states.has(StateType.IDLE)) {
      states.set(StateType.IDLE, {
        id: StateType.IDLE,
        name: 'Idle',
        description: 'Waiting for input',
        action: {
          type: 'decide',
          decisionLogic: (context) => StateType.ANALYZE_CONTEXT
        },
        transitions: [{
          condition: 'always',
          nextState: StateType.ANALYZE_CONTEXT
        }],
        config: {
          interruptible: true,
          resumable: true
        }
      })
    }
    
    // Ensure COMPLETE state exists
    if (!states.has(StateType.COMPLETE)) {
      states.set(StateType.COMPLETE, {
        id: StateType.COMPLETE,
        name: 'Complete',
        description: 'Task completed',
        action: {
          type: 'decide',
          decisionLogic: () => StateType.COMPLETE
        },
        transitions: [],
        config: {
          interruptible: false,
          resumable: false
        }
      })
    }
    
    // Ensure ERROR_RECOVERY state exists
    if (!states.has(StateType.ERROR_RECOVERY)) {
      states.set(StateType.ERROR_RECOVERY, {
        id: StateType.ERROR_RECOVERY,
        name: 'Error Recovery',
        description: 'Recovering from error',
        action: {
          type: 'decide',
          decisionLogic: (context) => {
            if (context.errorCount > 5) {
              return StateType.COMPLETE
            }
            return context.previousState || StateType.IDLE
          }
        },
        transitions: [{
          condition: (context) => context.errorCount > 5,
          nextState: StateType.COMPLETE
        }, {
          condition: 'always',
          nextState: StateType.IDLE
        }],
        config: {
          interruptible: false,
          resumable: true,
          retryable: true
        }
      })
    }
  }
}

/**
 * Pre-built state machine templates for common workflows
 */
export class StateMachineTemplates {
  static readonly WORKFLOW_CREATION: Partial<StateMachineConfig> = {
    initialState: StateType.IDLE,
    states: new Map<StateType, DynamicState>([
      [StateType.IDLE, {
        id: StateType.IDLE,
        name: 'Idle',
        description: 'Waiting for workflow request',
        action: { type: 'decide', decisionLogic: () => StateType.ANALYZE_CONTEXT },
        transitions: [{ condition: 'always', nextState: StateType.ANALYZE_CONTEXT }],
        config: { interruptible: true, resumable: true }
      }],
      [StateType.ANALYZE_CONTEXT, {
        id: StateType.ANALYZE_CONTEXT,
        name: 'Analyze Context',
        description: 'Load existing workflow if present',
        action: { 
          type: 'tool',
          toolName: 'embed_orchestrator',
          toolMethod: 'list_workflow_nodes',
          parameters: (context: StateContext) => ({
            workflowId: context.workflowId,
            graphId: context.graphId
          })
        },
        transitions: [{ condition: 'always', nextState: StateType.DETECT_INTENT }],
        config: { interruptible: false, resumable: true }
      }],
      [StateType.DETECT_INTENT, {
        id: StateType.DETECT_INTENT,
        name: 'Detect Intent',
        description: 'Understand user request',
        action: { 
          type: 'llm',
          prompt: '{{originalRequest}}',
          contextKeys: ['originalRequest', 'existingNodes'],
          expectedOutput: 'json'
        },
        transitions: [
          { 
            condition: (ctx: StateContext) => ctx.existingNodes.length > 0,
            nextState: StateType.ANALYZE_MODIFICATION 
          },
          { 
            condition: 'always',
            nextState: StateType.SEARCH_TEMPLATES 
          }
        ],
        config: { interruptible: false, resumable: true }
      }]
    ])
  }
  
  static readonly MODIFICATION_WORKFLOW: Partial<StateMachineConfig> = {
    initialState: StateType.ANALYZE_MODIFICATION,
    states: new Map<StateType, DynamicState>([
      [StateType.ANALYZE_MODIFICATION, {
        id: StateType.ANALYZE_MODIFICATION,
        name: 'Analyze Modification',
        description: 'Understand what needs to be changed',
        action: {
          type: 'llm',
          prompt: 'Analyze modification request: {{currentInput}}',
          contextKeys: ['currentInput', 'existingNodes', 'existingConnections'],
          expectedOutput: 'json'
        },
        transitions: [
          { 
            condition: (ctx: StateContext, result: any) => result.needsClarification,
            nextState: StateType.CLARIFY_INTENT 
          },
          { 
            condition: (ctx: StateContext, result: any) => result.actions?.length > 0,
            nextState: StateType.EXECUTE_MODIFICATION 
          },
          { 
            condition: 'always',
            nextState: StateType.EVALUATE_WORKFLOW 
          }
        ],
        config: { interruptible: true, resumable: true }
      }]
    ])
  }
}