'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { Save, Upload, Play, Edit2, Check, X, Clock, Globe, Cable, RotateCcw } from 'lucide-react'
import { TabBar } from '@/components/toolbar/TabBar'
import { NotificationButton } from '@/components/toolbar/NotificationButton'
import { toast } from '@/lib/toast'
import { useWorkflowUIStore } from '@/store/workflow-ui-store'

const PresenceDropdown = dynamic(
  () => import('@/components/presence/PresenceDropdown').then(mod => mod.PresenceDropdown),
  { ssr: false, loading: () => null }
)

interface EmbedSettings {
  showSubgraphTabs?: boolean
}

interface WorkflowHeaderProps {
  embedMode: boolean
  embedSettings: EmbedSettings

  // Workflow data
  workflowName: string
  setWorkflowName: (name: string) => void
  workflowId?: string | null
  isCollaborative: boolean
  presence: any
  isOptimized: boolean
  localClientId: string | number | null | undefined
  graphs: Array<{ id: string; name: string; isMain?: boolean; isDirty?: boolean }>
  currentGraphId: string

  // Local state owned by parent (workflow-name editing & trigger)
  isEditingWorkflowName: boolean
  setIsEditingWorkflowName: (v: boolean) => void
  editedWorkflowName: string
  setEditedWorkflowName: (v: string) => void
  workflowTrigger: any

  // Selectors
  getCurrentGraph: () => { isMain?: boolean } | null

  // Handlers
  handleSaveWorkflow: () => void | Promise<void>
  handlePublishWorkflow: () => void | Promise<void>
  handleRunSimulation: () => void | Promise<void>
  handleTabSelect: (id: string) => void
  handleTabClose: (id: string) => void
  handleTabAdd: () => void
  handleTabRename: (id: string, name: string) => void
  handleSetMainTab: (id: string) => void
}

/**
 * Top header bar plus tab bar for the workflow editor.
 * Hides itself completely in embed mode (unless tabs are explicitly enabled).
 *
 * Reads autosave + user settings flags from useWorkflowUIStore directly.
 */
