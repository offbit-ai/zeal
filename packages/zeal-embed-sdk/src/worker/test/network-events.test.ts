/**
 * Test network event handling with Reflow
 */

import { NetworkEvent, REFLOW_EVENT_TYPES } from '../types/reflow-types';

// Mock network event generator for testing
export function createMockNetworkEvent(
  type: NetworkEvent['_type'],
  actorId?: string,
  timestamp?: number
): NetworkEvent {
  const baseEvent = {
    timestamp: timestamp || Date.now()
  };

  switch (type) {
    case 'NetworkStarted':
      return {
        _type: 'NetworkStarted',
        ...baseEvent
      } as NetworkEvent;

    case 'NetworkIdle':
      return {
        _type: 'NetworkIdle',
        ...baseEvent
      } as NetworkEvent;

    case 'NetworkShutdown':
      return {
        _type: 'NetworkShutdown',
        ...baseEvent
      } as NetworkEvent;

    case 'ActorStarted':
      return {
        _type: 'ActorStarted',
        actorId: actorId || 'test-actor',
        component: 'test-component',
        ...baseEvent
      } as NetworkEvent;

    case 'ActorCompleted':
      return {
        _type: 'ActorCompleted',
        actorId: actorId || 'test-actor',
        component: 'test-component',
        outputs: { output: 'test result' },
        ...baseEvent
      } as NetworkEvent;

    case 'ActorFailed':
      return {
        _type: 'ActorFailed',
        actorId: actorId || 'test-actor',
        component: 'test-component',
        error: 'Test error',
        ...baseEvent
      } as NetworkEvent;

    case 'MessageSent':
      return {
        _type: 'MessageSent',
        fromActor: 'actor1',
        fromPort: 'output',
        toActor: 'actor2',
        toPort: 'input',
        message: { type: 'String', data: 'test' },
        ...baseEvent
      } as NetworkEvent;

    case 'MessageReceived':
      return {
        _type: 'MessageReceived',
        actorId: actorId || 'test-actor',
        port: 'input',
        message: { type: 'String', data: 'test' },
        ...baseEvent
      } as NetworkEvent;

    default:
      throw new Error(`Unknown event type: ${type}`);
  }
}

// Test event sequences
export const TEST_EVENT_SEQUENCES = {
  SIMPLE_EXECUTION: [
    createMockNetworkEvent('NetworkStarted'),
    createMockNetworkEvent('ActorStarted', 'node1'),
    createMockNetworkEvent('ActorCompleted', 'node1'),
    createMockNetworkEvent('NetworkIdle'),
    createMockNetworkEvent('NetworkShutdown')
  ],

  FAILED_EXECUTION: [
    createMockNetworkEvent('NetworkStarted'),
    createMockNetworkEvent('ActorStarted', 'node1'),
    createMockNetworkEvent('ActorFailed', 'node1'),
    createMockNetworkEvent('NetworkShutdown')
  ],

  COMPLEX_FLOW: [
    createMockNetworkEvent('NetworkStarted'),
    createMockNetworkEvent('ActorStarted', 'node1'),
    createMockNetworkEvent('ActorCompleted', 'node1'),
    createMockNetworkEvent('MessageSent'),
    createMockNetworkEvent('MessageReceived', 'node2'),
    createMockNetworkEvent('ActorStarted', 'node2'),
    createMockNetworkEvent('ActorCompleted', 'node2'),
    createMockNetworkEvent('NetworkIdle'),
    createMockNetworkEvent('NetworkShutdown')
  ]
};

// Network event processor for testing
export class NetworkEventProcessor {
  private events: NetworkEvent[] = [];
  private state = {
    networkStarted: false,
    networkCompleted: false,
    activeActors: new Set<string>(),
    completedActors: new Set<string>(),
    failedActors: new Set<string>(),
    messageCount: 0
  };

  processEvent(event: NetworkEvent): void {
    this.events.push(event);

    switch (event._type) {
      case 'NetworkStarted':
        this.state.networkStarted = true;
        break;

      case 'NetworkShutdown':
        this.state.networkCompleted = true;
        this.state.activeActors.clear();
        break;

      case 'ActorStarted':
        this.state.activeActors.add(event.actorId);
        break;

      case 'ActorCompleted':
        this.state.activeActors.delete(event.actorId);
        this.state.completedActors.add(event.actorId);
        break;

      case 'ActorFailed':
        this.state.activeActors.delete(event.actorId);
        this.state.failedActors.add(event.actorId);
        break;

      case 'MessageSent':
      case 'MessageReceived':
        this.state.messageCount++;
        break;
    }
  }

  getState() {
    return {
      ...this.state,
      activeActors: Array.from(this.state.activeActors),
      completedActors: Array.from(this.state.completedActors),
      failedActors: Array.from(this.state.failedActors)
    };
  }

  getEvents(): NetworkEvent[] {
    return [...this.events];
  }

  reset(): void {
    this.events = [];
    this.state = {
      networkStarted: false,
      networkCompleted: false,
      activeActors: new Set(),
      completedActors: new Set(),
      failedActors: new Set(),
      messageCount: 0
    };
  }
}

// Test runner
export async function testNetworkEventHandling(): Promise<void> {
  console.log('🧪 Testing Network Event Handling');

  const processor = new NetworkEventProcessor();

  // Test 1: Simple execution flow
  console.log('\n📊 Test 1: Simple Execution Flow');
  TEST_EVENT_SEQUENCES.SIMPLE_EXECUTION.forEach(event => {
    processor.processEvent(event);
    console.log(`  Event: ${event._type}`, event);
  });

  let state = processor.getState();
  console.log('  Final State:', state);
  
  if (state.networkStarted && state.networkCompleted && 
      state.completedActors.includes('node1') && 
      state.activeActors.length === 0) {
    console.log('  ✅ Simple execution test passed');
  } else {
    console.log('  ❌ Simple execution test failed');
  }

  // Test 2: Failed execution
  console.log('\n📊 Test 2: Failed Execution');
  processor.reset();
  TEST_EVENT_SEQUENCES.FAILED_EXECUTION.forEach(event => {
    processor.processEvent(event);
  });

  state = processor.getState();
  console.log('  Final State:', state);

  if (state.networkStarted && state.networkCompleted && 
      state.failedActors.includes('node1') && 
      state.activeActors.length === 0) {
    console.log('  ✅ Failed execution test passed');
  } else {
    console.log('  ❌ Failed execution test failed');
  }

  // Test 3: Complex flow with message passing
  console.log('\n📊 Test 3: Complex Flow with Messages');
  processor.reset();
  TEST_EVENT_SEQUENCES.COMPLEX_FLOW.forEach(event => {
    processor.processEvent(event);
  });

  state = processor.getState();
  console.log('  Final State:', state);

  if (state.networkStarted && state.networkCompleted && 
      state.completedActors.includes('node1') && 
      state.completedActors.includes('node2') &&
      state.messageCount >= 2) {
    console.log('  ✅ Complex flow test passed');
  } else {
    console.log('  ❌ Complex flow test failed');
  }

  console.log('\n🎉 Network event handling tests completed!');
}

// Run test in browser
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const button = document.createElement('button');
    button.textContent = 'Test Network Events';
    button.onclick = testNetworkEventHandling;
    document.body.appendChild(button);
  });
} else {
  // Run in Node.js
  testNetworkEventHandling().catch(console.error);
}

export { testNetworkEventHandling as default };