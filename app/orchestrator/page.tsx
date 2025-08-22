'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import ChatInterface from '../../components/orchestrator/ChatInterface'
import EmbedView from '../../components/orchestrator/EmbedView'
import { cn } from '../../lib/utils'

export default function OrchestratorPage() {
  const searchParams = useSearchParams()
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [isChatCollapsed, setIsChatCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Get workflowId from URL if present
  useEffect(() => {
    const urlWorkflowId = searchParams.get('workflowId')
    if (urlWorkflowId) {
      setWorkflowId(urlWorkflowId)
    }
  }, [searchParams])

  const handleWorkflowCreated = (newWorkflowId: string) => {
    setWorkflowId(newWorkflowId)
    // Update URL without page refresh
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('workflowId', newWorkflowId)
    window.history.pushState({}, '', newUrl)
  }

  const toggleChatCollapse = () => {
    setIsChatCollapsed(!isChatCollapsed)
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Chat Interface */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out bg-white border-r border-gray-200 flex flex-col',
          isChatCollapsed ? 'w-16' : 'w-96'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {!isChatCollapsed && (
            <h1 className="text-xl font-semibold text-gray-900">Zeal Orchestrator</h1>
          )}
          <button
            onClick={toggleChatCollapse}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={isChatCollapsed ? 'Expand chat' : 'Collapse chat'}
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isChatCollapsed ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Always render ChatInterface to maintain state, just hide it visually when collapsed */}
        <div className={cn(
          "flex-1 overflow-hidden",
          isChatCollapsed && "hidden"
        )}>
          <ChatInterface
            workflowId={workflowId}
            onWorkflowCreated={handleWorkflowCreated}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        </div>
      </div>

      {/* Embed View */}
      <div className="flex-1 bg-gray-50">
        {workflowId ? (
          <EmbedView workflowId={workflowId} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No workflow selected</h3>
              <p className="mt-1 text-sm text-gray-500">
                Start a conversation to create a new workflow
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
