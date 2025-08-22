'use client'

import { useEffect, useRef } from 'react'

interface EmbedViewProps {
  workflowId: string
}

export default function EmbedView({ workflowId }: EmbedViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    // Update iframe src when workflowId changes
    if (iframeRef.current && workflowId) {
      // Enable collaborative mode for real-time updates but keep presence disabled
      // Enable follow mode to auto-scroll to AI agent changes
      // Enable allowCreate so the orchestrator agent can create/modify nodes and autosave works
      const embedUrl = `/embed/${workflowId}?hideHeader=true&collaborative=true&follow=true&allowCreate=true`
      iframeRef.current.src = embedUrl
    }
  }, [workflowId])

  return (
    <div className="w-full h-full bg-gray-50 mt-4">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        title="Workflow Embed View"
        sandbox="allow-same-origin allow-scripts allow-forms"
      />
    </div>
  )
}
