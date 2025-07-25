'use client'

import React from 'react'
import { Search, Clock, Webhook, Mail, Database, Code, MessageSquare, Edit3, Bot, GitBranch } from 'lucide-react'

const nodeCategories = [
  {
    title: 'Triggers',
    nodes: [
      {
        type: 'trigger',
        label: 'Schedule Trigger',
        description: 'Runs on a schedule',
        icon: Clock,
        testId: 'schedule-trigger',
        config: { schedule: '0 9 * * *', timezone: 'UTC' }
      },
      {
        type: 'trigger', 
        label: 'Webhook Trigger',
        description: 'HTTP webhook endpoint',
        icon: Webhook,
        testId: 'webhook-trigger',
        config: { endpoint: '/webhook', method: 'POST' }
      },
    ],
  },
  {
    title: 'Actions',
    nodes: [
      {
        type: 'action',
        label: 'Get Database',
        description: 'Query database records',
        icon: Database,
        testId: 'get-database',
        config: { table: 'users', limit: 100 }
      },
      {
        type: 'action',
        label: 'Update CRM',
        description: 'Update CRM records',
        icon: Code,
        testId: 'update-crm',
        config: { operation: 'update', fields: 'all' }
      },
      {
        type: 'action',
        label: 'Send Email',
        description: 'Send email notification',
        icon: Mail,
        testId: 'send-email',
        config: { template: 'default', provider: 'smtp' }
      },
      {
        type: 'action',
        label: 'CRM Database',
        description: 'CRM database operations',
        icon: Database,
        testId: 'crm-database',
        config: { connection: 'primary' }
      },
      {
        type: 'action',
        label: 'Telegram',
        description: 'Send Telegram message',
        icon: MessageSquare,
        testId: 'telegram',
        config: { channel: '@notifications' }
      },
      {
        type: 'action',
        label: 'Memory',
        description: 'Store/retrieve data',
        icon: Edit3,
        testId: 'memory',
        config: { storage: 'session' }
      },
    ],
  },
  {
    title: 'AI & Logic',
    nodes: [
      {
        type: 'ai',
        label: 'AI Agent 1',
        description: 'AI processing agent',
        icon: Bot,
        testId: 'ai-agent-1',
        config: { model: 'gpt-4', temperature: 0.7 }
      },
      {
        type: 'ai',
        label: 'Claude Opus 4.0',
        description: 'Claude AI model',
        icon: Bot,
        testId: 'claude-opus',
        config: { model: 'claude-opus-4.0', maxTokens: 4000 }
      },
      {
        type: 'condition',
        label: 'If 1',
        description: 'Conditional logic',
        icon: GitBranch,
        testId: 'if-condition',
        config: { condition: 'value > 0', operator: 'gt' }
      },
    ],
  },
]

export function NodePalette() {
  const onDragStart = (event: React.DragEvent, node: any) => {
    event.dataTransfer.setData('application/reactflow', node.type)
    event.dataTransfer.setData('application/label', node.label)
    event.dataTransfer.setData('application/description', node.description || '')
    event.dataTransfer.setData('application/config', JSON.stringify(node.config || {}))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside
      className="w-64 bg-white border-r border-border p-4 overflow-y-auto"
      role="aside"
      aria-label="Node Palette"
      data-testid="node-palette"
    >
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary w-4 h-4" />
        <input
          type="text"
          placeholder="Search nodes..."
          className="w-full pl-10 pr-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          data-testid="node-search"
        />
      </div>
      
      <div className="space-y-6">
        {nodeCategories.map((category) => (
          <div key={category.title}>
            <h3 className="text-sm font-medium text-secondary mb-3 uppercase tracking-wide">
              {category.title}
            </h3>
            <div className="space-y-2">
              {category.nodes.map((node) => {
                const IconComponent = node.icon
                const colorClass = node.type === 'trigger' ? 'bg-primary hover:bg-hover' : 'bg-secondary hover:bg-hover'
                
                return (
                  <div
                    key={node.testId}
                    className={`${colorClass} text-white p-3 rounded-lg cursor-move transition-colors flex items-center space-x-3`}
                    draggable
                    onDragStart={(e) => onDragStart(e, node)}
                    data-testid={`palette-node-${node.testId}`}
                  >
                    <IconComponent size={16} />
                    <span className="text-sm font-medium">{node.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}