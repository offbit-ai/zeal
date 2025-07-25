'use client'

import { Database, Code, Bot } from 'lucide-react'
import { WorkflowNode } from '@/components/WorkflowNode'
import { ConnectionLine } from '@/components/ConnectionLine'
import { NodeMetadata } from '@/types/workflow'

export default function TestConnections() {
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
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-xl font-medium mb-8">Connection Lines Test</h1>
      
      <div className="relative bg-white rounded-lg p-8 h-96">
        {/* Nodes */}
        <div className="absolute left-8 top-16">
          <WorkflowNode metadata={nodes[0]} />
        </div>
        
        <div className="absolute left-80 top-16">
          <WorkflowNode metadata={nodes[1]} />
        </div>
        
        <div className="absolute left-80 top-48">
          <WorkflowNode metadata={nodes[2]} />
        </div>

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Solid connection from node 1 to node 2 */}
          <ConnectionLine 
            startX={240} 
            startY={50} 
            endX={320} 
            endY={50} 
            type="solid"
          />
          
          {/* Dashed connection from node 2 to node 3 */}
          <ConnectionLine 
            startX={400} 
            startY={66} 
            endX={400} 
            endY={180} 
            type="dashed"
          />
        </svg>
      </div>
    </div>
  )
}