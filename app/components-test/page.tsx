'use client'

import { NodeCard } from '@/components/ui/NodeCard'
import { Database, Code, Bot, GitBranch, MessageSquare, Clock } from 'lucide-react'

export default function ComponentsTest() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-8">Component Library Test</h1>
      
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">Node Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
          
          {/* Trigger Nodes */}
          <NodeCard 
            title="Get Database" 
            subtitle="getAll: databasePage"
            icon={Database}
            iconBgColor="bg-black"
          />
          
          {/* Action Nodes */}
          <NodeCard 
            title="Update CRM" 
            icon={Code}
            iconBgColor="bg-gray-700"
          />
          
          {/* AI Nodes */}
          <NodeCard 
            title="AI Agent 1" 
            subtitle="Tools Agent"
            icon={Bot}
            iconBgColor="bg-gray-800"
          />
          
          {/* Conditional Nodes */}
          <NodeCard 
            title="If 1" 
            icon={GitBranch}
            iconBgColor="bg-gray-600"
          />
          
          {/* Communication Nodes */}
          <NodeCard 
            title="Telegram" 
            subtitle="mycoolmessage, messages"
            icon={MessageSquare}
            iconBgColor="bg-gray-900"
          />
          
          {/* Schedule Node */}
          <NodeCard 
            title="Schedule Trigger" 
            subtitle="Every day at 9:00 AM"
            icon={Clock}
            iconBgColor="bg-black"
          />
        </div>
      </section>
    </div>
  )
}