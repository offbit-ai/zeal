'use client'

import { NodeCard } from '@/components/ui/NodeCard'
import { Database, Code, Bot, GitBranch, MessageSquare, Edit3, Play } from 'lucide-react'

export default function WorkflowDemo() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Canvas Area */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 min-h-[600px] relative">
          
          {/* Nodes positioned absolutely to match reference */}
          <div className="absolute" style={{ left: '50px', top: '100px' }}>
            <NodeCard 
              title="Get Database" 
              subtitle="getAll: databasePage"
              icon={Database}
              iconBgColor="bg-black"
            />
          </div>
          
          <div className="absolute" style={{ left: '400px', top: '100px' }}>
            <NodeCard 
              title="Update CRM" 
              icon={Code}
              iconBgColor="bg-gray-700"
            />
          </div>
          
          <div className="absolute" style={{ left: '750px', top: '100px' }}>
            <NodeCard 
              title="AI Agent 1" 
              subtitle="Tools Agent"
              icon={Bot}
              iconBgColor="bg-black"
            />
          </div>
          
          <div className="absolute" style={{ left: '1100px', top: '100px' }}>
            <NodeCard 
              title="If 1" 
              icon={GitBranch}
              iconBgColor="bg-gray-600"
            />
          </div>
          
          <div className="absolute" style={{ left: '1450px', top: '100px' }}>
            <NodeCard 
              title="Memory" 
              icon={Edit3}
              iconBgColor="bg-gray-700"
            />
          </div>
          
          {/* Claude and CRM Database nodes */}
          <div className="absolute" style={{ left: '550px', top: '300px' }}>
            <div className="bg-black text-white px-6 py-6 rounded-full">
              <Bot className="w-8 h-8" />
            </div>
            <p className="text-center text-sm mt-2 font-medium">Claude Opus 4.0</p>
          </div>
          
          <div className="absolute" style={{ left: '750px', top: '300px' }}>
            <div className="bg-gray-800 text-white px-6 py-6 rounded-full">
              <Database className="w-8 h-8" />
            </div>
            <p className="text-center text-sm mt-2 font-medium">CRM Database</p>
          </div>
          
          <div className="absolute" style={{ left: '950px', top: '300px' }}>
            <div className="bg-gray-900 text-white px-6 py-6 rounded-full">
              <MessageSquare className="w-8 h-8" />
            </div>
            <p className="text-center text-sm mt-2 font-medium">Telegram</p>
            <p className="text-center text-xs text-gray-500">mycoolmessage, messages</p>
          </div>
          
          {/* Connection lines (simplified) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {/* Get Database to Update CRM */}
            <line x1="330" y1="120" x2="400" y2="120" stroke="#D1D5DB" strokeWidth="2" />
            {/* Update CRM to AI Agent */}
            <line x1="680" y1="120" x2="750" y2="120" stroke="#D1D5DB" strokeWidth="2" />
            {/* AI Agent to If */}
            <line x1="1030" y1="120" x2="1100" y2="120" stroke="#D1D5DB" strokeWidth="2" />
            {/* If to Memory */}
            <line x1="1380" y1="120" x2="1450" y2="120" stroke="#D1D5DB" strokeWidth="2" />
          </svg>
          
          {/* Labels */}
          <div className="absolute" style={{ left: '250px', top: '50px' }}>
            <span className="text-xs text-gray-500">Retrieve</span>
          </div>
          
          <div className="absolute" style={{ left: '600px', top: '50px' }}>
            <span className="text-xs text-gray-500">Code</span>
          </div>
          
          <div className="absolute" style={{ left: '950px', top: '50px' }}>
            <span className="text-xs text-gray-500">AI Agent</span>
          </div>
        </div>
        
        {/* Bottom toolbar */}
        <div className="flex items-center justify-between mt-4 bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Ready</span>
            <button className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors">
              <Play className="w-4 h-4" />
              Execute Workflow
            </button>
          </div>
          <div className="text-sm text-gray-600">
            Nodes: 8 | Connections: 7
          </div>
        </div>
      </div>
    </div>
  )
}