'use client'

import React from 'react'
import { ToastManager } from '@/components/ui/Toast'
import { ModalPortal } from '@/components/modals/ModalPortal'
import { SearchModal } from '@/components/modals/SearchModal'
import { DeleteConnectionDialog } from '@/components/modals/DeleteConnectionDialog'
import { UnsavedChangesDialog } from '@/components/modals/UnsavedChangesDialog'
import { GroupCreationModal } from '@/components/modals/GroupCreationModal'
import { EmptyGroupCreationModal } from '@/components/modals/EmptyGroupCreationModal'
import { GroupEditModal } from '@/components/modals/GroupEditModal'
import { GroupDeleteModal } from '@/components/modals/GroupDeleteModal'
import { UserSettingsModal } from '@/components/modals/UserSettingsModal'
import { HistoryBrowser } from '@/components/trace/HistoryBrowser'
import { FlowTracer } from '@/components/trace/FlowTracer'
import { Configuration } from '@/components/panels/Configuration'
import { MissingEnvVarWarning } from '@/components/property-pane/MissingEnvVarWarning'
import { ConfigurationToast } from '@/components/ui/ConfigurationToast'
import { SelectionContextMenu } from '@/components/canvas/SelectionContextMenu'
import { NotificationPanel } from '@/components/panels/NotificationPanel'
import { useWorkflowUIStore } from '@/store/workflow-ui-store'
import { useEnvVarStore } from '@/store/envVarStore'

interface UnsavedChangesDialogState {
  isOpen: boolean
  graphName?: string
}

interface SelectionState {
  selectedNodeIds: string[]
}

interface ViewportSize {
  width: number
  height: number
}

interface WorkflowModalsLayerProps {
  // Local state still owned by parent
  deleteDialogOpen: boolean
  unsavedChangesDialog: UnsavedChangesDialogState
  viewportSize: ViewportSize
  selection: SelectionState

  // Workflow data
  storeNodes: any[]
  groups: any[]
  workflowId?: string | null
  isCollaborative: boolean

  // Handlers
  handleNodeAdded: (node: any) => void
  handleDeleteConnection: () => void
  handleCancelDelete: () => void
  handleUnsavedChangesSave: () => void
  handleUnsavedChangesDiscard: () => void
  handleUnsavedChangesCancel: () => void
  handleLoadWorkflow: (workflowId: string) => void
  handleVariableConfigured: () => void
  handleDismissEnvVarWarning: () => void
  handleOpenConfigFromWarning: () => void
  handleNodeSelect: (nodeId: string) => void
  handleGroupCreationConfirm: (title: string, description: string) => void
  handleGroupCreationCancel: () => void
  handleEmptyGroupCreationConfirm: (
    title: string,
    description: string,
    position: { x: number; y: number }
  ) => void
  handleEmptyGroupCreationCancel: () => void
  handleContextMenuCreateGroup: () => void
  handleSelectionContextMenuClose: () => void
  handleGroupEditConfirm: (groupId: string, title: string, description: string) => void
  handleGroupEditCancel: () => void
  handleGroupDeleteConfirm: (groupId: string, preserveNodes: boolean) => void
  handleGroupDeleteCancel: () => void
}

/**
 * Renders all modal/dialog/toast overlays for the workflow editor.
 * Pulls open/closed state and node-id selectors directly from
 * useWorkflowUIStore so the parent doesn't need to wire them up.
 */
