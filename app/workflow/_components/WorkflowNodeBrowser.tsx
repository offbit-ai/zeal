'use client'

import React from 'react'
import { NodeBrowserPanel } from '@/components/panels/NodeBrowserPanel'
import { useWorkflowUIStore } from '@/store/workflow-ui-store'

interface WorkflowNodeBrowserProps {
  embedMode: boolean
  handleNodeBrowserToggle: () => void
  handleNodeSelectFromBrowser: (nodeId: string, position: { x: number; y: number }) => void
  handleNodeAdded: (node: any) => void
}

/**
 * Backdrop scrim + slide-in NodeBrowserPanel for workflow editing.
 * Hidden in embed mode.
 */
export function WorkflowNodeBrowser({
  embedMode,
  handleNodeBrowserToggle,
  handleNodeSelectFromBrowser,
  handleNodeAdded,
}: WorkflowNodeBrowserProps) {
  const isNodeBrowserOpen = useWorkflowUIStore(s => s.isNodeBrowserOpen)
  const setIsGroupCreationModalOpen = useWorkflowUIStore(s => s.setIsGroupCreationModalOpen)

  if (embedMode) return null

  return (
    <>
      {isNodeBrowserOpen && (
        <div className="fixed inset-0 z-10" onClick={handleNodeBrowserToggle} />
      )}
      <NodeBrowserPanel
        isExpanded={isNodeBrowserOpen}
        onNodeSelect={handleNodeSelectFromBrowser}
        onNodeAdded={handleNodeAdded}
        onGroupCreationRequest={() => setIsGroupCreationModalOpen(true)}
      />
    </>
  )
}
