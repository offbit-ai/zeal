'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the workflow page to avoid SSR issues
const WorkflowPage = dynamic(() => import('@/app/workflow/page'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading embedded workflow...</p>
      </div>
    </div>
  ),
})

export default function EmbedPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const workflowId = params.id as string

  // Set up postMessage communication with parent window
  useEffect(() => {
    // Notify parent that workflow is ready
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'workflow-ready', workflowId }, '*')
    }

    // Listen for messages from parent
    const handleMessage = (event: MessageEvent) => {
      // In production, validate event.origin
      if (event.data.type === 'add-node') {
        // Handle node addition from parent
        const { node, position } = event.data
        // This would be handled by the workflow page
      } else if (event.data.type === 'force-crdt-sync') {
        // Force a CRDT sync by triggering a manual poll
        // This is handled by the workflow page's useCRDTPolling hook
        // We'll trigger it by sending a custom event
        window.dispatchEvent(new CustomEvent('force-crdt-sync', { 
          detail: { workflowId: event.data.workflowId }
        }))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [workflowId])

  // Pass embed mode to the workflow page
  // We'll modify the workflow page to detect embed mode and disable features accordingly
  return (
    <div className="w-full h-screen overflow-hidden">
      <WorkflowPage
        embedMode={true}
        embedWorkflowId={workflowId}
        // Optional: pass embed-specific settings via search params
        embedSettings={{
          showMinimap: searchParams.get('minimap') !== 'false',
          showZoomControls: searchParams.get('zoom') !== 'false',
          showSubgraphTabs: searchParams.get('tabs') !== 'false',
          allowNodeCreation: searchParams.get('allowCreate') !== 'false',
          // Enable collaborative mode if requested (for real-time updates)
          // But presence will still be disabled due to embedMode=true
          collaborative: searchParams.get('collaborative') === 'true',
          // Enable follow mode to auto-scroll to changes
          follow: searchParams.get('follow') === 'true',
        }}
      />
    </div>
  )
}