export function WorkflowModalsLayer({
  deleteDialogOpen,
  unsavedChangesDialog,
  viewportSize,
  selection,
  storeNodes,
  groups,
  workflowId,
  isCollaborative,
  handleNodeAdded,
  handleDeleteConnection,
  handleCancelDelete,
  handleUnsavedChangesSave,
  handleUnsavedChangesDiscard,
  handleUnsavedChangesCancel,
  handleLoadWorkflow,
  handleVariableConfigured,
  handleDismissEnvVarWarning,
  handleOpenConfigFromWarning,
  handleNodeSelect,
  handleGroupCreationConfirm,
  handleGroupCreationCancel,
  handleEmptyGroupCreationConfirm,
  handleEmptyGroupCreationCancel,
  handleContextMenuCreateGroup,
  handleSelectionContextMenuClose,
  handleGroupEditConfirm,
  handleGroupEditCancel,
  handleGroupDeleteConfirm,
  handleGroupDeleteCancel,
}: WorkflowModalsLayerProps) {
  // Pull all UI flags from the store directly — no prop drilling.
  const isSearchOpen = useWorkflowUIStore(s => s.isSearchOpen)
  const setIsSearchOpen = useWorkflowUIStore(s => s.setIsSearchOpen)
  const selectedCategory = useWorkflowUIStore(s => s.selectedCategory)
  const setSelectedCategory = useWorkflowUIStore(s => s.setSelectedCategory)
  const searchModalInitialTab = useWorkflowUIStore(s => s.searchModalInitialTab)
  const setSearchModalInitialTab = useWorkflowUIStore(s => s.setSearchModalInitialTab)
  const canvasOffset = useWorkflowUIStore(s => s.canvasOffset)
  const setCanvasOffset = useWorkflowUIStore(s => s.setCanvasOffset)
  const canvasZoom = useWorkflowUIStore(s => s.canvasZoom)
  const setHighlightedNodeId = useWorkflowUIStore(s => s.setHighlightedNodeId)

  const isHistoryBrowserOpen = useWorkflowUIStore(s => s.isHistoryBrowserOpen)
  const setIsHistoryBrowserOpen = useWorkflowUIStore(s => s.setIsHistoryBrowserOpen)
  const isFlowTracerOpen = useWorkflowUIStore(s => s.isFlowTracerOpen)
  const setIsFlowTracerOpen = useWorkflowUIStore(s => s.setIsFlowTracerOpen)
  const isConfigOpen = useWorkflowUIStore(s => s.isConfigOpen)
  const setIsConfigOpen = useWorkflowUIStore(s => s.setIsConfigOpen)

  const showEnvVarWarning = useWorkflowUIStore(s => s.showEnvVarWarning)
  const missingEnvVars = useEnvVarStore(state => state.missingVars)

  const configurationToastNodeId = useWorkflowUIStore(s => s.configurationToastNodeId)
  const setConfigurationToastNodeId = useWorkflowUIStore(s => s.setConfigurationToastNodeId)

  const isGroupCreationModalOpen = useWorkflowUIStore(s => s.isGroupCreationModalOpen)
  const isEmptyGroupModalOpen = useWorkflowUIStore(s => s.isEmptyGroupModalOpen)
  const emptyGroupPosition = useWorkflowUIStore(s => s.emptyGroupPosition)
  const selectionContextMenu = useWorkflowUIStore(s => s.selectionContextMenu)

  const editingGroupId = useWorkflowUIStore(s => s.editingGroupId)
  const deletingGroupId = useWorkflowUIStore(s => s.deletingGroupId)

  const isUserSettingsOpen = useWorkflowUIStore(s => s.isUserSettingsOpen)
  const setIsUserSettingsOpen = useWorkflowUIStore(s => s.setIsUserSettingsOpen)
  const userName = useWorkflowUIStore(s => s.userName)
  const setUserName = useWorkflowUIStore(s => s.setUserName)

  return (
    <>
      {/* Search Modal */}
      <ModalPortal isOpen={isSearchOpen}>
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => {
            setIsSearchOpen(false)
            setSelectedCategory(null)
            setSearchModalInitialTab(undefined)
          }}
          initialCategory={selectedCategory}
          initialTab={searchModalInitialTab}
          onNodeAdded={handleNodeAdded}
          canvasOffset={canvasOffset}
          canvasZoom={canvasZoom}
          viewportSize={viewportSize}
          onCanvasOffsetChange={setCanvasOffset}
          onHighlightNode={setHighlightedNodeId}
        />
      </ModalPortal>

      {/* Delete Connection Dialog */}
      <ModalPortal isOpen={deleteDialogOpen}>
        <DeleteConnectionDialog
          isOpen={deleteDialogOpen}
          onConfirm={handleDeleteConnection}
          onCancel={handleCancelDelete}
        />
      </ModalPortal>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={unsavedChangesDialog.isOpen}
        onSave={handleUnsavedChangesSave}
        onDiscard={handleUnsavedChangesDiscard}
        onCancel={handleUnsavedChangesCancel}
        graphName={unsavedChangesDialog.graphName}
      />

      {/* History Browser */}
      <HistoryBrowser
        isOpen={isHistoryBrowserOpen}
        onClose={() => setIsHistoryBrowserOpen(false)}
        onSelectWorkflow={handleLoadWorkflow}
        onViewFlowTrace={wid => {
          setIsHistoryBrowserOpen(false)
          setIsFlowTracerOpen(true)
          ToastManager.info(`Viewing flow traces for workflow ${wid}`)
        }}
        currentWorkflowId={workflowId}
      />

      {/* Flow Tracer */}
      <FlowTracer isOpen={isFlowTracerOpen} onClose={() => setIsFlowTracerOpen(false)} />

      {/* Configuration */}
      <Configuration
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onVariableConfigured={handleVariableConfigured}
      />

      {/* Missing Environment Variables Warning */}
      {showEnvVarWarning && missingEnvVars.length > 0 && (
        <MissingEnvVarWarning
          missingVars={missingEnvVars}
          onDismiss={handleDismissEnvVarWarning}
          onOpenConfig={handleOpenConfigFromWarning}
        />
      )}

      {/* Configuration Toast */}
      {configurationToastNodeId &&
        (() => {
          const node = storeNodes.find(
            (n: any) => (n.id || n.metadata.id) === configurationToastNodeId
          )
          return node ? (
            <ConfigurationToast
              nodeMetadata={node.metadata}
              onConfigure={() => {
                setConfigurationToastNodeId(null)
                handleNodeSelect(configurationToastNodeId)
              }}
              onDismiss={() => setConfigurationToastNodeId(null)}
            />
          ) : null
        })()}

      {/* Group Creation Modal */}
      <GroupCreationModal
        isOpen={isGroupCreationModalOpen}
        selectedNodeCount={selection.selectedNodeIds.length}
        selectedNodeNames={selection.selectedNodeIds.map((id: any) => {
          const node = storeNodes.find((n: any) => (n.id || n.metadata.id) === id)
          return node ? node.metadata.title : 'Unknown'
        })}
        onConfirm={handleGroupCreationConfirm}
        onCancel={handleGroupCreationCancel}
      />

      {/* Empty Group Creation Modal */}
      <EmptyGroupCreationModal
        isOpen={isEmptyGroupModalOpen}
        position={emptyGroupPosition}
        onConfirm={handleEmptyGroupCreationConfirm}
        onCancel={handleEmptyGroupCreationCancel}
      />

      {/* Selection Context Menu */}
      <SelectionContextMenu
        isVisible={selectionContextMenu.isVisible}
        position={selectionContextMenu.position}
        selectedNodeCount={selection.selectedNodeIds.length}
        onCreateGroup={handleContextMenuCreateGroup}
        onClose={handleSelectionContextMenuClose}
      />

      {/* Group Edit Modal */}
      {editingGroupId &&
        (() => {
          const editingGroup = groups.find((g: any) => g.id === editingGroupId)
          if (!editingGroup) return null

          return (
            <GroupEditModal
              isOpen={true}
              groupId={editingGroupId}
              currentTitle={editingGroup.title}
              currentDescription={editingGroup.description || ''}
              onConfirm={handleGroupEditConfirm}
              onCancel={handleGroupEditCancel}
            />
          )
        })()}

      {/* Group Delete Modal */}
      {deletingGroupId &&
        (() => {
          const deletingGroup = groups.find((g: any) => g.id === deletingGroupId)
          if (!deletingGroup) return null

          return (
            <GroupDeleteModal
              isOpen={true}
              groupId={deletingGroupId}
              groupTitle={deletingGroup.title}
              nodeCount={deletingGroup.nodeIds.length}
              onConfirm={handleGroupDeleteConfirm}
              onCancel={handleGroupDeleteCancel}
            />
          )
        })()}

      {/* User Settings Modal */}
      <UserSettingsModal
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
        onSave={(newUserName, userColor) => {
          setUserName(newUserName)
          setIsUserSettingsOpen(false)

          const store = (window as any).__zealStore
          if (store && typeof store === 'function') {
            if (isCollaborative && (store as any).updatePresence) {
              ;(store as any).updatePresence({
                userId: sessionStorage.getItem('userId') || 'anonymous',
                userName,
                userColor,
              })
            }
          }
        }}
      />

      {/* Notification Panel - only in collaborative mode */}
      {isCollaborative && <NotificationPanel />}
    </>
  )
}
