/**
 * SharedWorker implementation for Reflow runtime
 */

const initializeWasm = require('@offbit-ai/reflow/wasm').initializeWasm;
import { Network, Graph, GraphNetwork } from '@offbit-ai/reflow/wasm';
import type { NetworkEvent } from '../types/reflow-types';
import { MessageProtocol, MessageType } from '../bridge/message-protocol';
import { WorkflowGraph, NodeTemplate } from '../../types';
import { WorkflowToReflowConverter } from './graph-converter';
// import { EventBridge } from '../bridge/event-bridge'; // Not needed with native Reflow events
import { WorkerActor, WorkerActorFactory, DynamicWorkerActor } from '../actors/worker-actor';
import { registerBuiltInActors } from '../actors/built-in-actors';

interface WorkerState {
  initialized: boolean;
  networks: Map<string, Network>;
  graphs: Map<string, Graph>;
  templates: Map<string, NodeTemplate>;
  actors: Map<string, WorkerActor>;
  executions: Map<string, ExecutionContext>;
}

interface ExecutionContext {
  id: string;
  network: GraphNetwork;
  graph: Graph;
  startTime: number;
  status: 'running' | 'completed' | 'failed' | 'shutdown';
  eventHandlers: Set<Function>;
}

class ReflowWorker {
  private state: WorkerState = {
    initialized: false,
    networks: new Map(),
    graphs: new Map(),
    templates: new Map(),
    actors: new Map(),
    executions: new Map()
  };
  
  private protocol: MessageProtocol;
  // private eventBridge: EventBridge; // Not needed with native Reflow events
  private converter: WorkflowToReflowConverter;
  private ports: Set<MessagePort> = new Set();
  
  constructor() {
    this.protocol = new MessageProtocol('worker');
    // this.eventBridge = new EventBridge(); // Not needed with native Reflow events
    this.converter = new WorkflowToReflowConverter();
    this.setupWorker();
  }
  
  private async setupWorker() {
    // Initialize Reflow WASM
    await initializeWasm();
    this.state.initialized = true;
    
    // Register built-in actors
    registerBuiltInActors();
    
    // Setup SharedWorker connection handler
    // In SharedWorker context, 'self' has onconnect
    (self as any).onconnect = (event: MessageEvent) => {
      const port = event.ports[0];
      this.ports.add(port);
      
      port.addEventListener('message', (e) => this.handleMessage(e, port));
      port.start();
      
      // Notify main thread that worker is ready
      this.protocol.sendOneWay(port, MessageType.READY, {
        initialized: true,
        version: '1.0.0'
      });
    };
    
    // Setup message handlers
    this.setupMessageHandlers();
  }
  
  private setupMessageHandlers() {
    // Template registration
    this.protocol.onMessage(MessageType.REGISTER_TEMPLATE, async (payload) => {
      const { templateId, template } = payload;
      this.state.templates.set(templateId, template);
      return { success: true, templateId };
    });
    
    // Actor registration - now creates actors in worker
    this.protocol.onMessage(MessageType.REGISTER_ACTOR, async (payload) => {
      const { templateId, template, handler, config } = payload;
      
      let actor: WorkerActor;
      
      if (handler) {
        // Create dynamic actor with provided function string
        actor = new DynamicWorkerActor(templateId, template, handler);
      } else {
        // Create actor from factory (built-in or default)
        actor = WorkerActorFactory.create(templateId, template, config);
      }
      
      // Store actor
      this.state.actors.set(templateId, actor);
      
      // Register with Reflow Network
      const network = await this.getOrCreateNetwork();
      network.registerActor(templateId, actor);
      
      return { success: true, templateId, registered: true };
    });
    
    // Graph execution
    this.protocol.onMessage(MessageType.EXECUTE_GRAPH, async (payload) => {
      const { graph: workflowGraph, inputs, executionId } = payload;
      
      // Convert WorkflowGraph to Reflow Graph
      const reflowGraph = this.converter.convert(
        workflowGraph as WorkflowGraph,
        this.state.templates
      );
      
      // // Create network for this execution
      // const network = new Network();
      
      
      
      // Build graph network
      const graphNetwork = new GraphNetwork(reflowGraph);
      // Register all actors with the network
      Array.from(this.state.actors.entries()).forEach(([templateId, actor]) => {
        graphNetwork.registerActor(templateId, actor);
      });
      
      // Store execution context
      const context: ExecutionContext = {
        id: executionId,
        network: graphNetwork,
        graph: reflowGraph,
        startTime: Date.now(),
        status: 'running',
        eventHandlers: new Set()
      };
      this.state.executions.set(executionId, context);
      
      // Start execution
      try {
        await graphNetwork.start();
        
        // // Send inputs if provided
        if (inputs) {
          // await this.sendInputsToNetwork(network, inputs);
          console.warn('Input sending not implemented yet');
        }
        
        // Set up network event listeners
        const result = await this.setupNetworkEventHandlers(graphNetwork, executionId);
        
        return result;
        
      } catch (error) {
        context.status = 'failed';
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        // Send error event
        this.broadcastMessage(MessageType.EXECUTION_ERROR, {
          executionId,
          error: errorMessage,
          stack: errorStack
        });
        
        throw error;
      } finally {
        // Cleanup
        graphNetwork.shutdown();
        this.state.executions.delete(executionId);
      }
    });
    
    // Execution control (only shutdown supported)
    this.protocol.onMessage(MessageType.CANCEL_EXECUTION, async (payload) => {
      const { executionId } = payload;
      const context = this.state.executions.get(executionId);
      
      if (context) {
        // Shutdown the network
        context.network.shutdown();
        context.status = 'shutdown';
        
        // Clean up event handlers
        context.eventHandlers.clear();
        this.state.executions.delete(executionId);
        
        return { success: true, executionId };
      }
      
      throw new Error(`Execution ${executionId} not found`);
    });
  }
  
