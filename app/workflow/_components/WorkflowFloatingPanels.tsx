'use client'

import React from 'react'
import { WorkflowSidebar } from '@/components/toolbar/WorkflowSidebar'
import { SearchButton } from '@/components/toolbar/SearchButton'
import { NodeBrowserButton } from '@/components/toolbar/NodeBrowserButton'
import { TriggerManager } from '@/components/TriggerManager'
import { UndoRedoButtons } from '@/components/toolbar/UndoRedoButtons'
import { WorkflowBottomToolbar } from '@/components/toolbar/WorkflowBottomToolbar'
import { Minimap } from '@/components/canvas/Minimap'
import { ZoomControls } from '@/components/canvas/ZoomControls'
import { SaveGraphButton } from '@/components/toolbar/SaveGraphButton'
import { useWorkflowUIStore } from '@/store/workflow-ui-store'
import { getNodeId } from '../_utils/node-id'

type Pos = { x: number; y: number }

interface ViewportSize {
  width: number
  height: number
}

interface EmbedSettings {
  showMinimap?: boolean
  showZoomControls?: boolean
}

interface WorkflowFloatingPanelsProps {
  embedMode: boolean
  embedSettings: EmbedSettings

  // Local-only state from parent
  viewportSize: ViewportSize
  storeNodes: any[]
  groups: any[]
  groupNodePositions: Record<string, Record<string, Pos>>
  localGroupCollapseState: Record<string, boolean>
  isSavingGraph: boolean

  // Handlers
  handleCategoryClick: (categoryId: string) => void
  handleNodeBrowserToggle: () => void
  handleCreateEmptyGroup: (canvasPosition: Pos) => void
  updateConfiguredEnvVars: () => Promise<void>
  handleZoomIn: () => void
  handleZoomOut: () => void
  handleZoomReset: () => void
  handleSaveGraph: () => void | Promise<void>
  getCurrentGraph: () => { name?: string; isDirty?: boolean } | null
}

/**
 * Renders the floating control surface that overlays the canvas:
 * sidebar, search/browser/trigger/undo/bottom toolbars, minimap,
 * zoom controls, save button, and the node browser panel.
 *
 * Reads UI state directly from useWorkflowUIStore to avoid prop drilling.
 */
export function WorkflowFloatingPanels({
  embedMode,
  embedSettings,
  viewportSize,
  storeNodes,
  groups,
  groupNodePositions,
  localGroupCollapseState,
  isSavingGraph,
  handleCategoryClick,
  handleNodeBrowserToggle,
  handleCreateEmptyGroup,
  updateConfiguredEnvVars,
  handleZoomIn,
  handleZoomOut,
  handleZoomReset,
  handleSaveGraph,
  getCurrentGraph,
}: WorkflowFloatingPanelsProps) {
  const isSidebarCollapsed = useWorkflowUIStore(s => s.isSidebarCollapsed)
  const isNodeBrowserOpen = useWorkflowUIStore(s => s.isNodeBrowserOpen)
  const setIsSearchOpen = useWorkflowUIStore(s => s.setIsSearchOpen)
  const setIsHistoryBrowserOpen = useWorkflowUIStore(s => s.setIsHistoryBrowserOpen)
  const setIsFlowTracerOpen = useWorkflowUIStore(s => s.setIsFlowTracerOpen)
  const setIsConfigOpen = useWorkflowUIStore(s => s.setIsConfigOpen)
  const setSelectedCategory = useWorkflowUIStore(s => s.setSelectedCategory)
  const setSearchModalInitialTab = useWorkflowUIStore(s => s.setSearchModalInitialTab)
  const canvasOffset = useWorkflowUIStore(s => s.canvasOffset)
  const setCanvasOffset = useWorkflowUIStore(s => s.setCanvasOffset)
  const canvasZoom = useWorkflowUIStore(s => s.canvasZoom)

  return (
    <>
      {!embedMode ? (
        <WorkflowSidebar isCollapsed={isSidebarCollapsed} onCategoryClick={handleCategoryClick} />
      ) : null}

      {!embedMode ? <SearchButton onClick={() => setIsSearchOpen(true)} /> : null}
      {!embedMode ? (
        <NodeBrowserButton onClick={handleNodeBrowserToggle} isActive={isNodeBrowserOpen} />
      ) : null}
      {!embedMode ? <TriggerManager /> : null}
      <UndoRedoButtons onUndo={() => {}} onRedo={() => {}} canUndo={false} canRedo={false} />
      {!embedMode ? (
        <WorkflowBottomToolbar
          onHistoryClick={() => setIsHistoryBrowserOpen(true)}
          onDebuggerClick={() => setIsFlowTracerOpen(true)}
          onCreateEmptyGroupClick={() => {
            const centerX = (-canvasOffset.x + viewportSize.width / 2) / canvasZoom
            const centerY = (-canvasOffset.y + viewportSize.height / 2) / canvasZoom
            handleCreateEmptyGroup({ x: centerX, y: centerY })
          }}
          onConfigClick={async () => {
            await updateConfiguredEnvVars()
            setIsConfigOpen(true)
          }}
          onAddSubgraphClick={() => {
            setSelectedCategory(null)
            setSearchModalInitialTab('subgraphs')
            setIsSearchOpen(true)
          }}
        />
      ) : null}

      {(!embedMode || embedSettings.showMinimap) && (
        <Minimap
          canvasOffset={canvasOffset}
          nodes={storeNodes.map((node: any) => {
            const nodeId = getNodeId(node)
            const parentGroup = groups.find((g: any) => g.nodeIds?.includes(nodeId))

            let visualPosition = node.position || { x: 0, y: 0 }
            if (parentGroup && groupNodePositions[parentGroup.id]?.[nodeId]) {
              const localPos = groupNodePositions[parentGroup.id][nodeId]
              const headerOffset = parentGroup.description ? 100 : 32
              visualPosition = {
                x: parentGroup.position.x + localPos.x,
                y: parentGroup.position.y + localPos.y + headerOffset,
              }
            }

            return {
              id: nodeId,
              position: visualPosition,
              size: { width: 200, height: 80 },
            }
          })}
          groups={groups.map((group: any) => ({
            id: group.id,
            position: group.position,
            size: group.size,
            color: group.color,
            collapsed: localGroupCollapseState[group.id] || false,
            title: group.title,
            nodeIds: group.nodeIds,
          }))}
          viewportSize={viewportSize}
          onViewportChange={setCanvasOffset}
        />
      )}

      {(!embedMode || embedSettings.showZoomControls) && (
        <ZoomControls
          zoom={canvasZoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
        />
      )}

      {!embedMode && (
        <SaveGraphButton
          isVisible={getCurrentGraph()?.isDirty || false}
          graphName={getCurrentGraph()?.name || ''}
          onSave={handleSaveGraph}
          isSaving={isSavingGraph}
        />
      )}
    </>
  )
}
