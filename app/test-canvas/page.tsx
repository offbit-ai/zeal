'use client'

import { Database, Code, Bot } from 'lucide-react'
import { WorkflowNode } from '@/components/WorkflowNode'
import { WorkflowCanvas } from '@/components/WorkflowCanvas'
import { NodeMetadata } from '@/types/workflow'

export default function TestCanvas() {
  const nodes: NodeMetadata[] = [
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
      type: 'service',
      title: 'Claude',
      icon: Bot,
      variant: 'black',
      shape: 'circle',
      size: 'medium'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-xl font-medium mb-4">Workflow Canvas Test</h1>
      
      <WorkflowCanvas className="h-96 m-4">
        {/* Positioned nodes */}
        <div className="absolute left-8 top-16">
          <WorkflowNode metadata={nodes[0]} />
        </div>
        
        <div className="absolute left-80 top-16">
          <WorkflowNode metadata={nodes[1]} />
        </div>
        
        <div className="absolute left-80 top-48">
          <WorkflowNode metadata={nodes[2]} />
        </div>
      </WorkflowCanvas>
    </div>
  )
}