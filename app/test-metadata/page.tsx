'use client'

import { Database, Code, Bot, GitBranch, MessageSquare, Edit3 } from 'lucide-react'
import { WorkflowNode } from '@/components/WorkflowNode'
import { NodeMetadata } from '@/types/workflow'

export default function TestMetadata() {
  const nodeMetadatas: NodeMetadata[] = [
    {
      id: '1',
      type: 'database',
      title: 'Get Database',
      subtitle: 'getAll: databasePage',
      icon: Database,
      variant: 'black',
      shape: 'rectangle',
      size: 'medium'
    },
    {
      id: '2',
      type: 'code',
      title: 'Update CRM',
      icon: Code,
      variant: 'gray-700',
      shape: 'rectangle',
      size: 'medium'
    },
    {
      id: '3',
      type: 'ai-agent',
      title: 'AI Agent 1',
      subtitle: 'Tools Agent',
      icon: Bot,
      variant: 'black',
      shape: 'rectangle',
      size: 'medium'
    },
    {
      id: '4',
      type: 'condition',
      title: 'If 1',
      icon: GitBranch,
      variant: 'gray-600',
      shape: 'diamond',
      size: 'medium'
    },
    {
      id: '5',
      type: 'service',
      title: 'Claude Opus 4.0',
      icon: Bot,
      variant: 'black',
      shape: 'circle',
      size: 'medium'
    },
    {
      id: '6',
      type: 'service',
      title: 'CRM Database',
      icon: Database,
      variant: 'gray-800',
      shape: 'circle',
      size: 'medium'
    },
    {
      id: '7',
      type: 'service',
      title: 'Telegram',
      subtitle: 'mycoolmessage, messages',
      icon: MessageSquare,
      variant: 'gray-900',
      shape: 'circle',
      size: 'medium'
    },
    {
      id: '8',
      type: 'memory',
      title: 'Memory',
      icon: Database,
      variant: 'gray-700',
      shape: 'rectangle',
      size: 'medium'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-xl font-medium mb-8">Metadata-Driven Workflow Nodes</h1>
      
      <div className="grid grid-cols-3 gap-x-8">
        {nodeMetadatas.map((metadata) => (
          <div key={metadata.id} className="flex justify-center items-start py-1">
            <WorkflowNode metadata={metadata} />
          </div>
        ))}
      </div>
    </div>
  )
}