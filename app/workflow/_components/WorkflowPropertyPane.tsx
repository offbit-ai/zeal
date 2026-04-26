'use client'

import React from 'react'
import { PropertyPane } from '@/components/property-pane/PropertyPane'
import { useWorkflowUIStore } from '@/store/workflow-ui-store'

interface WorkflowPropertyPaneProps {
  handlePropertyPaneClose: () => void
}

/**
 * Property pane backdrop + slide-out panel. Open/close animation state and
 * the selected node id are read directly from useWorkflowUIStore so the
 * parent only needs to pass the close handler.
 */
export function WorkflowPropertyPane({ handlePropertyPaneClose }: WorkflowPropertyPaneProps) {
  const isPropertyPaneVisible = useWorkflowUIStore(s => s.isPropertyPaneVisible)
  const isPropertyPaneClosing = useWorkflowUIStore(s => s.isPropertyPaneClosing)
  const selectedNodeId = useWorkflowUIStore(s => s.selectedNodeId)

  if (!isPropertyPaneVisible) return null

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/20 transition-opacity duration-300 ${
          isPropertyPaneClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handlePropertyPaneClose}
      />
      <div className="fixed right-0 top-0 h-full z-55">
        <PropertyPane
          selectedNodeId={selectedNodeId}
          onClose={handlePropertyPaneClose}
          isClosing={isPropertyPaneClosing}
        />
      </div>
    </>
  )
}
