/**
 * Actor system type definitions
 */

import { NodeTemplate } from '../../types';

// Reflow-compatible Actor Context
export interface ReflowActorContext {
  input: Record<string, any>;  // Input data from all inports
  state: {
    get(key: string): any;
    set(key: string, value: any): void;
  };
  config: Record<string, any>;  // Actor configuration
  send(messages: Record<string, any>): void;  // Send to outports
}

// Extended context for Zeal actors
export interface ZealActorContext extends ReflowActorContext {
  nodeId: string;
  executionId: string;
  templateId: string;
  template: NodeTemplate;
  properties: Record<string, any>;
  metadata: Record<string, any>;
  signal?: AbortSignal;
}

// Actor Handler Types - now returns output for ports
export type ActorHandler<T = any> = (
  context: ZealActorContext
) => Promise<Record<string, T>> | Record<string, T> | AsyncGenerator<Record<string, T>>;

// Actor Configuration
export interface ActorConfig {
  templateId?: string;
  template?: NodeTemplate;
  handler?: ActorHandler;
  streaming?: boolean;
  timeout?: number;
  retry?: RetryConfig;
  cache?: CacheConfig;
  validate?: (inputs: any) => boolean | Promise<boolean>;
}

export interface RetryConfig {
  maxAttempts: number;
  backoff?: 'exponential' | 'linear' | 'constant';
  delay?: number;
  maxDelay?: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl?: number;
  key?: (inputs: any) => string;
}

// Actor Registration
export interface RegisteredActor {
  templateId: string;
  actor: TemplateActor;
  port: MessagePort | null;
  status: 'registered' | 'bound' | 'ready' | 'error';
}

// Template Actor
export class TemplateActor {
  constructor(
    public readonly templateId: string,
    public readonly template: NodeTemplate,
    private handler: ActorHandler
  ) {}
  
  async execute(context: ZealActorContext): Promise<any> {
    const enrichedContext: ZealActorContext = {
      ...context,
      templateId: this.templateId,
      template: this.template,
      properties: {
        ...this.template.properties,
        ...context.properties
      },
      metadata: {
        ...context.metadata
      }
    };
    
    return await this.handler(enrichedContext);
  }
  
  isStreaming(): boolean {
    return this.handler.constructor.name === 'AsyncGeneratorFunction';
  }
}

// Actor Capabilities
export type ActorCapability = 
  | 'streaming'
  | 'cacheable'
  | 'retryable'
  | 'cancellable'
  | 'stateful';

// Port Schema
export interface PortSchema {
  type: 'input' | 'output';
  dataType?: string;
  required?: boolean;
  default?: any;
  multiple?: boolean;
  description?: string;
}

// Input/Output Schemas
export interface InputSchema extends PortSchema {
  type: 'input';
}

export interface OutputSchema extends PortSchema {
  type: 'output';
}