export function WorkflowHeader({
  embedMode,
  embedSettings,
  workflowName,
  setWorkflowName,
  workflowId,
  isCollaborative,
  presence,
  isOptimized,
  localClientId,
  graphs,
  currentGraphId,
  isEditingWorkflowName,
  setIsEditingWorkflowName,
  editedWorkflowName,
  setEditedWorkflowName,
  workflowTrigger,
  getCurrentGraph,
  handleSaveWorkflow,
  handlePublishWorkflow,
  handleRunSimulation,
  handleTabSelect,
  handleTabClose,
  handleTabAdd,
  handleTabRename,
  handleSetMainTab,
}: WorkflowHeaderProps) {
  const autosaveEnabled = useWorkflowUIStore(s => s.autosaveEnabled)
  const setAutosaveEnabled = useWorkflowUIStore(s => s.setAutosaveEnabled)
  const setIsUserSettingsOpen = useWorkflowUIStore(s => s.setIsUserSettingsOpen)

  const triggerLabel = (() => {
    if (!workflowTrigger) return ''
    if (workflowTrigger.type === 'rest') return 'HTTP'
    if (workflowTrigger.type === 'websocket') return 'WebSocket'
    if (workflowTrigger.type === 'scheduler') {
      const cfg = workflowTrigger.config as any
      if (cfg.isOneTime) return 'Once'
      if (cfg.interval) return `Every ${cfg.interval.value} ${cfg.interval.unit}`
      return 'Cron'
    }
    return 'Active'
  })()

  return (
    <>
      {/* Header - Hide in embed mode */}
      {!embedMode && (
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shadow-sm relative z-50">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-medium text-gray-900">Zeal</h1>
            <div className="flex items-center gap-2">
              {isEditingWorkflowName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedWorkflowName}
                    onChange={e => setEditedWorkflowName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setWorkflowName(editedWorkflowName)
                        setIsEditingWorkflowName(false)
                      } else if (e.key === 'Escape') {
                        setIsEditingWorkflowName(false)
                        setEditedWorkflowName(workflowName)
                      }
                    }}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setWorkflowName(editedWorkflowName)
                      setIsEditingWorkflowName(false)
                    }}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingWorkflowName(false)
                      setEditedWorkflowName(workflowName)
                    }}
                    className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <span className="text-sm text-gray-700 font-medium">{workflowName}</span>
                  <button
                    onClick={() => {
                      setIsEditingWorkflowName(true)
                      setEditedWorkflowName(workflowName)
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {workflowId && (
                <span className="text-xs text-gray-400">ID: {workflowId.slice(0, 8)}...</span>
              )}
              {workflowTrigger && getCurrentGraph()?.isMain && (
                <button
                  onClick={() => {
                    const triggerButton = document.querySelector(
                      '[title="Edit Trigger"]'
                    ) as HTMLButtonElement
                    if (triggerButton) triggerButton.click()
                  }}
                  className="flex items-center gap-2 px-3 py-1 bg-purple-100 hover:bg-purple-200 rounded-full transition-colors group"
                  title={`${workflowTrigger.name}: ${workflowTrigger.description || 'Click to edit trigger'}`}
                >
                  <span className="text-xs font-medium text-gray-600">Trigger</span>
                  <div className="w-px h-4 bg-purple-300" />
                  <div className="flex items-center gap-1.5">
                    {workflowTrigger.type === 'rest' ? (
                      <Globe className="w-3 h-3 text-blue-600" />
                    ) : workflowTrigger.type === 'websocket' ? (
                      <Cable className="w-3 h-3 text-green-600" />
                    ) : (
                      <Clock className="w-3 h-3 text-purple-600" />
                    )}
                    <span className="text-xs font-medium text-gray-700">{triggerLabel}</span>
                    <Edit2 className="w-3 h-3 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {!autosaveEnabled && (
                <button
                  onClick={handleSaveWorkflow}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
              )}
              <button
                onClick={() => !isCollaborative && setAutosaveEnabled(!autosaveEnabled)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border rounded-md ${
                  isCollaborative ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                } ${
                  autosaveEnabled
                    ? 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200'
                }`}
                title={
                  isCollaborative
                    ? 'Autosave is required in collaborative mode'
                    : autosaveEnabled
                      ? 'Autosave: ON - Click to disable'
                      : 'Autosave: OFF - Click to enable'
                }
                disabled={isCollaborative}
              >
                <RotateCcw className={`w-3 h-3 ${autosaveEnabled ? 'animate-spin' : ''}`} />
                {autosaveEnabled ? 'Autosave' : 'Manual'}
              </button>
            </div>
            <button
              onClick={handlePublishWorkflow}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Publish
            </button>
            <button
              onClick={handleRunSimulation}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Run
            </button>

            {isCollaborative && <NotificationButton />}

            {isCollaborative && (
              <PresenceDropdown
                presence={presence}
                isCollaborative={isCollaborative}
                isOptimized={isOptimized}
                localClientId={localClientId}
                workflowId={workflowId}
                onShare={async () => {
                  const shareUrl = workflowId
                    ? `${window.location.origin}/workflow?id=${workflowId}`
                    : ''
                  if (!shareUrl) return

                  try {
                    await navigator.clipboard.writeText(shareUrl)
                    toast.success('Share link copied to clipboard!')
                  } catch {
                    const textArea = document.createElement('textarea')
                    textArea.value = shareUrl
                    textArea.style.position = 'fixed'
                    textArea.style.opacity = '0'
                    document.body.appendChild(textArea)
                    textArea.select()

                    try {
                      document.execCommand('copy')
                      toast.success('Share link copied to clipboard!')
                    } catch {
                      toast.error('Failed to copy link')
                    }

                    document.body.removeChild(textArea)
                  }
                }}
                onUserSettings={() => setIsUserSettingsOpen(true)}
              />
            )}
          </div>
        </header>
      )}

      {/* Tab Bar - Show only if enabled in embed mode */}
      {(!embedMode || embedSettings.showSubgraphTabs) && (
        <TabBar
          tabs={graphs.map(g => ({
            id: g.id,
            name: g.name,
            isMain: g.isMain,
            isDirty: g.isDirty || false,
          }))}
          activeTabId={currentGraphId}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
          onTabAdd={handleTabAdd}
          onTabRename={handleTabRename}
          onSetMainTab={handleSetMainTab}
        />
      )}
    </>
  )
}
