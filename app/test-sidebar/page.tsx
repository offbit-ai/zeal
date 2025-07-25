'use client'

import { useState } from 'react'
import { 
  Database, 
  Code, 
  Bot, 
  GitBranch, 
  MessageSquare, 
  Edit3,
  Calendar,
  Mail,
  FileText,
  Settings,
  Zap,
  Globe,
  Play,
  Save,
  Upload
} from 'lucide-react'
import { WorkflowSidebar } from '@/components/WorkflowSidebar'
import { WorkflowBottomToolbar } from '@/components/WorkflowBottomToolbar'
import { SearchButton } from '@/components/SearchButton'
import { UndoRedoButtons } from '@/components/UndoRedoButtons'
import { SearchModal } from '@/components/SearchModal'

export default function TestSidebar() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  
  const categories = [
    {
      title: "Core",
      items: [
        {
          id: "start",
          title: "Start",
          icon: Zap,
          description: "Trigger point"
        },
        {
          id: "schedule",
          title: "Schedule Trigger",
          icon: Calendar,
          description: "Time-based trigger"
        }
      ]
    },
    {
      title: "Data",
      items: [
        {
          id: "database",
          title: "Database",
          icon: Database,
          description: "Query database"
        },
        {
          id: "webhook",
          title: "Webhook", 
          icon: Globe,
          description: "HTTP requests"
        }
      ]
    },
    {
      title: "Logic",
      items: [
        {
          id: "if",
          title: "IF",
          icon: GitBranch,
          description: "Conditional logic"
        },
        {
          id: "code",
          title: "Code",
          icon: Code,
          description: "Run JavaScript"
        }
      ]
    },
    {
      title: "Communication",
      items: [
        {
          id: "email",
          title: "Email",
          icon: Mail,
          description: "Send emails"
        },
        {
          id: "telegram",
          title: "Telegram",
          icon: MessageSquare,
          description: "Send messages"
        }
      ]
    },
    {
      title: "AI",
      items: [
        {
          id: "ai-agent",
          title: "AI Agent",
          icon: Bot,
          description: "LLM integration"
        },
        {
          id: "memory",
          title: "Memory",
          icon: Edit3,
          description: "Store context"
        }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <span className="font-medium text-gray-900">Zeal</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
            onClick={() => console.log('Save workflow')}
          >
            <Save className="w-3 h-3" strokeWidth={1.5} />
            Save
          </button>
          
          <button 
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
            onClick={() => console.log('Publish workflow')}
          >
            <Upload className="w-3 h-3" strokeWidth={1.5} />
            Publish
          </button>
          
          <button 
            className="flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded text-xs font-medium hover:bg-gray-800 transition-colors"
            onClick={() => console.log('Run workflow')}
          >
            <Play className="w-3 h-3" strokeWidth={1.5} />
            Run
          </button>
        </div>
      </div>

      {/* Canvas area - full width with floating sidebar and toolbar */}
      <div className="relative h-[calc(100vh-60px)] bg-gray-100">
        {/* Grid pattern background */}
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `
              radial-gradient(circle, #d1d5db 1px, transparent 1px),
              linear-gradient(90deg, #f3f4f6 1px, transparent 1px),
              linear-gradient(#f3f4f6 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px, 20px 20px, 20px 20px',
            opacity: 0.7
          }}
        />
        
        {/* Search button */}
        <SearchButton onClick={() => setIsSearchOpen(true)} />
        
        {/* Undo/Redo buttons */}
        <UndoRedoButtons 
          onUndo={() => console.log('Undo')}
          onRedo={() => console.log('Redo')}
          canUndo={true}
          canRedo={false}
        />
        
        {/* Floating collapsed sidebar */}
        <WorkflowSidebar categories={categories} isCollapsed={true} />

        {/* Floating bottom toolbar */}
        <WorkflowBottomToolbar 
          onHistoryClick={() => console.log('Open history')}
          onDebuggerClick={() => console.log('Open flow trace debugger')}
        />
      </div>
      
      {/* Search Modal */}
      <SearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />
    </div>
  )
}