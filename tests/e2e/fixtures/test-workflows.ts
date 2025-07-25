export const testWorkflows = {
  simple: {
    name: 'Simple Linear Workflow',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 100, y: 200 },
        data: {
          label: 'Daily Schedule',
          config: {
            schedule: '0 9 * * *'
          }
        }
      },
      {
        id: 'action-1',
        type: 'action',
        position: { x: 400, y: 200 },
        data: {
          label: 'Send Email',
          config: {
            to: 'test@example.com',
            subject: 'Daily Report'
          }
        }
      }
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'trigger-1',
        target: 'action-1'
      }
    ]
  },

  branching: {
    name: 'Branching Workflow',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 100, y: 200 },
        data: {
          label: 'API Webhook',
          config: {
            endpoint: '/webhook/receive'
          }
        }
      },
      {
        id: 'condition-1',
        type: 'condition',
        position: { x: 300, y: 200 },
        data: {
          label: 'Check Status',
          config: {
            condition: 'status === "active"'
          }
        }
      },
      {
        id: 'action-1',
        type: 'action',
        position: { x: 500, y: 100 },
        data: {
          label: 'Process Active',
          config: {}
        }
      },
      {
        id: 'action-2',
        type: 'action',
        position: { x: 500, y: 300 },
        data: {
          label: 'Process Inactive',
          config: {}
        }
      }
    ],
    connections: [
      {
        id: 'conn-1',
        source: 'trigger-1',
        target: 'condition-1'
      },
      {
        id: 'conn-2',
        source: 'condition-1',
        sourceHandle: 'true',
        target: 'action-1'
      },
      {
        id: 'conn-3',
        source: 'condition-1',
        sourceHandle: 'false',
        target: 'action-2'
      }
    ]
  },

  complex: {
    name: 'Complex Multi-Step Workflow',
    nodes: Array.from({ length: 20 }, (_, i) => ({
      id: `node-${i}`,
      type: i === 0 ? 'trigger' : 'action',
      position: {
        x: 100 + (i % 5) * 200,
        y: 100 + Math.floor(i / 5) * 150
      },
      data: {
        label: `Node ${i}`,
        config: {}
      }
    })),
    connections: Array.from({ length: 19 }, (_, i) => ({
      id: `conn-${i}`,
      source: `node-${i}`,
      target: `node-${i + 1}`
    }))
  }
};