'use client'

import { useState } from 'react'
import { Database, Code, Bot } from 'lucide-react'
import { InteractiveCanvas } from '@/components/InteractiveCanvas'
import { WorkflowNode } from '@/components/WorkflowNode'
import { NodeMetadata } from '@/types/workflow'

export default function TestInteractiveCanvas() {
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <h1 className="text-sm font-medium text-gray-900">Interactive Canvas Test</h1>
        <p className="text-xs text-gray-500 mt-1">
          Scroll with mouse wheel or drag with Cmd+Click to pan
        </p>
      </div>
      
      <div className="h-[calc(100vh-80px)]">
        <InteractiveCanvas>
          {/* Place some nodes at different positions */}
          <div className="absolute left-[100px] top-[100px]">
            <WorkflowNode metadata={nodes[0]} />
          </div>
          
          <div className="absolute left-[400px] top-[100px]">
            <WorkflowNode metadata={nodes[1]} />
          </div>
          
          <div className="absolute left-[250px] top-[300px]">
            <WorkflowNode metadata={nodes[2]} />
          </div>
          
          {/* Add more nodes to demonstrate infinite canvas */}
          <div className="absolute left-[700px] top-[200px]">
            <WorkflowNode metadata={nodes[0]} />
          </div>
          
          <div className="absolute left-[500px] top-[400px]">
            <WorkflowNode metadata={nodes[1]} />
          </div>
        </InteractiveCanvas>
      </div>
    </div>
  )
}