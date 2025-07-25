'use client'

import { Database, Code, Bot } from 'lucide-react'
import { WorkflowNode } from '@/components/WorkflowNode'

export default function TestVariants() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="space-y-6">
        <h1 className="text-xl font-medium mb-8">Workflow Node Variants</h1>
        
        <div className="space-y-4">
          <WorkflowNode 
            icon={Database}
            title="Get Database"
            subtitle="getAll: databasePage"
            variant="black"
          />
          
          <WorkflowNode 
            icon={Code}
            title="Update CRM"
            variant="gray-700"
          />
          
          <WorkflowNode 
            icon={Bot}
            title="AI Agent 1"
            subtitle="Tools Agent"
            variant="gray-600"
          />
        </div>
      </div>
    </div>
  )
}