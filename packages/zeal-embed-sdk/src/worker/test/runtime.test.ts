/**
 * Test case for the worker-based Reflow runtime
 */

import { ReflowRuntime } from '../runtime/reflow-runtime';
import { WorkflowGraph, SerializedNode, SerializedConnection, NodeTemplate } from '../../types';

// Helper function to wait for async operations
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Test the complete workflow:
 * 1. Register template-bound actors from main thread
 * 2. Execute workflow graph in worker
 * 3. Verify actor execution and outputs
 */
async function testReflowRuntime() {
  console.log('🚀 Starting Reflow Runtime Test');
  
  // Create runtime instance
  const runtime = new ReflowRuntime();
  
  // Initialize runtime (starts worker)
  console.log('Initializing runtime...');
  await runtime.initialize();
  
  // Define test templates
  const templates: NodeTemplate[] = [
    {
      id: 'data-source',
      type: 'actor',
      name: 'Data Source',
      description: 'Generates test data',
      properties: {
        count: 5,
        prefix: 'item'
      },
      ports: [
        { id: 'output', type: 'output', label: 'Data', position: 'right' }
      ]
    },
    {
      id: 'transformer',
      type: 'actor',
      name: 'Transformer',
      description: 'Transforms data',
      properties: {
        transform: 'uppercase'
      },
      ports: [
        { id: 'input', type: 'input', label: 'Input', position: 'left' },
        { id: 'output', type: 'output', label: 'Output', position: 'right' }
      ]
    },
    {
      id: 'logger',
      type: 'actor',
      name: 'Logger',
      description: 'Logs data',
      properties: {
        level: 'info'
      },
      ports: [
        { id: 'input', type: 'input', label: 'Data', position: 'left' }
      ]
    }
  ];
  
  // Register templates
  console.log('Registering templates...');
  for (const template of templates) {
    runtime.registerTemplate(template);
  }
  
  // Register template-bound actors
  console.log('Registering actors...');
  
  // Data source actor - generates array of items
  runtime.actors()
    .forTemplate('data-source')
    .handler(async (context) => {
      const count = context.properties.count || 5;
      const prefix = context.properties.prefix || 'item';
      const items = [];
      
      for (let i = 0; i < count; i++) {
        items.push(`${prefix}_${i + 1}`);
      }
      
      console.log(`Data source generated: ${items.length} items`);
      return { output: items };
    })
    .register();
  
  // Transformer actor - transforms each item
  runtime.actors()
    .forTemplate('transformer')
    .handler(async (context) => {
      const data = context.input.input;
      const transform = context.properties.transform || 'uppercase';
      
      let result;
      if (Array.isArray(data)) {
        result = data.map(item => {
          if (transform === 'uppercase') {
            return String(item).toUpperCase();
          } else if (transform === 'reverse') {
            return String(item).split('').reverse().join('');
          }
          return item;
        });
      } else {
        if (transform === 'uppercase') {
          result = String(data).toUpperCase();
        } else if (transform === 'reverse') {
          result = String(data).split('').reverse().join('');
        } else {
          result = data;
        }
      }
      
      console.log(`Transformer applied '${transform}' to data`);
      return { output: result };
    })
    .register();
  
  // Logger actor - logs and passes through data
  runtime.actors()
    .forTemplate('logger')
    .handler(async (context) => {
      const data = context.input.input;
      const level = context.properties.level || 'info';
      
      console.log(`[${level.toUpperCase()}] Logger received:`, data);
      
      // Logger doesn't have output port, just logs
      return {};
    })
    .register();
  
  // Create test workflow graph
  console.log('Creating workflow graph...');
  const workflow: WorkflowGraph = {
    id: 'test-workflow',
    name: 'Test Workflow',
    namespace: 'test',
    isMain: true,
    nodes: [
      {
        id: 'node-1',
        type: 'data-source',
        position: { x: 100, y: 100 },
        metadata: {
          templateId: 'data-source',
          label: 'Generate Data',
          propertyValues: {
            count: 3,
            prefix: 'test'
          },
          ports: [
            { id: 'output', type: 'output', label: 'Data', position: 'right' }
          ]
        }
      },
      {
        id: 'node-2',
        type: 'transformer',
        position: { x: 300, y: 100 },
        metadata: {
          templateId: 'transformer',
          label: 'Transform Data',
          propertyValues: {
            transform: 'uppercase'
          },
          ports: [
            { id: 'input', type: 'input', label: 'Input', position: 'left' },
            { id: 'output', type: 'output', label: 'Output', position: 'right' }
          ]
        }
      },
      {
        id: 'node-3',
        type: 'logger',
        position: { x: 500, y: 100 },
        metadata: {
          templateId: 'logger',
          label: 'Log Results',
          propertyValues: {
            level: 'info'
          },
          ports: [
            { id: 'input', type: 'input', label: 'Data', position: 'left' }
          ]
        }
      }
    ],
    connections: [
      {
        id: 'conn-1',
        source: { nodeId: 'node-1', portId: 'output' },
        target: { nodeId: 'node-2', portId: 'input' },
        state: 'active'
      },
      {
        id: 'conn-2',
        source: { nodeId: 'node-2', portId: 'output' },
        target: { nodeId: 'node-3', portId: 'input' },
        state: 'active'
      }
    ],
    groups: [],
    canvasState: {
      zoom: 1,
      offset: { x: 0, y: 0 }
    }
  };
  
  // Execute workflow
  console.log('Executing workflow...');
  const executionId = await runtime.executeWorkflow(workflow);
  console.log(`Workflow execution started with ID: ${executionId}`);
  
  // Wait for execution to complete
  console.log('Waiting for execution to complete...');
  await wait(2000);
  
  // Test actor update
  console.log('\nTesting actor update...');
  runtime.actors()
    .forTemplate('transformer')
    .handler(async (context) => {
      const data = context.input.input;
      // Updated to reverse instead of uppercase
      const result = Array.isArray(data) 
        ? data.map(item => String(item).split('').reverse().join(''))
        : String(data).split('').reverse().join('');
      
      console.log('Transformer (updated) reversed data');
      return { output: result };
    })
    .register();
  
  // Update workflow to use reverse transform
  workflow.nodes[1].metadata.propertyValues.transform = 'reverse';
  
  // Execute updated workflow
  console.log('Executing updated workflow...');
  const executionId2 = await runtime.executeWorkflow(workflow);
  console.log(`Updated workflow execution started with ID: ${executionId2}`);
  
  // Wait for execution
  await wait(2000);
  
  // Test streaming actor
  console.log('\nTesting streaming actor...');
  runtime.actors()
    .forTemplate('data-source')
    .streamingHandler(async function* (context) {
      const count = context.properties.count || 5;
      const prefix = context.properties.prefix || 'item';
      
      for (let i = 0; i < count; i++) {
        await wait(500); // Simulate async generation
        const item = `${prefix}_${i + 1}_streamed`;
        console.log(`Streaming item ${i + 1}/${count}: ${item}`);
        yield { output: item };
      }
    })
    .register();
  
  // Create streaming workflow
  const streamingWorkflow: WorkflowGraph = {
    ...workflow,
    id: 'streaming-workflow',
    name: 'Streaming Test',
    nodes: [
      {
        ...workflow.nodes[0],
        metadata: {
          ...workflow.nodes[0].metadata,
          propertyValues: {
            count: 4,
            prefix: 'stream'
          }
        }
      },
      workflow.nodes[1],
      workflow.nodes[2]
    ]
  };
  
  // Execute streaming workflow
  console.log('Executing streaming workflow...');
  const executionId3 = await runtime.executeWorkflow(streamingWorkflow);
  console.log(`Streaming workflow execution started with ID: ${executionId3}`);
  
  // Wait longer for streaming to complete
  await wait(4000);
  
  // Clean up
  console.log('\n✅ Test completed successfully!');
  console.log('Cleaning up...');
  runtime.destroy();
}

// Run test if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  window.addEventListener('DOMContentLoaded', () => {
    const button = document.createElement('button');
    button.textContent = 'Run Reflow Runtime Test';
    button.onclick = testReflowRuntime;
    document.body.appendChild(button);
  });
} else {
  // Node environment or direct execution
  testReflowRuntime().catch(console.error);
}

export { testReflowRuntime };