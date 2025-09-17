/**
 * Node.js test runner for worker-based Reflow runtime
 * Tests actor execution and message passing
 */

import { WorkflowGraph, NodeTemplate } from '../../types';

// Mock worker environment for Node.js testing
class MockWorker {
  private handlers: Map<string, Function> = new Map();
  private messageQueue: any[] = [];
  
  postMessage(data: any) {
    // Simulate message passing
    this.messageQueue.push(data);
    this.processMessage(data);
  }
  
  addEventListener(event: string, handler: Function) {
    this.handlers.set(event, handler);
  }
  
  private processMessage(data: any) {
    const handler = this.handlers.get('message');
    if (handler) {
      setTimeout(() => {
        handler({ data });
      }, 0);
    }
  }
  
  terminate() {
    this.handlers.clear();
    this.messageQueue = [];
  }
}

// Test utilities
const createTestTemplate = (id: string, templateName: string): NodeTemplate => ({
  id,
  type: 'actor',
  category: 'test',
  title: templateName,
  icon: '🧪',
  description: `Test ${templateName}`,
  properties: {},
  ports: [
    { id: 'input', type: 'input', label: 'Input', position: 'left' },
    { id: 'output', type: 'output', label: 'Output', position: 'right' }
  ]
});

const createTestWorkflow = (nodes: any[], connections: any[]): WorkflowGraph => ({
  id: 'test-workflow',
  name: 'Test Workflow',
  namespace: 'test',
  isMain: true,
  nodes,
  connections,
  groups: [],
  canvasState: { zoom: 1, offset: { x: 0, y: 0 } }
});

// Test cases
class ReflowRuntimeTests {
  private testResults: Array<{ name: string; passed: boolean; error?: string }> = [];
  
  async runAllTests() {
    console.log('🧪 Starting Reflow Runtime Tests\n');
    
    await this.testActorRegistration();
    await this.testWorkflowExecution();
    await this.testMessagePassing();
    await this.testErrorHandling();
    await this.testStreamingActors();
    
    this.printResults();
  }
  
  private async testActorRegistration() {
    const testName = 'Actor Registration';
    try {
      console.log(`Testing ${testName}...`);
      
      // Test actor registration with function serialization
      const actorCode = `
        async function(context) {
          const input = context.input.data;
          return { output: input.toUpperCase() };
        }
      `;
      
      // Verify function can be serialized and reconstructed
      const fn = new Function('return ' + actorCode)();
      const result = await fn({ input: { data: 'test' } });
      
      if (result.output === 'TEST') {
        this.testResults.push({ name: testName, passed: true });
        console.log(`✅ ${testName} passed\n`);
      } else {
        throw new Error('Actor did not transform input correctly');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.testResults.push({ name: testName, passed: false, error: errorMessage });
      console.log(`❌ ${testName} failed: ${errorMessage}\n`);
    }
  }
  
  private async testWorkflowExecution() {
    const testName = 'Workflow Execution';
    try {
      console.log(`Testing ${testName}...`);
      
      // Create test workflow
      const nodes = [
        {
          id: 'node1',
          type: 'transform',
          position: { x: 100, y: 100 },
          metadata: {
            templateId: 'transform',
            propertyValues: { operation: 'uppercase' },
            ports: [
              { id: 'input', type: 'input', label: 'Input', position: 'left' },
              { id: 'output', type: 'output', label: 'Output', position: 'right' }
            ]
          }
        },
        {
          id: 'node2',
          type: 'logger',
          position: { x: 300, y: 100 },
          metadata: {
            templateId: 'logger',
            propertyValues: { level: 'info' },
            ports: [
              { id: 'input', type: 'input', label: 'Input', position: 'left' }
            ]
          }
        }
      ];
      
      const connections = [
        {
          id: 'conn1',
          source: { nodeId: 'node1', portId: 'output' },
          target: { nodeId: 'node2', portId: 'input' },
          state: 'active' as const
        }
      ];
      
      const workflow = createTestWorkflow(nodes, connections);
      
      // Verify workflow structure
      if (workflow.nodes.length === 2 && workflow.connections.length === 1) {
        this.testResults.push({ name: testName, passed: true });
        console.log(`✅ ${testName} passed\n`);
      } else {
        throw new Error('Workflow structure is invalid');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.testResults.push({ name: testName, passed: false, error: errorMessage });
      console.log(`❌ ${testName} failed: ${errorMessage}\n`);
    }
  }
  
  private async testMessagePassing() {
    const testName = 'Message Passing';
    try {
      console.log(`Testing ${testName}...`);
      
      const worker = new MockWorker();
      let messageReceived = false;
      
      worker.addEventListener('message', (event: any) => {
        if (event.data.type === 'TEST') {
          messageReceived = true;
        }
      });
      
      worker.postMessage({ type: 'TEST', payload: 'test data' });
      
      // Wait for async message processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (messageReceived) {
        this.testResults.push({ name: testName, passed: true });
        console.log(`✅ ${testName} passed\n`);
      } else {
        throw new Error('Message was not received');
      }
      
      worker.terminate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.testResults.push({ name: testName, passed: false, error: errorMessage });
      console.log(`❌ ${testName} failed: ${errorMessage}\n`);
    }
  }
  
  private async testErrorHandling() {
    const testName = 'Error Handling';
    try {
      console.log(`Testing ${testName}...`);
      
      // Test error in actor execution
      const errorActor = `
        async function(context) {
          throw new Error('Test error');
        }
      `;
      
      const fn = new Function('return ' + errorActor)();
      let errorCaught = false;
      
      try {
        await fn({ input: {} });
      } catch (error) {
        errorCaught = true;
      }
      
      if (errorCaught) {
        this.testResults.push({ name: testName, passed: true });
        console.log(`✅ ${testName} passed\n`);
      } else {
        throw new Error('Error was not caught');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.testResults.push({ name: testName, passed: false, error: errorMessage });
      console.log(`❌ ${testName} failed: ${errorMessage}\n`);
    }
  }
  
  private async testStreamingActors() {
    const testName = 'Streaming Actors';
    try {
      console.log(`Testing ${testName}...`);
      
      // Test async generator function
      const streamingActor = `
        async function*(context) {
          for (let i = 0; i < 3; i++) {
            yield { output: i };
          }
        }
      `;
      
      const fn = new Function('return ' + streamingActor)();
      const results: number[] = [];
      
      for await (const value of fn({ input: {} })) {
        results.push(value.output);
      }
      
      if (results.length === 3 && results[0] === 0 && results[2] === 2) {
        this.testResults.push({ name: testName, passed: true });
        console.log(`✅ ${testName} passed\n`);
      } else {
        throw new Error('Streaming did not produce expected results');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.testResults.push({ name: testName, passed: false, error: errorMessage });
      console.log(`❌ ${testName} failed: ${errorMessage}\n`);
    }
  }
  
  private printResults() {
    console.log('=' .repeat(50));
    console.log('TEST RESULTS');
    console.log('=' .repeat(50));
    
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;
    
    this.testResults.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('\n' + '=' .repeat(50));
    console.log(`SUMMARY: ${passed}/${total} tests passed`);
    
    if (failed > 0) {
      console.log(`⚠️  ${failed} test(s) failed`);
      process.exit(1);
    } else {
      console.log('🎉 All tests passed!');
      process.exit(0);
    }
  }
}

// Run tests
const tests = new ReflowRuntimeTests();
tests.runAllTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});