'use client'

import { Database, Code, Bot, GitBranch, MessageSquare, Edit3 } from 'lucide-react'

export default function WorkflowClean() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-black text-white px-6 py-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <span className="font-medium">n8n</span>
          <span className="opacity-60">Concept</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium">
            Editor
          </button>
          <button className="px-3 py-1.5 text-white/60 hover:text-white text-xs">
            Executions
          </button>
          <button className="px-3 py-1.5 text-white/60 hover:text-white text-xs">
            Evaluations
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative h-[calc(100vh-100px)] bg-white m-4 rounded-lg shadow-sm">
        
        {/* Grid dots background */}
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
            opacity: 0.5
          }}
        />

        {/* Section labels */}
        <div className="absolute top-8 left-[180px] text-xs text-gray-400">Retrieve</div>
        <div className="absolute top-8 left-[480px] text-xs text-gray-400">Code</div>
        <div className="absolute top-8 left-[780px] text-xs text-gray-400">AI Agent</div>

        {/* Nodes */}
        <div className="relative z-10">
          {/* Get Database */}
          <div className="absolute left-[100px] top-[80px]">
            <div className="bg-black text-white px-4 py-3 rounded-lg flex items-center gap-3 min-w-[240px]">
              <div className="p-2.5 bg-white/10 rounded-md">
                <Database className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <div className="font-medium text-[13px]">Get Database</div>
                <div className="text-[11px] opacity-70">getAll: databasePage</div>
              </div>
            </div>
          </div>

          {/* Update CRM */}
          <div className="absolute left-[400px] top-[80px]">
            <div className="bg-gray-700 text-white px-4 py-3 rounded-lg flex items-center gap-3 min-w-[240px]">
              <div className="p-2.5 bg-white/10 rounded-md">
                <Code className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="font-medium text-[13px]">Update CRM</div>
            </div>
          </div>

          {/* AI Agent 1 */}
          <div className="absolute left-[700px] top-[80px]">
            <div className="bg-black text-white px-4 py-3 rounded-lg flex items-center gap-3 min-w-[240px]">
              <div className="p-2.5 bg-white/10 rounded-md">
                <Bot className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <div className="font-medium text-[13px]">AI Agent 1</div>
                <div className="text-[11px] opacity-70">Tools Agent</div>
              </div>
            </div>
          </div>

          {/* If 1 */}
          <div className="absolute left-[1000px] top-[80px]">
            <div className="bg-gray-600 text-white px-4 py-3 rounded-lg flex items-center gap-3 min-w-[160px]">
              <div className="p-2.5 bg-white/10 rounded-md">
                <GitBranch className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="font-medium text-[13px]">If 1</div>
            </div>
          </div>

          {/* Memory */}
          <div className="absolute left-[1250px] top-[80px]">
            <div className="bg-gray-700 text-white px-4 py-3 rounded-lg flex items-center gap-3 min-w-[160px]">
              <div className="p-2.5 bg-white/10 rounded-md">
                <Edit3 className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="font-medium text-[13px]">Memory</div>
            </div>
          </div>

          {/* Claude */}
          <div className="absolute left-[550px] top-[250px]">
            <div className="bg-black text-white w-16 h-16 rounded-full flex items-center justify-center">
              <Bot className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <div className="text-center mt-2">
              <div className="text-xs font-medium">Claude Opus 4.0</div>
            </div>
          </div>

          {/* CRM Database */}
          <div className="absolute left-[700px] top-[250px]">
            <div className="bg-gray-800 text-white w-16 h-16 rounded-full flex items-center justify-center">
              <Database className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <div className="text-center mt-2">
              <div className="text-xs font-medium">CRM Database</div>
            </div>
          </div>

          {/* Telegram */}
          <div className="absolute left-[850px] top-[250px]">
            <div className="bg-gray-900 text-white w-16 h-16 rounded-full flex items-center justify-center">
              <MessageSquare className="w-7 h-7" strokeWidth={1.5} />
            </div>
            <div className="text-center mt-2">
              <div className="text-xs font-medium">Telegram</div>
              <div className="text-[10px] text-gray-500">mycoolmessage, messages</div>
            </div>
          </div>
        </div>

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
          {/* Solid connections */}
          <path d="M 340 100 Q 370 100 370 100 T 400 100" stroke="#D1D5DB" strokeWidth="2" fill="none" />
          <path d="M 640 100 Q 670 100 670 100 T 700 100" stroke="#D1D5DB" strokeWidth="2" fill="none" />
          <path d="M 940 100 Q 970 100 970 100 T 1000 100" stroke="#D1D5DB" strokeWidth="2" fill="none" />
          <path d="M 1160 100 Q 1205 100 1205 100 T 1250 100" stroke="#D1D5DB" strokeWidth="2" fill="none" />
          
          {/* Dotted connections */}
          <path d="M 520 120 Q 520 190 535 190 T 550 250" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="5,5" fill="none" />
          <path d="M 820 120 Q 820 190 775 190 T 730 250" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="5,5" fill="none" />
          <path d="M 820 120 Q 820 190 865 190 T 910 250" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="5,5" fill="none" />
        </svg>

        {/* Tags */}
        <div className="absolute left-[260px] top-[250px] px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
          Pablo
        </div>
        <div className="absolute right-[100px] top-[250px] px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
          Michael
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Ready</span>
          <button className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors">
            Execute Workflow
          </button>
        </div>
        <div className="text-sm text-gray-600">
          Nodes: 8 | Connections: 7
        </div>
      </div>
    </div>
  )
}