  private async handleMessage(event: MessageEvent, port: MessagePort) {
    try {
      await this.protocol.handleMessage(event.data, port);
    } catch (error) {
      console.error('Worker message handling error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.protocol.sendOneWay(port, MessageType.ERROR, {
        error: errorMessage,
        stack: errorStack
      });
    }
  }
  
  private async getOrCreateNetwork(): Promise<Network> {
    // For now, create a shared network
    // In future, could have network per execution or per graph
    if (!this.state.networks.has('default')) {
      const network = new Network();
      this.state.networks.set('default', network);
      await network.start();
    }
    return this.state.networks.get('default')!;
  }
  
  
  private async setupNetworkEventHandlers(network: GraphNetwork, executionId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const context = this.state.executions.get(executionId);
      if (!context) {
        reject(new Error('Execution context not found'));
        return;
      }

      let completed = false;
      let networkResult: any = null;

      // Network event handler
      const eventHandler = (event: any) => {
        if (completed) return;

        const networkEvent = event as NetworkEvent;
        
        // Broadcast all network events to main thread
        this.broadcastMessage(MessageType.NETWORK_EVENT, {
          executionId,
          event: networkEvent
        });

        switch (networkEvent._type) {
          case 'NetworkStarted':
            this.broadcastMessage(MessageType.EXECUTION_STARTED, {
              executionId,
              timestamp: networkEvent.timestamp
            });
            break;
          
          case 'ActorStarted':
            this.broadcastMessage(MessageType.NODE_EXECUTE, {
              executionId,
              actorId: networkEvent.actorId,
              component: networkEvent.component,
              timestamp: networkEvent.timestamp
            });
            break;

          case 'NetworkIdle':
            // Network is idle - check if all actors are done
            this.broadcastMessage(MessageType.EXECUTION_IDLE, {
              executionId,
              timestamp: networkEvent.timestamp
            });
            break;

          case 'NetworkShutdown':
            if (!completed) {
              completed = true;
              context.status = 'completed';
              
              this.broadcastMessage(MessageType.EXECUTION_COMPLETE, {
                executionId,
                result: networkResult,
                duration: Date.now() - context.startTime,
                timestamp: networkEvent.timestamp
              });
              
              // Cleanup
              context.eventHandlers.clear();
              this.state.executions.delete(executionId);
              resolve(networkResult);
            }
            break;

          case 'ActorFailed':
            context.status = 'failed';
            
            // Send node error event
            this.broadcastMessage(MessageType.NODE_ERROR, {
              executionId,
              actorId: networkEvent.actorId,
              component: networkEvent.component,
              error: networkEvent.error,
              timestamp: networkEvent.timestamp
            });
            
            // Also send execution failed
            this.broadcastMessage(MessageType.EXECUTION_FAILED, {
              executionId,
              error: networkEvent.error,
              actorId: networkEvent.actorId,
              component: networkEvent.component,
              timestamp: networkEvent.timestamp
            });
            break;

          case 'ActorCompleted':
            // Store outputs for final result
            if (networkEvent.outputs) {
              networkResult = networkEvent.outputs;
            }
            
            this.broadcastMessage(MessageType.NODE_RESULT, {
              executionId,
              actorId: networkEvent.actorId,
              component: networkEvent.component,
              outputs: networkEvent.outputs,
              timestamp: networkEvent.timestamp
            });
            break;
        }
      };

      // Register event handler
      context.eventHandlers.add(eventHandler);
      network.next(eventHandler);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!completed) {
          completed = true;
          context.status = 'failed';
          context.eventHandlers.clear();
          this.state.executions.delete(executionId);
          reject(new Error('Execution timeout'));
        }
      }, 300000);
    });
  }
  
  private broadcastMessage(type: MessageType, payload: any) {
    Array.from(this.ports).forEach(port => {
      this.protocol.sendOneWay(port, type, payload);
    });
  }
}

// Initialize worker
new ReflowWorker();

// Export for TypeScript
export default ReflowWorker;