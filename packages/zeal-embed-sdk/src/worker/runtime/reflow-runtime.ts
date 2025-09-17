/**
 * Main thread runtime API for Reflow worker
 */

import { EventEmitter } from 'eventemitter3';
import { WorkflowGraph, NodeTemplate } from '../../types';
import { MessageProtocol, MessageType } from '../bridge/message-protocol';
import { ExecutionHandle } from '../bridge/execution-handle';
import { ActorConfig } from '../types/actor.types';

export interface RuntimeConfig {
  workerUrl?: string;
  templates?: NodeTemplate[];
  debug?: boolean;
}

export class ZealReflowRuntime extends EventEmitter {
  private worker: SharedWorker;
  private port: MessagePort;
  private protocol: MessageProtocol;
  private initialized = false;
  private templates = new Map<string, NodeTemplate>();
  private executions = new Map<string, ExecutionHandle>();
  
  constructor(config: RuntimeConfig = {}) {
    super();
    
    // Initialize worker
    const workerUrl = config.workerUrl || '/worker/reflow-runtime.worker.js';
    this.worker = new SharedWorker(workerUrl);
    this.port = this.worker.port;
    this.protocol = new MessageProtocol('main');
    
    // Register templates if provided
    if (config.templates) {
      for (const template of config.templates) {
        this.templates.set(template.id, template);
      }
    }
    
    this.setupPortHandlers();
  }
  
  /**
   * Setup message handlers
   */
  private setupPortHandlers() {
    this.port.addEventListener('message', (event) => {
      this.handleWorkerMessage(event.data);
    });
    
    this.port.start();
    
    // Wait for worker ready
    this.protocol.onMessage(MessageType.READY, (payload) => {
      this.initialized = true;
      this.emit('ready', payload);
    });
    
    // Handle execution events
    this.protocol.onMessage(MessageType.EXECUTION_STARTED, (payload) => {
      const handle = this.executions.get(payload.executionId);
      if (handle) {
        handle.handleEvent('start', payload);
      }
    });
    
    this.protocol.onMessage(MessageType.EXECUTION_PROGRESS, (payload) => {
      const handle = this.executions.get(payload.executionId);
      if (handle) {
        handle.handleEvent('progress', payload);
      }
    });
    
    this.protocol.onMessage(MessageType.EXECUTION_COMPLETE, (payload) => {
      const handle = this.executions.get(payload.executionId);
      if (handle) {
        handle.handleEvent('complete', payload);
        this.executions.delete(payload.executionId);
      }
    });
    
    this.protocol.onMessage(MessageType.EXECUTION_ERROR, (payload) => {
      const handle = this.executions.get(payload.executionId);
      if (handle) {
        handle.handleEvent('error', payload);
        this.executions.delete(payload.executionId);
      }
    });
    
    // Handle actor-specific events
    this.protocol.onMessage(MessageType.NODE_EXECUTE, (payload) => {
      const handle = this.executions.get(payload.executionId);
      if (handle) {
        handle.handleEvent('actor-started', payload);
      }
    });
    
    this.protocol.onMessage(MessageType.NODE_RESULT, (payload) => {
      const handle = this.executions.get(payload.executionId);
      if (handle) {
        handle.handleEvent('actor-completed', payload);
      }
    });
    
    this.protocol.onMessage(MessageType.NODE_ERROR, (payload) => {
      const handle = this.executions.get(payload.executionId);
      if (handle) {
        handle.handleEvent('actor-failed', payload);
      }
    });
    
    this.protocol.onMessage(MessageType.EXECUTION_FAILED, (payload) => {
      const handle = this.executions.get(payload.executionId);
      if (handle) {
        handle.handleEvent('error', payload);
        this.executions.delete(payload.executionId);
      }
    });
  }
  
  /**
   * Handle messages from worker
   */
  private async handleWorkerMessage(message: any) {
    await this.protocol.handleMessage(message, this.port);
  }
  
  /**
   * Wait for runtime to be ready
   */
  async waitForReady(): Promise<void> {
    if (this.initialized) return;
    
    return new Promise((resolve) => {
      this.once('ready', resolve);
    });
  }
  
  /**
   * Bind actor to template
   */
  bindTemplate(templateId: string): TemplateActorBuilder {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    return new TemplateActorBuilder(templateId, template, this);
  }
  
  /**
   * Register actor in worker
   */
  async registerActor(
    templateId: string,
    template: NodeTemplate,
    handler?: string | Function,
    config?: ActorConfig
  ): Promise<void> {
    await this.waitForReady();
    
    // Convert function to string if needed
    let handlerString: string | undefined;
    if (handler) {
      handlerString = typeof handler === 'function' 
        ? handler.toString() 
        : handler;
    }
    
    // Send to worker
    await this.protocol.sendMessage(
      this.port,
      MessageType.REGISTER_ACTOR,
      {
        templateId,
        template,
        handler: handlerString,
        config
      }
    );
  }
  
  /**
   * Execute workflow graph
   */
  async execute(
    graph: WorkflowGraph,
    inputs?: any
  ): Promise<ExecutionHandle> {
    await this.waitForReady();
    
    const executionId = crypto.randomUUID();
    const handle = new ExecutionHandle(executionId, this.protocol, this.port);
    this.executions.set(executionId, handle);
    
    // Send templates to worker if needed
    for (const node of graph.nodes) {
      const templateId = node.metadata.templateId || node.type;
      if (!this.templates.has(templateId)) {
        await this.protocol.sendMessage(
          this.port,
          MessageType.REGISTER_TEMPLATE,
          {
            templateId,
            template: node.metadata
          }
        );
        this.templates.set(templateId, node.metadata);
      }
    }
    
    // Start execution
    this.protocol.sendOneWay(
      this.port,
      MessageType.EXECUTE_GRAPH,
      {
        graph,
        inputs,
        executionId
      }
    );
    
    return handle;
  }
  
  /**
   * Get registered templates
   */
  getTemplates(): NodeTemplate[] {
    return Array.from(this.templates.values());
  }
  
  /**
   * Check if runtime is ready
   */
  isReady(): boolean {
    return this.initialized;
  }
}

/**
 * Template actor builder for fluent API
 */
export class TemplateActorBuilder {
  private handlerFn?: Function;
  private config: ActorConfig = {};
  
  constructor(
    private templateId: string,
    private template: NodeTemplate,
    private runtime: ZealReflowRuntime
  ) {
    this.config.templateId = templateId;
    this.config.template = template;
  }
  
  /**
   * Set the handler function
   * Note: This function will be serialized and sent to worker
   */
  handler(fn: (inputs: any, context: any) => any): this {
    this.handlerFn = fn;
    return this;
  }
  
  /**
   * Set timeout
   */
  timeout(ms: number): this {
    this.config.timeout = ms;
    return this;
  }
  
  /**
   * Configure retry
   */
  retry(config: { maxAttempts: number; backoff?: 'exponential' | 'linear' | 'constant'; delay?: number }): this {
    this.config.retry = config;
    return this;
  }
  
  /**
   * Configure caching
   */
  cache(enabled: boolean, ttl?: number): this {
    this.config.cache = { enabled, ttl };
    return this;
  }
  
  /**
   * Mark as streaming
   */
  streaming(): this {
    this.config.streaming = true;
    return this;
  }
  
  /**
   * Register the actor
   */
  async register(): Promise<ZealReflowRuntime> {
    await this.runtime.registerActor(
      this.templateId,
      this.template,
      this.handlerFn,
      this.config
    );
    
    return this.runtime;
  }
}