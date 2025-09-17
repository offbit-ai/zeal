/**
 * Actor implementation that runs entirely in the worker
 */

import { NodeTemplate } from '../../types';
import { ReflowActorContext, ZealActorContext } from '../types/actor.types';

/**
 * Base class for Reflow-compatible actors that run in the worker
 */
export abstract class WorkerActor {
  public inports: string[];
  public outports: string[];
  protected state: Map<string, any> = new Map();
  
  constructor(
    public readonly templateId: string,
    public readonly template: NodeTemplate
  ) {
    // Initialize ports from template
    this.inports = this.getInputPortNames();
    this.outports = this.getOutputPortNames();
  }
  
  /**
   * Get input port names from template
   */
  private getInputPortNames(): string[] {
    if (!this.template.ports) {
      return ['input'];
    }
    
    const inputPorts = this.template.ports
      .filter(port => port.type === 'input')
      .map(port => port.id);
    
    return inputPorts.length > 0 ? inputPorts : ['input'];
  }
  
  /**
   * Get output port names from template
   */
  private getOutputPortNames(): string[] {
    if (!this.template.ports) {
      return ['output'];
    }
    
    const outputPorts = this.template.ports
      .filter(port => port.type === 'output')
      .map(port => port.id);
    
    return outputPorts.length > 0 ? outputPorts : ['output'];
  }
  
  /**
   * Reflow-compatible run method
   */
  async run(context: ReflowActorContext): Promise<void> {
    // Create Zeal-extended context
    const zealContext: ZealActorContext = {
      ...context,
      nodeId: context.config.nodeId,
      executionId: context.config.executionId,
      templateId: this.templateId,
      template: this.template,
      properties: context.config.properties || {},
      metadata: context.config.metadata || {},
      // Override state methods to use local state
      state: {
        get: (key: string) => this.state.get(key),
        set: (key: string, value: any) => this.state.set(key, value)
      }
    };
    
    try {
      // Execute the actor and get outputs
      const outputs = await this.execute(zealContext);
      
      // Send outputs to Reflow
      if (outputs && typeof outputs === 'object') {
        context.send(outputs);
      }
    } catch (error) {
      // Send error to error port if it exists
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.outports.includes('error')) {
        context.send({ error: errorMessage });
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Abstract execute method to be implemented by subclasses
   * Returns outputs for the ports
   */
  abstract execute(context: ZealActorContext): Promise<Record<string, any>> | Record<string, any>;
}

/**
 * Dynamic actor that uses a provided function
 */
export class DynamicWorkerActor extends WorkerActor {
  private executeFn: Function;
  
  constructor(
    templateId: string,
    template: NodeTemplate,
    executeFunction: Function | string
  ) {
    super(templateId, template);
    
    // If string, compile it as a function
    if (typeof executeFunction === 'string') {
      this.executeFn = this.compileFunction(executeFunction);
    } else {
      this.executeFn = executeFunction;
    }
  }
  
  async execute(context: ZealActorContext): Promise<Record<string, any>> {
    return await this.executeFn(context);
  }
  
  /**
   * Compile a string function in the worker context
   */
  private compileFunction(fnString: string): Function {
    // Create function from string
    // This runs in the worker context so it's safe
    return new Function('return ' + fnString)();
  }
}

/**
 * Factory for creating worker actors
 */
export class WorkerActorFactory {
  private static actors = new Map<string, typeof WorkerActor>();
  
  /**
   * Register a built-in actor class
   */
  static register(templateId: string, actorClass: typeof WorkerActor): void {
    this.actors.set(templateId, actorClass);
  }
  
  /**
   * Create an actor instance
   */
  static create(
    templateId: string,
    template: NodeTemplate,
    config?: any
  ): WorkerActor {
    // Check if there's a registered actor class
    const ActorClass = this.actors.get(templateId);
    if (ActorClass) {
      return new (ActorClass as any)(templateId, template, config);
    }
    
    // Check if config contains a function
    if (config?.handler) {
      return new DynamicWorkerActor(templateId, template, config.handler);
    }
    
    // Default to a pass-through actor
    return new PassThroughActor(templateId, template);
  }
}

/**
 * Simple pass-through actor
 */
class PassThroughActor extends WorkerActor {
  async execute(context: ZealActorContext): Promise<Record<string, any>> {
    // Pass through all inputs to outputs
    const outputs: Record<string, any> = {};
    
    // Map each input to corresponding output
    for (const port of this.inports) {
      if (context.input[port] !== undefined) {
        // Try to map to same-named output port, or default output
        const outputPort = this.outports.includes(port) ? port : this.outports[0];
        outputs[outputPort] = context.input[port];
      }
    }
    
    return outputs;
  }
}