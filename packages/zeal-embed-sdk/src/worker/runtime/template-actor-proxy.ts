/**
 * Proxy that bridges template actors with Reflow actors
 */

import { NodeTemplate } from '../../types';
import { ZealActorContext } from '../types/actor.types';

/**
 * Proxy that communicates with main thread actors via MessagePort
 */
export class TemplateActorProxy {
  private executionCount = 0;
  
  constructor(
    private templateId: string,
    private template: NodeTemplate,
    private port: MessagePort
  ) {}
  
  /**
   * Convert to Reflow-compatible actor
   */
  toReflowActor() {
    const self = this;
    
    // Create a Reflow actor class dynamically
    return class ReflowTemplateActor {
      // Define input ports based on template
      get inports() {
        const ports: Record<string, any> = {};
        
        if (self.template.ports) {
          // Filter for input ports
          const inputPorts = self.template.ports.filter(p => p.type === 'input');
          for (const port of inputPorts) {
            ports[port.id] = {
              type: 'any', // NodeTemplate ports don't have dataType
              required: false,
              label: port.label
            };
          }
        }
        
        // Default input port if none specified
        if (Object.keys(ports).length === 0) {
          ports['input'] = { type: 'any', required: false };
        }
        
        return ports;
      }
      
      // Define output ports based on template
      get outports() {
        const ports: Record<string, any> = {};
        
        if (self.template.ports) {
          // Filter for output ports
          const outputPorts = self.template.ports.filter(p => p.type === 'output');
          for (const port of outputPorts) {
            ports[port.id] = {
              type: 'any', // NodeTemplate ports don't have dataType
              label: port.label
            };
          }
        }
        
        // Default output port if none specified
        if (Object.keys(ports).length === 0) {
          ports['output'] = { type: 'any' };
        }
        
        return ports;
      }
      
      // Actor execution method
      async run(inputs: any, context: any) {
        return self.execute(inputs, context);
      }
    };
  }
  
  /**
   * Execute actor via MessagePort communication
   */
  async execute(inputs: any, reflowContext: any): Promise<any> {
    const executionId = `${this.templateId}-${++this.executionCount}`;
    
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => {
        reject(new Error(`Actor ${this.templateId} execution timeout`));
      }, 30000); // 30 second timeout
      
      // Listen for response
      channel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        
        if (event.data.success) {
          resolve(event.data.result);
        } else {
          reject(new Error(event.data.error || 'Actor execution failed'));
        }
      };
      
      // Create actor context with template information
      const actorContext: ZealActorContext = {
        input: this.normalizeInputs(inputs),
        state: {
          get: (key: string) => reflowContext.state?.get?.(key),
          set: (key: string, value: any) => reflowContext.state?.set?.(key, value)
        },
        config: reflowContext.config || {},
        send: reflowContext.send || (() => {}),
        nodeId: reflowContext.nodeId || executionId,
        executionId: reflowContext.executionId || executionId,
        templateId: this.templateId,
        template: this.template,
        properties: {
          ...this.template.properties,
          ...reflowContext.properties
        },
        metadata: {
          ...reflowContext.metadata
        }
      };
      
      // Send execution request to main thread actor
      this.port.postMessage({
        type: 'EXECUTE',
        executionId,
        inputs: this.normalizeInputs(inputs),
        context: actorContext
      }, [channel.port2]);
    });
  }
  
  /**
   * Normalize inputs based on template schema
   */
  private normalizeInputs(inputs: any): any {
    if (!this.template.ports) {
      return inputs;
    }
    
    const inputPorts = this.template.ports.filter(p => p.type === 'input');
    if (inputPorts.length === 0) {
      return inputs;
    }
    
    const normalized: Record<string, any> = {};
    
    // Handle both single input and multi-port inputs
    if (typeof inputs === 'object' && !Array.isArray(inputs)) {
      // Multi-port inputs - map by port ID
      for (const port of inputPorts) {
        if (port.id in inputs) {
          normalized[port.id] = inputs[port.id];
        }
      }
    } else {
      // Single input - assign to first input port
      const firstPort = inputPorts[0];
      if (firstPort) {
        normalized[firstPort.id] = inputs;
      }
    }
    
    return normalized;
  }
  
  /**
   * Get template information
   */
  getTemplate(): NodeTemplate {
    return this.template;
  }
  
  /**
   * Get template ID
   */
  getTemplateId(): string {
    return this.templateId;
  }
}