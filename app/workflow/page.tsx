'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import * as Y from 'yjs'
import { InteractiveCanvas } from '@/components/InteractiveCanvas'
import { WorkflowSidebar } from '@/components/WorkflowSidebar'
import { WorkflowBottomToolbar } from '@/components/WorkflowBottomToolbar'
import { SearchButton } from '@/components/SearchButton'
import { NodeBrowserButton } from '@/components/NodeBrowserButton'
import { TriggerManager } from '@/components/TriggerManager'
import { UndoRedoButtons } from '@/components/UndoRedoButtons'
import { SearchModal } from '@/components/SearchModal'
import { NodeBrowserPanel } from '@/components/NodeBrowserPanel'
import { HistoryBrowser } from '@/components/HistoryBrowser'
import { FlowTracer } from '@/components/FlowTracer'
import { Configuration } from '@/components/Configuration'
import { MissingEnvVarWarning } from '@/components/MissingEnvVarWarning'
import { EnvVarService } from '@/services/envVarService'
import { useEnvVarStore } from '@/store/envVarStore'
import { DraggableNode } from '@/components/DraggableNode'
import { Minimap } from '@/components/Minimap'
import { ZoomControls } from '@/components/ZoomControls'
import { Save, Upload, Play, Edit2, Check, X, Clock, Globe, Cable, RotateCcw } from 'lucide-react'
import { ToastManager } from '@/components/Toast'
import dynamic from 'next/dynamic'
import { simulatePublishedWorkflows } from '@/utils/simulatePublishedWorkflows'
import type { NodeMetadata, Connection } from '@/types/workflow'
import { Database, Code, Bot, Cloud, Zap, GitBranch, Shuffle } from 'lucide-react'
import { useNodeBounds } from '@/hooks/useNodeBounds'
import { usePortPositions } from '@/hooks/usePortPositions'
import { useConnectionDrag } from '@/hooks/useConnectionDrag'
import { ConnectionLines } from '@/components/ConnectionLines'

// Utility function to get consistent node ID
const getNodeId = (node: any): string => {
  return node?.id || node?.metadata?.id || ''
}
import { DragConnectionLine } from '@/components/DragConnectionLine'
import { DeleteConnectionDialog } from '@/components/DeleteConnectionDialog'
import { PropertyPane } from '@/components/PropertyPane'
import { ModalPortal } from '@/components/ModalPortal'
import { ConfigurationToast } from '@/components/ConfigurationToast'
import { NodeGroupContainer } from '@/components/NodeGroupContainer'
import { SelectionRectangle } from '@/components/SelectionRectangle'
import { SelectionContextMenu } from '@/components/SelectionContextMenu'
import { GroupCreationModal } from '@/components/GroupCreationModal'
import { EmptyGroupCreationModal } from '@/components/EmptyGroupCreationModal'
import { GroupEditModal } from '@/components/GroupEditModal'
import { GroupDeleteModal } from '@/components/GroupDeleteModal'
import {
  useWorkflowStore,
  usePresence,
  useWorkflowData,
  useConnectionStatus,
} from '@/store/workflow-store'
import { WorkflowStorageService } from '@/services/workflowStorage'
import { hasUnconfiguredDefaults } from '@/utils/nodeConfigurationStatus'
import { TabBar } from '@/components/TabBar'
import { SubgraphNode } from '@/components/SubgraphNode'
import {
  createWorkflowSnapshot,
  createWorkflowGraph,
  restoreWorkflowFromSnapshot,
  restoreGraphFromSerialized,
} from '@/utils/workflowSerializer'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import { SaveGraphButton } from '@/components/SaveGraphButton'
import { toast } from '@/lib/toast'
const PresenceDropdown = dynamic(
  () => import('@/components/PresenceDropdown').then(mod => mod.PresenceDropdown),
  {
    ssr: false,
    loading: () => null,
  }
)
import { UserSettingsModal } from '@/components/UserSettingsModal'
import { CollaborativeCursors } from '@/components/CollaborativeCursors'
// const CRDTFeatureIndicator = dynamic(
//   () => import('@/components/CRDTFeatureIndicator').then(mod => mod.CRDTFeatureIndicator),
//   {
//     ssr: false,
//     loading: () => null,
//   }
// )
// import { GraphDebugPanel } from '@/components/GraphDebugPanel'
import { UserPreferencesService } from '@/services/userPreferences'
import { NotificationButton } from '@/components/NotificationButton'
import { NotificationPanel } from '@/components/NotificationPanel'
// import { TestNotifications } from '@/components/TestNotifications'
import { CollapsedGroupPortHandler } from '@/components/CollapsedGroupPortHandler'

// Memoized component for rendering nodes within a group
const GroupNodes = React.memo(
  ({
    group,
    groupNodes,
    groupNodePositions,
    readyGroupContainers,
    newlyCreatedGroups,
    canvasZoom,
    handleNodePositionInGroup,
    updateNodeBoundsHook,
    oldUpdatePortPosition,
    handlePortDragStart,
    handlePortDragEnd,
    handleNodeSelect,
    isNodeSelected,
    handleNodeDropIntoGroup,
    handleNodeHoverGroup,
    groups,
    handleNodePropertyChange,
    handleNodeDragStart,
    handleNodeDragEnd,
    highlightedNodeId,
    updateGroup,
    setGraphDirty,
    currentGraphId,
    getNodeId,
  }: any) => {
    // Render if container is ready or for newly created groups  
    const canRender = readyGroupContainers.has(group.id) || 
                     newlyCreatedGroups.has(group.id)
    
    if (!canRender) return null

    return (
      <>
        {groupNodes.map((node: any) => {
          if (!node || !node.metadata) return null

          const nodeId = getNodeId(node)
          if (!nodeId) return null

          // Calculate relative position locally
          const storedPosition = group.nodePositions?.[nodeId]
          const localPos = groupNodePositions[group.id]?.[nodeId]

          const relativePosition =
            localPos ||
            storedPosition ||
            (() => {
              const nodePos = node.position || {
                x: group.position?.x + 50,
                y: group.position?.y + 50,
              }
              const groupPos = group.position || { x: 100, y: 100 }
              const headerOffset = group.description ? 100 : 32

              return {
                x: nodePos.x - groupPos.x,
                y: nodePos.y - groupPos.y - headerOffset,
              }
            })()

          if (node.metadata.type === 'subgraph') {
            return (
              <SubgraphNode
                key={`group-${group.id}-node-${nodeId}`}
                metadata={node.metadata as any}
                position={relativePosition}
                onPositionChange={(nodeId, position) => {
                  handleNodePositionInGroup(nodeId, group.id, position)
                }}
                onBoundsChange={(nodeId, bounds) => {
                  updateNodeBoundsHook(nodeId, bounds)
                }}
                onPortPositionUpdate={oldUpdatePortPosition}
                onPortDragStart={handlePortDragStart}
                onPortDragEnd={handlePortDragEnd}
                onClick={() => handleNodeSelect(nodeId)}
                isHighlighted={node.metadata.id === highlightedNodeId}
                isNodeSelected={isNodeSelected(node.metadata.id)}
                zoom={canvasZoom}
                isInGroup={true}
              />
            )
          }

          return (
            <DraggableNode
              key={`group-${group.id}-node-${nodeId}`}
              nodeId={nodeId}
              metadata={node.metadata}
              propertyValues={node.propertyValues}
              position={relativePosition}
              zoom={canvasZoom}
              onPositionChange={(nodeId, position) => {
                handleNodePositionInGroup(nodeId, group.id, position)
              }}
              onBoundsChange={(nodeId, bounds) => {
                updateNodeBoundsHook(nodeId, bounds)
              }}
              onPortPositionUpdate={oldUpdatePortPosition}
              onPortDragStart={handlePortDragStart}
              onPortDragEnd={handlePortDragEnd}
              onClick={handleNodeSelect}
              isHighlighted={node.metadata.id === highlightedNodeId}
              isSelected={isNodeSelected(node.metadata.id)}
              onNodeDropIntoGroup={handleNodeDropIntoGroup}
              onNodeHoverGroup={handleNodeHoverGroup}
              groups={groups}
              isInGroup={true}
              currentGroup={group}
              onPropertyChange={handleNodePropertyChange}
              onDragStart={handleNodeDragStart}
              onDragEnd={handleNodeDragEnd}
              onNodeNearGroupBoundary={(nodeId, groupId, action, value) => {
                // Group resize should be local-only, don't update CRDT during node drag resize
                // This prevents flickering during group resize operations
              }}
            />
          )
        })}
      </>
    )
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    // Only re-render if the group or its nodes actually changed
    
    // Check if group identity changed
    if (prevProps.group?.id !== nextProps.group?.id) return false
    
    // Check if group nodes array changed
    if (prevProps.groupNodes?.length !== nextProps.groupNodes?.length) return false
    
    // Check if any node metadata changed (simplified check)
    const prevNodeIds = prevProps.groupNodes?.map((n: any) => n?.metadata?.id).join(',') || ''
    const nextNodeIds = nextProps.groupNodes?.map((n: any) => n?.metadata?.id).join(',') || ''
    if (prevNodeIds !== nextNodeIds) return false
    
    // Check if individual node properties changed (check if any node data changed)
    for (let i = 0; i < prevProps.groupNodes?.length || 0; i++) {
      const prevNode = prevProps.groupNodes?.[i]
      const nextNode = nextProps.groupNodes?.[i]
      
      // Check if node property values changed
      if (JSON.stringify(prevNode?.propertyValues) !== JSON.stringify(nextNode?.propertyValues)) return false
      
      // Check if node position changed
      if (prevNode?.position?.x !== nextNode?.position?.x || 
          prevNode?.position?.y !== nextNode?.position?.y) return false
    }
    
    // Check if group positions changed
    if (JSON.stringify(prevProps.groupNodePositions?.[prevProps.group?.id]) !== 
        JSON.stringify(nextProps.groupNodePositions?.[nextProps.group?.id])) return false
    
    // Check if container ready state changed
    if (prevProps.readyGroupContainers?.has(prevProps.group?.id) !== 
        nextProps.readyGroupContainers?.has(nextProps.group?.id)) return false
    
    // Check if newly created state changed
    if (prevProps.newlyCreatedGroups?.has(prevProps.group?.id) !== 
        nextProps.newlyCreatedGroups?.has(nextProps.group?.id)) return false
    
    // Check if zoom changed
    if (prevProps.canvasZoom !== nextProps.canvasZoom) return false
    
    // Check if highlighted node changed
    if (prevProps.highlightedNodeId !== nextProps.highlightedNodeId) return false
    
    // Check if current graph changed
    if (prevProps.currentGraphId !== nextProps.currentGraphId) return false
    
    // NOTE: We don't check function props (handlers) as they should be memoized with useCallback
    // If function props cause re-renders, the issue is that they're not properly memoized
    
    // All relevant props are the same, skip re-render
    return true
  }
)

GroupNodes.displayName = 'GroupNodes'

// Memoized component for ungrouped nodes
const UngroupedNodes = React.memo(
  ({
    storeNodes,
    groups,
    initialized,
    // ... all other props needed for DraggableNode
    handlePortDragStart,
    handlePortDragEnd,
    handleNodeSelect,
    isNodeSelected,
    handleNodeDropIntoGroup,
    handleNodeHoverGroup,
    canvasZoom,
    handleNodePositionChange,
    handleNodePropertyChange,
    handleNodeDragStart,
    handleNodeDragEnd,
    highlightedNodeId,
    getNodeId,
    updateNodeBoundsHook,
    oldUpdatePortPosition,
  }: any) => {
    // Wait for groups to be fully loaded before filtering ungrouped nodes
    const groupsFullyLoaded =
      groups.length === 0 ||
      groups.every((g: any) => {
        if (!g.nodeIds?.length) return true
        return g.nodePositions && Object.keys(g.nodePositions).length >= g.nodeIds.length
      })

    if (!initialized || !groupsFullyLoaded) {
      return null
    }

    const ungroupedNodes =
      storeNodes?.filter((node: any) => {
        const nodeId = getNodeId(node)
        const inAnyGroup = groups.some((group: any) => group.nodeIds.includes(nodeId))
        return !inAnyGroup
      }) || []

    return (
      <>
        {ungroupedNodes.map((node: any) => {
          if (!node || !node.metadata) return null
          const nodeId = getNodeId(node)

          // Check if this is a subgraph node
          if (node.metadata.type === 'subgraph') {
            return (
              <SubgraphNode
                key={nodeId}
                metadata={node.metadata as any}
                position={node.position}
                onPositionChange={handleNodePositionChange}
                onBoundsChange={updateNodeBoundsHook}
                onPortPositionUpdate={oldUpdatePortPosition}
                onPortDragStart={handlePortDragStart}
                onPortDragEnd={handlePortDragEnd}
                onClick={() => handleNodeSelect(nodeId)}
                isHighlighted={nodeId === highlightedNodeId}
                isNodeSelected={isNodeSelected(nodeId)}
                zoom={canvasZoom}
              />
            )
          }

          return (
            <DraggableNode
              key={nodeId}
              nodeId={nodeId}
              metadata={node.metadata}
              propertyValues={node.propertyValues}
              position={node.position}
              zoom={canvasZoom}
              onPositionChange={handleNodePositionChange}
              onBoundsChange={updateNodeBoundsHook}
              onPortPositionUpdate={oldUpdatePortPosition}
              onPortDragStart={handlePortDragStart}
              onPortDragEnd={handlePortDragEnd}
              onClick={handleNodeSelect}
              isHighlighted={nodeId === highlightedNodeId}
              isSelected={isNodeSelected(nodeId)}
              onNodeDropIntoGroup={handleNodeDropIntoGroup}
              onNodeHoverGroup={handleNodeHoverGroup}
              groups={groups}
              onPropertyChange={handleNodePropertyChange}
              onDragStart={handleNodeDragStart}
              onDragEnd={handleNodeDragEnd}
            />
          )
        })}
      </>
    )
  },
  () => false // Temporarily disable memoization to debug issues
)

UngroupedNodes.displayName = 'UngroupedNodes'
 // Collaborative features are always enabled with the new store
  const isCollaborative = true

export default function Home() {
  // Parse URL parameters to get shared workflow ID
  const [urlWorkflowId, setUrlWorkflowId] = useState<string | null>(null)

  useEffect(() => {
    // Parse URL parameters on client side only
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const sharedId = params.get('id')
      // [CRDT] URL parameter parsing

      if (sharedId) {
        // Found shared workflow ID from URL
        setUrlWorkflowId(sharedId)

        // Update the URL to ensure it stays consistent
        const currentUrl = new URL(window.location.href)
        if (currentUrl.searchParams.get('id') !== sharedId) {
          currentUrl.searchParams.set('id', sharedId)
          window.history.replaceState({}, '', currentUrl.toString())
        }
      } else {
        // [CRDT] No shared workflow ID found in URL
      }
    }
  }, [])

  const canvasRef = useRef<HTMLDivElement>(null)
  const creatingWorkflow = useRef(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNodeBrowserOpen, setIsNodeBrowserOpen] = useState(false)
  const [isHistoryBrowserOpen, setIsHistoryBrowserOpen] = useState(false)
  const [isFlowTracerOpen, setIsFlowTracerOpen] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [showEnvVarWarning, setShowEnvVarWarning] = useState(false)
  const missingEnvVars = useEnvVarStore(state => state.missingVars)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchModalInitialTab, setSearchModalInitialTab] = useState<
    'repository' | 'custom' | 'subgraphs' | undefined
  >(undefined)
  const [autosaveEnabled, setAutosaveEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [userName, setUserName] = useState('Anonymous')
  const [loadingMessage, setLoadingMessage] = useState('Initializing workflow...')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const [isPropertyPaneOpen, setIsPropertyPaneOpen] = useState(false)
  const [isPropertyPaneVisible, setIsPropertyPaneVisible] = useState(false)
  const [isPropertyPaneClosing, setIsPropertyPaneClosing] = useState(false)
  const [configurationToastNodeId, setConfigurationToastNodeId] = useState<string | null>(null)
  const [isGroupCreationModalOpen, setIsGroupCreationModalOpen] = useState(false)
  const [isEmptyGroupModalOpen, setIsEmptyGroupModalOpen] = useState(false)
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false)
  const [emptyGroupPosition, setEmptyGroupPosition] = useState({ x: 0, y: 0 })
  const [nodeHoveringGroupId, setNodeHoveringGroupId] = useState<string | null>(null)
  const draggingNodeIdsRef = useRef<Set<string>>(new Set())
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [selectionContextMenu, setSelectionContextMenu] = useState<{
    isVisible: boolean
    position: { x: number; y: number }
  }>({ isVisible: false, position: { x: 0, y: 0 } })
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [graphCanvasStates, setGraphCanvasStates] = useState<
    Record<string, { offset: { x: number; y: number }; zoom: number }>
  >({})

  // Selection state
  const [selectionBounds, setSelectionBounds] = useState<{
    start: { x: number; y: number }
    end: { x: number; y: number }
  } | null>(null)

  // Comprehensive selection state
  const [selection, setSelection] = useState({
    isSelecting: false,
    selectionStart: null as { x: number; y: number } | null,
    selectionEnd: null as { x: number; y: number } | null,
    selectedNodeIds: [] as string[],
    dragSelecting: false,
  })
  const [viewportSize, setViewportSize] = useState({
    width: 1200,
    height: 800,
  })

 

  // Track which group containers are ready to prevent node flickering
  const [readyGroupContainers, setReadyGroupContainers] = useState<Set<string>>(new Set())
  // Track newly created groups to render their nodes immediately
  const [newlyCreatedGroups, setNewlyCreatedGroups] = useState<Set<string>>(new Set())
  const [isEditingWorkflowName, setIsEditingWorkflowName] = useState(false)
  const [editedWorkflowName, setEditedWorkflowName] = useState('')
  const [workflowTrigger, setWorkflowTrigger] = useState<any>(null)
  const {
    nodeBounds,
    updateNodeBounds: originalUpdateNodeBoundsHook,
    removeNodeBounds,
    getNodeBoundsArray,
  } = useNodeBounds()
  const { updatePortPosition: oldUpdatePortPosition, getPortPosition: getStoredPortPosition } =
    usePortPositions()

  // Load user name from localStorage on client side
  useEffect(() => {
    const savedUserName = sessionStorage.getItem('userName')
    if (savedUserName) {
      setUserName(savedUserName)
    }
  }, [])

  // Zustand stores
  // Separate data fetching to prevent unnecessary re-renders
  const workflowData = useWorkflowData()
  const storeNodes = workflowData.nodes
  const connections = workflowData.connections
  const groups = workflowData.groups
  const currentGraphId = workflowData.currentGraphId
  const graphs = workflowData.graphs

  const {
    // Core state
    workflowId,
    workflowName,
    initialized,

    // CRDT
    doc,
    provider,

    // Canvas state (per graph, local only)
    canvasStates,

    // Selection state (local only)
    selectedNodeIds,

    // Connection status
    isOptimized,

    // Core actions
    initialize,
    cleanup,

    // Graph management
    addGraph,
    removeGraph,
    renameGraph,
    switchGraph,

    // Node management
    addNode,
    updateNodePosition,
    updateNodeProperty,
    removeNode,
    updateNodePositionInGroup,

    // Connection management
    addConnection,
    updateConnectionState,
    removeConnection,

    // Group management
    createGroup,
    updateGroup,
    updateGroupBounds,
    recalculateGroupBounds,
    addNodeToGroup,
    removeNodeFromGroup,
    removeGroup,

    // Canvas state (local only)
    updateCanvasState,

    // Selection (local only)
    setSelectedNodes,

    // Utility
    getAllGraphsData,

    // Presence
    updateCursorPosition,

    // Persistence
    saveToAPI,
    enableAutosave,

    // Workflow metadata
    setWorkflowName,

    // Dirty state management
    setGraphDirty,
    isGraphDirty,

    // CRDT connection
    connectCRDT,
  } = useWorkflowStore()

  // Use separate hook for presence to prevent re-renders
  const { presence, localClientId } = usePresence()
  const { isConnected, isSyncing } = useConnectionStatus()

  // Always render nodes when initialized - don't hide during brief sync periods
  // This prevents nodes from disappearing during temporary connection states
  const shouldRenderNodes = initialized
  const shouldAllowGroupRendering = initialized

  // Memoize group nodes calculation to prevent unnecessary re-renders
  const groupNodesByGroupId = useMemo(() => {
    const result: Record<string, any[]> = {}
    groups.forEach((group: any) => {
      if (group.id) {
        result[group.id] = storeNodes.filter((node: any) => {
          const nodeId = getNodeId(node)
          return nodeId && group.nodeIds.includes(nodeId) && node.metadata
        })
      }
    })
    return result
  }, [groups, storeNodes, getNodeId])

  // Enhanced node bounds hook that also recalculates group bounds when nodes change size
  const updateNodeBoundsHook = useCallback(
    (nodeId: string, bounds: any) => {
      originalUpdateNodeBoundsHook(nodeId, bounds)
      // Don't recalculate group bounds during resize operations to prevent flickering
      // Group bounds will be recalculated when nodes are added/removed, not during resize
    },
    [originalUpdateNodeBoundsHook]
  )

  // Local state for node positions within groups (not synced)
  const [groupNodePositions, setGroupNodePositions] = useState<
    Record<string, Record<string, { x: number; y: number }>>
  >({})
  // Structure: { groupId: { nodeId: { x, y } } }

  // Track if localStorage has been loaded to prevent overwriting saved positions
  const [localStorageLoaded, setLocalStorageLoaded] = useState(false)

  // Local state for group collapse (not synced)
  const [localGroupCollapseState, setLocalGroupCollapseState] = useState<Record<string, boolean>>(
    {}
  )

  // Local state to persist expanded group sizes (not synced between users)
  const [expandedGroupSizes, setExpandedGroupSizes] = useState<
    Record<string, { width: number; height: number }>
  >({})

  // Load expanded group sizes from localStorage when workflowId becomes available
  useEffect(() => {
    if (workflowId) {
      const saved = localStorage.getItem(`expandedGroupSizes_${workflowId}`)
      if (saved) {
        try {
          setExpandedGroupSizes(JSON.parse(saved))
        } catch (e) {
          console.warn('Failed to parse saved expanded group sizes:', e)
        }
      }
    }
  }, [workflowId])

  // Save expanded group sizes to localStorage when they change
  useEffect(() => {
    if (workflowId && Object.keys(expandedGroupSizes).length > 0) {
      localStorage.setItem(`expandedGroupSizes_${workflowId}`, JSON.stringify(expandedGroupSizes))
    }
  }, [workflowId, expandedGroupSizes])

  // Handler for toggling group collapse state locally
  // Handler for updating expanded group sizes when manually resized
  const handleGroupResize = useCallback(
    (groupId: string, newSize: { width: number; height: number }) => {
      setExpandedGroupSizes(prev => ({
        ...prev,
        [groupId]: newSize,
      }))
    },
    []
  )

  const handleGroupCollapseToggle = useCallback(
    (groupId: string) => {
      const group = groups.find((g: { id: string }) => g.id === groupId)
      if (!group) return

      setLocalGroupCollapseState(prev => {
        const wasCollapsed = prev[groupId] || false
        const willBeExpanded = wasCollapsed

        if (willBeExpanded) {
          // Expanding: restore the saved inner container bounded rectangle
          const savedExpandedSize = expandedGroupSizes[groupId]
          if (savedExpandedSize) {
            // Immediately restore the exact same bounded rectangle - no recalculation needed
            updateGroupBounds(groupId, {
              x: group.position?.x || 0, // Keep current position
              y: group.position?.y || 0, // Keep current position
              width: savedExpandedSize.width,
              height: savedExpandedSize.height,
            })
          } else {
            // No saved bounds - this means it's the first time expanding
            // Recalculate bounds to ensure all nodes fit properly using bounding rectangle
            recalculateGroupBounds(groupId, groupNodePositions[groupId])
          }
        } else {
          // Collapsing: save the inner container's bounded rectangle before collapsing
          // This ensures all nodes remain within the group container when expanded again
          if (group.size) {
            setExpandedGroupSizes(prev => ({
              ...prev,
              [groupId]: {
                width: group.size!.width,
                height: group.size!.height,
              },
            }))
          }
        }

        return {
          ...prev,
          [groupId]: !wasCollapsed,
        }
      })
    },
    [groups, expandedGroupSizes, updateGroupBounds, recalculateGroupBounds]
  )
  // Structure: { groupId: isCollapsed }

  // Load groupNodePositions from localStorage as fallback only (CRDT will override)
  useEffect(() => {
    if (workflowId && typeof window !== 'undefined' && !initialized) {
      const saved = localStorage.getItem(`groupNodePositions-${workflowId}`)
      if (saved) {
        try {
          const parsedPositions = JSON.parse(saved)
          // Only use localStorage if CRDT hasn't loaded yet
          setGroupNodePositions(parsedPositions)
        } catch (e) {
          console.error('Failed to parse saved group node positions:', e)
        }
      }
      setLocalStorageLoaded(true)
    }
  }, [workflowId, initialized])

  // Save groupNodePositions to localStorage when it changes
  useEffect(() => {
    if (workflowId && Object.keys(groupNodePositions).length > 0) {
      localStorage.setItem(`groupNodePositions-${workflowId}`, JSON.stringify(groupNodePositions))
    }
  }, [groupNodePositions, workflowId])

  // Sync localStorage with CRDT data when groups change - CRDT always takes precedence
  useEffect(() => {
    if (!workflowId || !initialized || groups.length === 0 || isSyncing) return

    // CRDT positions always override localStorage to prevent flickering
    const crdtPositions: Record<string, Record<string, { x: number; y: number }>> = {}
    let hasCrdtData = false

    groups.forEach(group => {
      if (group.nodePositions && Object.keys(group.nodePositions).length > 0) {
        crdtPositions[group.id] = group.nodePositions
        hasCrdtData = true
      }
    })

    // Only update if we have CRDT data and it's actually different
    if (hasCrdtData) {
      setGroupNodePositions(prev => {
        // Check if there are actual changes before updating
        const hasChanges = Object.keys(crdtPositions).some(groupId => {
          const prevPositions = prev[groupId]
          const newPositions = crdtPositions[groupId]
          return JSON.stringify(prevPositions) !== JSON.stringify(newPositions)
        })
        
        if (hasChanges) {
          return {
            ...prev, // Keep positions for groups not in CRDT yet
            ...crdtPositions, // CRDT positions override everything
          }
        }
        return prev // No changes, return same reference
      })
    }
  }, [groups, workflowId, initialized, isSyncing])

  // This logic has been moved to NodeGroupContainer component for better localization

  // Force autosave on when in collaborative mode
  useEffect(() => {
    if (isCollaborative && !autosaveEnabled) {
      setAutosaveEnabled(true)
    }
  }, [isCollaborative, autosaveEnabled])

  // Keep selection state synchronized
  useEffect(() => {
    // Sync the selectedNodeIds from the store with our local selection state
    if (!selection.dragSelecting && !isSyncing) {
      setSelection(prev => ({
        ...prev,
        selectedNodeIds: selectedNodeIds,
      }))
    }
  }, [selectedNodeIds, selection.dragSelecting, isSyncing])

  // Expose debug functions to window for recovery
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).getAllGraphsData = getAllGraphsData
      // Debug function exposed: window.getAllGraphsData()
    }
  }, [getAllGraphsData])

  // Debug: Log graphs data - skip during sync to reduce noise
  useEffect(() => {
    if (isSyncing) return
    // [Page] Graphs state changed
  }, [graphs, currentGraphId, initialized, isSyncing])

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
    }
  }, [])

  // Keyboard shortcuts for node operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts if no input/textarea is focused
      const activeElement = document.activeElement
      if (activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)) {
        return
      }

      // Delete key - delete selected nodes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds && selectedNodeIds.length > 0) {
          e.preventDefault()
          // Delete all selected nodes
          selectedNodeIds.forEach(nodeId => {
            removeNode(nodeId)
          })
          setGraphDirty(currentGraphId, true)
          // Clear selection
          setSelectedNodes([])
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedNodeIds, removeNode, setGraphDirty, currentGraphId, setSelectedNodes])

  // Helper functions to match graphStore interface
  const getCurrentGraph = () => {
    return graphs.find(g => g.id === currentGraphId) || null
  }

  const getMainGraph = () => {
    return graphs.find(g => g.isMain) || graphs[0] || null
  }

  const getGraphById = (graphId: string) => {
    return graphs.find(g => g.id === graphId) || null
  }

  // These are local-only functions, not synced
  const setMainGraph = (graphId: string) => {
    // TODO: Implement if needed
  }

  const updateCanvasStateLocal = (graphId: string, canvasState: any) => {
    // Update the canvas states map locally
    setGraphCanvasStates(prev => ({
      ...prev,
      [graphId]: canvasState,
    }))

    // Update the store's canvas state
    updateCanvasState(graphId, canvasState)
  }

  const updateWorkflowState = (graphId: string, workflowState: any) => {
    // This is handled by CRDT automatically
  }

  const loadGraphs = (graphs: any[], currentGraphId?: string) => {
    // Initial load is handled by CRDT
  }

  const { dragState, startDrag, updateDrag, endDrag } = useConnectionDrag(connections)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null)
  const [unsavedChangesDialog, setUnsavedChangesDialog] = useState<{
    isOpen: boolean
    pendingAction: (() => void) | null
    graphName?: string
  }>({ isOpen: false, pendingAction: null })
  const [isSavingGraph, setIsSavingGraph] = useState(false)

  // Update configured environment variables in the store
  const updateConfiguredEnvVars = async () => {
    try {
      const sections = await EnvVarService.getConfigSections()
      const configuredVars: string[] = []

      sections.forEach(section => {
        section.variables.forEach(variable => {
          if (variable.value) {
            configuredVars.push(variable.key)
          }
        })
      })

      useEnvVarStore.getState().updateConfiguredVars(configuredVars)
    } catch (error) {
      console.error('Failed to update configured environment variables:', error)
    }
  }

  // Track unsaved changes and warn before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentGraph = graphs.find(g => g.id === currentGraphId)
      if (currentGraph?.isDirty) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return 'You have unsaved changes. Are you sure you want to leave?'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [graphs, currentGraphId])

  // Update document title with workflow name and unsaved indicator
  useEffect(() => {
    const hasUnsaved = graphs.some(g => g.isDirty)

    if (workflowName) {
      const unsavedIndicator = hasUnsaved ? '• ' : ''
      document.title = `${unsavedIndicator}${workflowName} - Zeal`
    } else {
      document.title = 'Zeal - Workflow Orchestrator'
    }
  }, [workflowName, graphs])

  // This logic has been moved to NodeGroupContainer for better localization
  // Each group component handles its own node position initialization

  // Initialize workflow on mount
  useEffect(() => {
    if (!initialized && isLoading) {
      const initializeWorkflow = async () => {
        try {
          setLoadingMessage('Loading workflow data...')

          // Check if there's a shared workflow ID in the URL first
          const params = new URLSearchParams(window.location.search)
          const sharedId = params.get('id')

          if (sharedId) {
            // If there's a shared ID, don't create a new workflow or load from storage
            // The CRDT initialization below will handle loading the shared workflow
            // [Init] Using shared workflow ID from URL
          } else {
            // No shared ID, check local storage
            const savedWorkflowId = WorkflowStorageService.getCurrentWorkflowId()

            if (savedWorkflowId) {
              // Load existing workflow
              try {
                // TODO: Implement storage loading in V2
                // Loading from storage not implemented in V2 yet
                const result = null
              } catch (error) {
                console.error('Failed to load workflow:', error)
                // Clear invalid workflow ID and create new workflow
                WorkflowStorageService.clearCurrentWorkflowId()
                toast.error('Previous workflow not found. Creating new workflow.')
                try {
                  const newWorkflowId = `workflow-${Date.now()}`
                  await initialize(newWorkflowId, 'New Workflow')
                  WorkflowStorageService.setCurrentWorkflowId(newWorkflowId)
                } catch (createError) {
                  console.error('Failed to create new workflow:', createError)
                  toast.error(createError)
                }
              }
            } else if (!storeNodes || storeNodes.length === 0) {
              // Create new empty workflow
              // Add a flag to prevent infinite loops
              if (!creatingWorkflow.current) {
                creatingWorkflow.current = true
                const newWorkflowId = `workflow-${Date.now()}`
                initialize(newWorkflowId, 'New Workflow')
                  .catch(error => {
                    console.error('Failed to create new workflow:', error)
                    // Don't toast error to prevent further re-renders
                  })
                  .finally(() => {
                    creatingWorkflow.current = false
                  })
              }
            }
          }

          // Skip loading env vars during initialization - will load on demand

          // Initialize graphs from storage
          setLoadingMessage('Loading graphs...')

          // Save workflow snapshot for loading after CRDT init
          let savedSnapshot: any = null
          let savedGraphInfos: any[] = []
          let savedCanvasStates: any = {}

          // Get the most recent workflow
          let recentWorkflows: any[] = []
          try {
            recentWorkflows = await WorkflowStorageService.getWorkflowHistory(1)
          } catch (error) {
            console.error('❌ Failed to load workflow history:', error)
            // Continue without history
          }
          if (recentWorkflows.length > 0) {
            const snapshot = recentWorkflows[0]
            savedSnapshot = snapshot

            // Check if it's a multi-graph snapshot
            const restored = restoreWorkflowFromSnapshot(snapshot)
            // [Init] Local workflow history found
            if (restored.graphs) {
              // Multi-graph workflow - convert to GraphInfo format and save for CRDT loading
              const graphInfos = restored.graphs.map(graph => {
                const graphState = restoreGraphFromSerialized(graph)
                return {
                  id: graph.id,
                  name: graph.name,
                  namespace: graph.namespace,
                  isMain: graph.isMain,
                  isDirty: false,
                  canvasState: graph.canvasState || {
                    offset: { x: 0, y: 0 },
                    zoom: 1,
                  },
                  workflowState: {
                    nodes: graphState.nodes,
                    connections: graphState.connections,
                    groups: graphState.groups,
                    triggerConfig: graph.isMain ? snapshot.trigger : null,
                    portPositions: graphState.portPositions,
                  },
                }
              })

              // Restore canvas states to local state
              const canvasStates: Record<
                string,
                { offset: { x: number; y: number }; zoom: number }
              > = {}
              graphInfos.forEach(graphInfo => {
                if (graphInfo.canvasState) {
                  canvasStates[graphInfo.id] = graphInfo.canvasState
                }
              })
              setGraphCanvasStates(canvasStates)

              // Save for CRDT loading
              savedGraphInfos = graphInfos
              savedCanvasStates = canvasStates
            } else if (restored.nodes) {
              // Legacy single-graph workflow
              const mainGraphInfo = {
                id: 'main',
                name: 'Main',
                namespace: 'main',
                isMain: true,
                isDirty: false,
                canvasState: restored.canvasState || {
                  offset: { x: 0, y: 0 },
                  zoom: 1,
                },
                workflowState: {
                  nodes: restored.nodes,
                  connections: restored.connections || [],
                  groups: restored.groups || [],
                  triggerConfig: snapshot.triggerConfig,
                  portPositions: undefined, // Legacy workflows don't have saved port positions
                },
              }

              // CRDT handles graph loading
              if (currentGraphId !== 'main') {
                switchGraph('main')
              }
            }

            // Set workflow metadata
            setWorkflowName(snapshot.name)

            // IMPORTANT: Set the current workflow ID so it persists across refreshes
            useWorkflowStore.setState({ workflowId: snapshot.id })
            WorkflowStorageService.setCurrentWorkflowId(snapshot.id)
          }

          // Initialization is handled by the store

          // Ensure user has proper identity before initializing CRDT
          if (!sessionStorage.getItem('userId')) {
            const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
            sessionStorage.setItem('userId', userId)
          }
          if (!sessionStorage.getItem('userName')) {
            sessionStorage.setItem('userName', 'Anonymous User')
          }
          if (!sessionStorage.getItem('userColor')) {
            const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']
            sessionStorage.setItem('userColor', colors[Math.floor(Math.random() * colors.length)])
          }

          // Initialize CRDT for collaborative features
          // Re-read params since we might have updated the URL above
          const currentParams = new URLSearchParams(window.location.search)
          const currentSharedId = currentParams.get('id')

          // Use saved workflow ID from localStorage if available
          const savedWorkflowId = WorkflowStorageService.getCurrentWorkflowId()
          // [Init] Workflow ID determination

          const effectiveWorkflowId =
            currentSharedId || workflowId || savedWorkflowId || `workflow-${Date.now()}`

          // [Init] Using effective workflow ID
          await initialize(effectiveWorkflowId, 'Untitled Workflow')

          // Ensure the workflow ID is saved for future page loads
          if (!currentSharedId && effectiveWorkflowId) {
            WorkflowStorageService.setCurrentWorkflowId(effectiveWorkflowId)
          }

          // Enable autosave
          enableAutosave(true)

          // The store handles all loading logic automatically
          // [Init] Initialization complete

          // Update URL if needed
          if (!currentSharedId && effectiveWorkflowId) {
            const url = new URL(window.location.href)
            url.searchParams.set('id', effectiveWorkflowId)
            window.history.replaceState({}, '', url)
          }

          // Small delay to ensure everything is rendered
          await new Promise(resolve => setTimeout(resolve, 200))

          setIsLoading(false)

          // Connect CRDT after loading is complete
          connectCRDT()
        } catch (error) {
          console.error('Failed to initialize workflow:', error)
          setIsLoading(false)
        }
      }

      initializeWorkflow()
    }
  }, [initialized, isLoading, storeNodes?.length, loadGraphs, switchGraph])

  // Show env var warning when there are missing vars
  useEffect(() => {
    setShowEnvVarWarning(missingEnvVars.length > 0)
  }, [missingEnvVars])

  // Handle graph switching
  useEffect(() => {
    const currentGraph = getCurrentGraph()
    if (!currentGraph) return

    // Load canvas state only if it's different from current state
    if (currentGraph.canvasState) {
      const { offset, zoom } = currentGraph.canvasState
      if (offset.x !== canvasOffset.x || offset.y !== canvasOffset.y) {
        setCanvasOffset(offset)
      }
      if (zoom !== canvasZoom) {
        setCanvasZoom(zoom)
      }
    } else {
      // Reset canvas state for new graph only if not already reset
      if (canvasOffset.x !== 0 || canvasOffset.y !== 0) {
        setCanvasOffset({ x: 0, y: 0 })
      }
      if (canvasZoom !== 1) {
        setCanvasZoom(1)
      }
    }

    // CRDT: Removed graph state loading - let CRDT observers handle it
    // Port position measurements will be triggered by CRDT observers when nodes load
  }, [currentGraphId, graphs, initialized])

  // Restore canvas state from UserPreferences on initial load
  useEffect(() => {
    if (!workflowId || !currentGraphId || !initialized) return

    // Don't restore if canvas state was already loaded from snapshot
    const currentGraph = graphs.find((g: { id: any }) => g.id === currentGraphId)
    if (currentGraph && currentGraph.canvasState) return

    // Restore canvas state from user preferences
    const savedCanvasState = UserPreferencesService.getCanvasState(workflowId, currentGraphId)
    if (savedCanvasState) {
      setCanvasOffset(savedCanvasState.offset)
      setCanvasZoom(savedCanvasState.zoom)
    }
  }, [workflowId, currentGraphId, initialized, graphs])

  // Check for nodes that need configuration and show toast
  useEffect(() => {
    // If we're showing a toast for a specific node, check if it still needs configuration
    if (configurationToastNodeId) {
      const currentNode = storeNodes.find(
        (n: any) => (n.id || n.metadata.id) === configurationToastNodeId
      )
      if (!currentNode || !hasUnconfiguredDefaults(currentNode.metadata)) {
        // Node is now properly configured, dismiss the toast
        setConfigurationToastNodeId(null)
        return
      }
    }

    // Only check for new unconfigured nodes if we don't already have a toast showing
    if (configurationToastNodeId) return

    // Find nodes that need configuration
    const unconfiguredNodes = storeNodes.filter((node: any) =>
      hasUnconfiguredDefaults(node.metadata)
    )

    if (unconfiguredNodes.length > 0) {
      // Show toast for the most recently added node that needs configuration
      const latestUnconfigured = unconfiguredNodes[unconfiguredNodes.length - 1]
      setConfigurationToastNodeId(latestUnconfigured.metadata.id)
    }
  }, [storeNodes])

  // Clean up node bounds when nodes are removed
  useEffect(() => {
    const currentNodeIds = new Set(storeNodes.map((node: any) => getNodeId(node)))
    const currentBounds = getNodeBoundsArray()

    // Remove bounds for nodes that no longer exist
    currentBounds.forEach(bounds => {
      if (!currentNodeIds.has(bounds.id)) {
        removeNodeBounds(bounds.id)
      }
    })
  }, [storeNodes, getNodeBoundsArray, removeNodeBounds])

  // Removed the debugging interval that was causing endless API calls

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight - 60, // Subtract header height
      })
    }

    updateViewportSize()
    window.addEventListener('resize', updateViewportSize)
    return () => window.removeEventListener('resize', updateViewportSize)
  }, [])

  // Automatic graph state persistence - save current graph state to graph store when changes occur
  useEffect(() => {
    if (!initialized || isSyncing) return // Don't persist before initialization or during sync

    const currentGraph = getCurrentGraph()
    if (currentGraph) {
      // Create workflow state from current store data
      const workflowState = {
        nodes: storeNodes,
        connections: connections,
        groups: groups,
        triggerConfig: currentGraph.isMain ? workflowTrigger : null,
        portPositions: {}, // TODO: Implement port positions tracking
      }

      // State is automatically saved in CRDT
      updateWorkflowState(currentGraph.id, workflowState)
      updateCanvasState(currentGraph.id, {
        offset: canvasOffset,
        zoom: canvasZoom,
      })
    }
  }, [storeNodes, connections, groups, workflowTrigger, canvasOffset, canvasZoom, initialized, isSyncing])

  // Opt-in autosave to storage/server - only when enabled
  useEffect(() => {
    if (!autosaveEnabled || !initialized || graphs.length === 0 || !doc || storeNodes.length === 0 || isSyncing)
      return

    const autosaveDelay = 5000 // 5 seconds delay for actual persistence
    const autosaveTimer = setTimeout(() => {
      // Skip autosave if still syncing
      if (isSyncing) return
      
      // [Page] Triggering autosave...
      try {
        saveWorkflowSilent()
      } catch (error) {
        console.error('Autosave failed:', error)
      }
    }, autosaveDelay)

    return () => clearTimeout(autosaveTimer)
  }, [
    storeNodes,
    connections,
    groups,
    workflowTrigger,
    graphs,
    currentGraphId,
    autosaveEnabled,
    initialized,
    doc,
    isSyncing, // Add isSyncing to dependencies
  ])

  const handleNodePositionChange = (nodeId: string, position: { x: number; y: number }) => {
    // Handle node position change

    if (draggingNodeIdsRef.current.has(nodeId)) {
      // If node is being dragged, update CRDT state immediately for real-time sync
      updateNodePosition(nodeId, position)
      setGraphDirty(currentGraphId, true)
    } else {
      // If node is not being dragged, update CRDT (normal case)
      updateNodePosition(nodeId, position)
      setGraphDirty(currentGraphId, true)
    }

    // Clear highlighting when a node is moved
    if (highlightedNodeId === nodeId) {
      setHighlightedNodeId(null)
    }
  }

  // Handle node property changes
  const handleNodePropertyChange = useCallback((nodeId: string, propertyName: string, value: any) => {
    // Handle node property change - update only the specific property
    updateNodeProperty(nodeId, propertyName, value)
    setGraphDirty(currentGraphId, true)
  }, [updateNodeProperty, setGraphDirty, currentGraphId])

  // Handle node selection
  const handleNodeSelect = useCallback((nodeId: string, event?: React.MouseEvent) => {
    const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0
    const hasModifier = isMac ? event?.metaKey : event?.ctrlKey

    if (hasModifier) {
      // Multi-select mode: add/remove node from selection
      const currentSelection =
        selectedNodeIds.length > 0 ? selectedNodeIds : selection.selectedNodeIds
      const isCurrentlySelected = currentSelection.includes(nodeId)

      let newSelection: string[]
      if (isCurrentlySelected) {
        // Remove from selection
        newSelection = currentSelection.filter(id => id !== nodeId)
      } else {
        // Add to selection
        newSelection = [...currentSelection, nodeId]
      }

      setSelectedNodes(newSelection)
      setSelection(prev => ({
        ...prev,
        selectedNodeIds: newSelection,
        isSelecting: false,
        selectionStart: null,
        selectionEnd: null,
        dragSelecting: false,
      }))

      // Only open property pane if there's exactly one node selected
      if (newSelection.length === 1) {
        setSelectedNodeId(newSelection[0])
        setIsPropertyPaneOpen(true)
        setIsPropertyPaneVisible(true)
        setIsPropertyPaneClosing(false)
      } else {
        // Close property pane for multi-selection
        setSelectedNodeId(null)
        setIsPropertyPaneOpen(false)
        setIsPropertyPaneVisible(false)
      }
    } else {
      // Single selection mode: clear existing selection and select this node
      setSelectedNodes([nodeId])
      setSelection(prev => ({
        ...prev,
        selectedNodeIds: [nodeId],
        isSelecting: false,
        selectionStart: null,
        selectionEnd: null,
        dragSelecting: false,
      }))

      setSelectedNodeId(nodeId)
      setIsPropertyPaneOpen(true)
      setIsPropertyPaneVisible(true)
      setIsPropertyPaneClosing(false)
    }
  }, [selectedNodeIds, selection.selectedNodeIds, setSelectedNodes, setSelection, setSelectedNodeId, setIsPropertyPaneOpen, setIsPropertyPaneVisible, setIsPropertyPaneClosing])

  // Handle property pane close
  const handlePropertyPaneClose = () => {
    setIsPropertyPaneClosing(true)
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsPropertyPaneVisible(false)
      setIsPropertyPaneOpen(false)
      setIsPropertyPaneClosing(false)
      setSelectedNodeId(null)
    }, 300) // Match animation duration
  }

  // Handle node browser toggle
  const handleNodeBrowserToggle = () => {
    setIsNodeBrowserOpen(!isNodeBrowserOpen)
  }

  const handleRunSimulation = () => {
    // Get all connections sorted by their source node's x position (left to right)
    const sortedConnections = [...connections].sort((a, b) => {
      const aNode = storeNodes.find((n: any) => (n.id || n.metadata.id) === a.source.nodeId)
      const bNode = storeNodes.find((n: any) => (n.id || n.metadata.id) === b.source.nodeId)
      if (!aNode || !bNode) return 0
      return aNode.position.x - bNode.position.x
    })

    // Start simulation
    simulateWorkflowExecution(sortedConnections)
  }

  const simulateWorkflowExecution = async (sortedConnections: Connection[]) => {
    // Reset all connections to pending
    sortedConnections.forEach(conn => {
      updateConnectionState(conn.id, 'pending')
    })

    // Simulate execution for each connection
    for (let i = 0; i < sortedConnections.length; i++) {
      const connection = sortedConnections[i]

      // Set to running state
      updateConnectionState(connection.id, 'running')

      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Randomly choose success or error (80% success rate)
      const finalState = Math.random() > 0.2 ? 'success' : 'error'
      updateConnectionState(connection.id, finalState)

      // Small delay before next connection
      if (i < sortedConnections.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
  }

  // Debounced canvas state persistence to avoid excessive localStorage writes
  const persistCanvasState = useMemo(() => {
    let timeoutId: NodeJS.Timeout
    return (zoom: number, offset: { x: number; y: number }) => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        if (workflowId && currentGraphId) {
          UserPreferencesService.updateCanvasState(workflowId, currentGraphId, { zoom, offset })
        }
      }, 300) // Debounce for 300ms
    }
  }, [workflowId, currentGraphId])

  // Enhanced canvas state setters that persist changes
  const handleCanvasZoomChange = useCallback(
    (newZoom: number) => {
      setCanvasZoom(newZoom)
      persistCanvasState(newZoom, canvasOffset)
    },
    [canvasOffset, persistCanvasState]
  )

  const handleCanvasOffsetChange = useCallback(
    (newOffset: { x: number; y: number }) => {
      setCanvasOffset(newOffset)
      persistCanvasState(canvasZoom, newOffset)
    },
    [canvasZoom, persistCanvasState]
  )

  // Zoom control handlers
  const handleZoomIn = () => {
    const newZoom = Math.min(3, canvasZoom * 1.2)
    handleCanvasZoomChange(newZoom)
  }

  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, canvasZoom / 1.2)
    handleCanvasZoomChange(newZoom)
  }

  const handleZoomReset = () => {
    const newZoom = 1
    const newOffset = { x: 0, y: 0 }
    handleCanvasZoomChange(newZoom)
    handleCanvasOffsetChange(newOffset)
  }

  // Handle category click from sidebar
  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId)
    setIsSearchOpen(true)
  }

  // Handle highlighting newly added nodes
  // Note: Canvas panning is now handled by SearchModal for nodes added through it
  const handleNodeAdded = (nodeId: string) => {
    // Only handle highlighting here if not already handled by SearchModal
    // The SearchModal will call this but will have already done the panning and highlighting

    // For nodes added through other means (like duplication in NodeBrowserPanel),
    // we still want to do the panning
    const isFromSearchModal = highlightedNodeId === nodeId
    if (!isFromSearchModal) {
      setHighlightedNodeId(nodeId)

      // Wait a bit for CRDT sync before trying to find the node
      setTimeout(() => {
        // Find the newly added node to get its position
        const newNode = storeNodes.find((node: any) => getNodeId(node) === nodeId)
        if (newNode) {
          // Calculate viewport center and pan to the new node
          const viewportCenterX = viewportSize.width / 2
          const viewportCenterY = viewportSize.height / 2

          const newOffset = {
            x: viewportCenterX - newNode.position.x * canvasZoom,
            y: viewportCenterY - newNode.position.y * canvasZoom,
          }

          setCanvasOffset(newOffset)
        }
      }, 100)

      // Remove highlight after 2 seconds
      setTimeout(() => {
        setHighlightedNodeId(null)
      }, 2000)
    }
  }

  // Handle node selection from browser
  const handleNodeSelectFromBrowser = (nodeId: string, position: { x: number; y: number }) => {
    // Center the canvas on the selected node
    const viewportCenterX = window.innerWidth / 2
    const viewportCenterY = window.innerHeight / 2

    const newOffset = {
      x: viewportCenterX - position.x * canvasZoom,
      y: viewportCenterY - position.y * canvasZoom,
    }

    setCanvasOffset(newOffset)
    setHighlightedNodeId(nodeId)

    // Remove highlight after 2 seconds
    setTimeout(() => {
      setHighlightedNodeId(null)
    }, 2000)
  }

  // Handle save workflow (with toast)
  const handleSaveWorkflow = async () => {
    try {
      await saveWorkflowSilent()
      ToastManager.success(`Workflow "${workflowName}" saved successfully!`)
    } catch (error) {
      ToastManager.error('Failed to save workflow. Please try again.')
      console.error('Save error:', error)
    }
  }

  // Handle save individual graph
  const handleSaveGraph = async () => {
    const currentGraph = getCurrentGraph()
    if (!currentGraph || !currentGraph.isDirty) return

    setIsSavingGraph(true)
    try {
      // Save the current graph state
      const workflowState = {
        nodes: storeNodes,
        connections: connections,
        groups: groups,
        triggerConfig: currentGraph.isMain ? workflowTrigger : null,
        portPositions: {}, // TODO: Implement port positions tracking
      }
      // State is automatically saved in CRDT
      updateWorkflowState(currentGraph.id, workflowState)
      updateCanvasState(currentGraph.id, {
        offset: canvasOffset,
        zoom: canvasZoom,
      })

      // Save to storage
      await saveWorkflowSilent()

      // Mark only the current graph as clean
      setGraphDirty(currentGraph.id, false)

      // Success message
      toast.success(`Graph "${currentGraph.name}" saved successfully`)
    } catch (error) {
      console.error('Failed to save graph:', error)
      toast.error('Failed to save graph')
    } finally {
      setIsSavingGraph(false)
    }
  }

  // Silent save function for autosave (no toast)
  const saveWorkflowSilent = async () => {
    try {
      // [Save] Starting autosave...

      // Get all graph data from CRDT document
      const allGraphsData = getAllGraphsData()

      // [Save] Getting all graphs data

      // Ensure we have at least one graph
      if (allGraphsData.length === 0) {
        console.error('[Save] No graphs to save! This should not happen.')
        throw new Error('No graphs available to save')
      }

      // Create workflow graphs from CRDT data
      const workflowGraphs = allGraphsData.map(graphData => {
        // Use current canvas state for the active graph, saved state for others
        const canvasState =
          graphData.id === currentGraphId
            ? { offset: canvasOffset, zoom: canvasZoom }
            : graphCanvasStates[graphData.id] || { offset: { x: 0, y: 0 }, zoom: 1 }

        return createWorkflowGraph(
          graphData.id,
          graphData.name,
          graphData.namespace || `${workflowName}/${graphData.id}`, // namespace defaults to workflowName/graphId
          graphData.isMain,
          graphData.nodes,
          graphData.connections,
          graphData.groups,
          canvasState,
          undefined // port positions - not needed for CRDT
        )
      })

      // Create or update workflow
      if (!workflowId) {
        // Create new workflow
        const snapshot = await WorkflowStorageService.createDraftWorkflow(workflowName)
        // Update store with the new workflow ID
        await initialize(snapshot.id, workflowName)

        // Save the full snapshot
        const fullSnapshot = createWorkflowSnapshot(
          workflowGraphs,
          currentGraphId,
          workflowName,
          snapshot.id,
          snapshot,
          workflowTrigger
        )
        await WorkflowStorageService.saveWorkflow(fullSnapshot)

        // Save the workflow ID to local storage
        WorkflowStorageService.setCurrentWorkflowId(snapshot.id)
      } else {
        // Update existing workflow - but check if it exists first
        let existingSnapshot = null
        try {
          existingSnapshot = await WorkflowStorageService.getWorkflow(workflowId)
        } catch (error: any) {
          // If workflow doesn't exist (404), we need to create it with the specific ID
          if (error?.statusCode === 404 || error?.code === 'WORKFLOW_NOT_FOUND') {
            // Workflow not found in database, creating new workflow with ID
            // Create the snapshot directly without going through createDraftWorkflow
            // which would generate a new ID
            const snapshot = createWorkflowSnapshot(
              workflowGraphs,
              currentGraphId,
              workflowName,
              workflowId,
              undefined, // no existing snapshot
              workflowTrigger
            )
            // Save as a new workflow
            await WorkflowStorageService.saveWorkflow(snapshot)
            return // Exit early since we've already saved
          } else {
            throw error
          }
        }

        // If we get here, the workflow exists, so update it
        const snapshot = createWorkflowSnapshot(
          workflowGraphs,
          currentGraphId,
          workflowName,
          workflowId,
          existingSnapshot || undefined,
          workflowTrigger
        )
        // [Save] Saving workflow snapshot
        await WorkflowStorageService.saveWorkflow(snapshot)
      }

      // Mark all graphs as clean after successful save
      graphs.forEach((graph: { id: string }) => {
        setGraphDirty(graph.id, false)
      })
    } catch (error) {
      console.error('Failed to save workflow:', error)
      toast.error(error as string)
      throw error // Re-throw to let autosave handler catch it
    }
  }

  // Check if there are any unsaved changes across all graphs
  const hasUnsavedChanges = () => {
    return graphs.some(graph => graph.isDirty)
  }

  // Handle navigation with unsaved changes check
  const handleNavigationWithCheck = (action: () => void, actionGraphName?: string) => {
    const dirtyGraphs = graphs.filter(graph => graph.isDirty)

    if (dirtyGraphs.length > 0) {
      // Show dialog with the first dirty graph's name
      const graphName = actionGraphName || dirtyGraphs[0].name
      setUnsavedChangesDialog({
        isOpen: true,
        pendingAction: action,
        graphName,
      })
    } else {
      // No unsaved changes, proceed with action
      action()
    }
  }

  // Handle unsaved changes dialog actions
  const handleUnsavedChangesSave = async () => {
    try {
      await handleSaveWorkflow()
      // After successful save, execute the pending action
      if (unsavedChangesDialog.pendingAction) {
        unsavedChangesDialog.pendingAction()
      }
      setUnsavedChangesDialog({ isOpen: false, pendingAction: null })
    } catch (error) {
      // Error already handled in handleSaveWorkflow
    }
  }

  const handleUnsavedChangesDiscard = () => {
    // Mark all graphs as clean since we're discarding changes
    graphs.forEach((graph: { id: string }) => {
      setGraphDirty(graph.id, false)
    })

    // Execute the pending action
    if (unsavedChangesDialog.pendingAction) {
      unsavedChangesDialog.pendingAction()
    }
    setUnsavedChangesDialog({ isOpen: false, pendingAction: null })
  }

  const handleUnsavedChangesCancel = () => {
    setUnsavedChangesDialog({ isOpen: false, pendingAction: null })
  }

  // Handle publish workflow
  const handlePublishWorkflow = async () => {
    try {
      // Get all graphs data
      const allGraphsData = getAllGraphsData()

      // Create a snapshot with published state
      const snapshot = createWorkflowSnapshot(
        allGraphsData.map(graphData => {
          // Use current canvas state for the active graph, saved state for others
          const canvasState =
            graphData.id === currentGraphId
              ? { offset: canvasOffset, zoom: canvasZoom }
              : graphCanvasStates[graphData.id] || { offset: { x: 0, y: 0 }, zoom: 1 }

          return createWorkflowGraph(
            graphData.id,
            graphData.name,
            graphData.namespace || `${workflowName}/${graphData.id}`, // namespace defaults to workflowName/graphId
            graphData.isMain,
            graphData.nodes,
            graphData.connections,
            graphData.groups,
            canvasState,
            undefined // port positions - not needed for CRDT
          )
        }),
        currentGraphId,
        workflowId,
        workflowName,
        undefined, // No existing snapshot for publish
        {} // No trigger for now
      )

      // Mark as published
      snapshot.isDraft = false
      snapshot.isPublished = true
      snapshot.publishedAt = new Date().toISOString()

      // Save the published workflow
      await WorkflowStorageService.saveWorkflow(snapshot)

      ToastManager.success(`Workflow "${workflowName}" published successfully!`)
    } catch (error) {
      ToastManager.error('Failed to publish workflow. Please try again.')
      console.error('Publish error:', error)
    }
  }

  // Handle load workflow from history
  const handleLoadWorkflow = async (selectedWorkflowId: string) => {
    const action = async () => {
      try {
        // Save current workflow first if it has changes
        if (workflowId !== selectedWorkflowId && hasUnsavedChanges()) {
          await saveWorkflowSilent()
        }

        // Load the selected workflow with multi-graph support
        const snapshot = await WorkflowStorageService.getWorkflow(selectedWorkflowId)
        if (!snapshot) {
          throw new Error('Workflow not found')
        }

        // Restore the workflow
        const restored = restoreWorkflowFromSnapshot(snapshot)

        if (restored.graphs && restored.graphs.length > 0) {
          // Multi-graph workflow
          const graphInfos = restored.graphs.map(graph => {
            const graphState = restoreGraphFromSerialized(graph)
            return {
              id: graph.id,
              name: graph.name,
              namespace: graph.namespace,
              isMain: graph.isMain,
              isDirty: false,
              canvasState: graph.canvasState || {
                offset: { x: 0, y: 0 },
                zoom: 1,
              },
              workflowState: {
                nodes: graphState.nodes,
                connections: graphState.connections,
                groups: graphState.groups,
                triggerConfig: graph.isMain ? snapshot.triggerConfig : null,
                portPositions: graphState.portPositions,
              },
            }
          })

          // Determine the target graph BEFORE loading graphs
          const targetGraphId =
            snapshot.activeGraphId && graphInfos.some(g => g.id === snapshot.activeGraphId)
              ? snapshot.activeGraphId
              : graphInfos.find(g => g.isMain)?.id ||
                (graphInfos.length > 0 ? graphInfos[0].id : 'main')

          // Restore canvas states for all graphs
          const canvasStates: Record<string, { offset: { x: number; y: number }; zoom: number }> =
            {}
          graphInfos.forEach(graphInfo => {
            if (graphInfo.canvasState) {
              canvasStates[graphInfo.id] = graphInfo.canvasState
            }
          })
          setGraphCanvasStates(canvasStates)

          // CRDT handles graph loading, just switch to target graph
          if (targetGraphId && targetGraphId !== currentGraphId) {
            switchGraph(targetGraphId)
          }

          // Load canvas state for the target graph
          const targetGraph = graphInfos.find(g => g.id === targetGraphId)
          if (targetGraph && targetGraph.canvasState) {
            setCanvasOffset(targetGraph.canvasState.offset)
            setCanvasZoom(targetGraph.canvasState.zoom)
          }

          // Update workflow metadata
          setWorkflowName(snapshot.name)
          setWorkflowTrigger(snapshot.triggerConfig || null)
        } else {
          // Legacy single-graph workflow
          // TODO: Implement storage loading in V2
          // Loading workflow not implemented in V2 yet
          const result: any = null
          if (result?.canvasState) {
            setCanvasOffset(result.canvasState.offset)
            setCanvasZoom(result.canvasState.zoom)
          }
        }

        // The workflowName will be updated by the store after loading
        setTimeout(() => {
          const { workflowName: newName } = useWorkflowStore.getState()
          ToastManager.info(`Loaded workflow "${newName}"`)
        }, 100)
      } catch (error) {
        ToastManager.error('Failed to load workflow. Please try again.')
        console.error('Load error:', error)
      }
    }

    // Check for unsaved changes before loading a different workflow
    if (hasUnsavedChanges()) {
      handleNavigationWithCheck(action, workflowName)
    } else {
      await action()
    }
  }

  // Handle environment variable configuration
  const handleVariableConfigured = () => {
    // Update configured vars after configuration
    updateConfiguredEnvVars()
  }

  // Handle dismissing env var warning (no persistent dismissal)
  const handleDismissEnvVarWarning = () => {
    setShowEnvVarWarning(false)
  }

  // Handle opening config from warning
  const handleOpenConfigFromWarning = async () => {
    // Fetch env vars when opening configuration
    await updateConfiguredEnvVars()
    setIsConfigOpen(true)
  }

  // Handle group creation
  const handleGroupCreationConfirm = (title: string, description: string) => {
    if (selectedNodeIds.length > 0) {
      const groupId = createGroup(title, selectedNodeIds, '#3b82f6')
      if (groupId) {
        if (description) {
          updateGroup(groupId, { description })
        }
        // Mark as newly created so nodes render immediately
        setNewlyCreatedGroups(prev => new Set(Array.from(prev).concat(groupId)))
        // Remove from newly created after a delay
        setTimeout(() => {
          setNewlyCreatedGroups(prev => {
            const updated = new Set(prev)
            updated.delete(groupId)
            return updated
          })
        }, 2000)
      }
      clearSelection()
    }
    setIsGroupCreationModalOpen(false)
  }

  const handleGroupCreationCancel = () => {
    setIsGroupCreationModalOpen(false)
  }

  // Handle selection context menu
  const handleSelectionContextMenu = (e: React.MouseEvent) => {
    if (selection.selectedNodeIds.length > 0) {
      e.preventDefault()
      setSelectionContextMenu({
        isVisible: true,
        position: { x: e.clientX, y: e.clientY },
      })
    }
  }

  const handleSelectionContextMenuClose = () => {
    setSelectionContextMenu({ isVisible: false, position: { x: 0, y: 0 } })
  }

  const handleContextMenuCreateGroup = () => {
    setIsGroupCreationModalOpen(true)
  }

  // Handle empty group creation
  const handleEmptyGroupCreationConfirm = (
    title: string,
    description: string,
    position: { x: number; y: number }
  ) => {
    // Create a temporary node to establish the group position
    const tempNodeId = `temp-${Date.now()}`
    const tempNode = addNode(
      {
        id: tempNodeId,
        templateId: 'placeholder',
        type: 'placeholder',
        title: 'Placeholder',
        icon: 'Circle',
        variant: 'gray-600',
        shape: 'rectangle',
        size: 'medium',
        ports: [],
        properties: {},
      },
      position
    )

    // Create group with the temp node
    const groupId = createGroup(title, [tempNodeId], '#3b82f6')

    // Update group with description and proper size
    if (groupId) {
      updateGroup(groupId, {
        description,
        size: { width: 300, height: 200 },
      })
    }

    // Remove the temp node
    removeNode(tempNodeId)

    setIsEmptyGroupModalOpen(false)
  }

  const handleEmptyGroupCreationCancel = () => {
    setIsEmptyGroupModalOpen(false)
  }

  const handleCreateEmptyGroup = (canvasPosition: { x: number; y: number }) => {
    setEmptyGroupPosition(canvasPosition)
    setIsEmptyGroupModalOpen(true)
  }

  const handleNodeDropIntoGroup = useCallback((nodeId: string, groupId: string) => {
    // [PageHandler] Node dropped into group

    // Get the target group and node
    const targetGroup = groups.find((g: { id: string }) => g.id === groupId)
    const node = storeNodes.find((n: { metadata: { id: string } }) => n.metadata.id === nodeId)

    if (!targetGroup || !node) return

    // Check if node is already in a different group and remove it first
    const currentGroup = groups.find((g: { nodeIds: string | string[] }) =>
      g.nodeIds.includes(nodeId)
    )
    if (currentGroup && currentGroup.id !== groupId) {
      // [PageHandler] Moving node from group to another group
      removeNodeFromGroup(currentGroup.id, nodeId)

      // Clean up stored position from previous group
      setGroupNodePositions(prev => {
        const newPositions = { ...prev }
        if (newPositions[currentGroup.id]) {
          delete newPositions[currentGroup.id][nodeId]
        }
        return newPositions
      })
    }

    // Before adding to group, update the node's absolute position
    // This ensures other clients can calculate the correct relative position
    // The node should be positioned at a default location within the group
    const headerOffset = targetGroup.description ? 100 : 32
    const padding = 20

    // Find a good position for the node within the group
    const existingNodesInGroup = storeNodes.filter((n: { metadata: { id: any } }) =>
      targetGroup.nodeIds.includes(n.metadata.id || n.metadata.id)
    )

    // Simple grid layout for dropped nodes
    const GRID_SPACING = 220
    const COLS = 3
    const index = existingNodesInGroup.length
    const col = index % COLS
    const row = Math.floor(index / COLS)

    const newAbsolutePosition = {
      x: targetGroup.position.x + padding + col * GRID_SPACING,
      y: targetGroup.position.y + headerOffset + padding + row * GRID_SPACING,
    }

    // Update node position in CRDT so other clients see it correctly
    updateNodePosition(nodeId, newAbsolutePosition)

    // Calculate and store the relative position within the group
    const relativePosition = {
      x: padding + col * GRID_SPACING,
      y: padding + row * GRID_SPACING,
    }

    // Store the node's position within the group (synced via CRDT)
    updateNodePositionInGroup(groupId, nodeId, relativePosition)

    // Add node to the target group
    addNodeToGroup(groupId, nodeId)
    setGraphDirty(currentGraphId, true)

    // Clear the hover state after successful drop
    setNodeHoveringGroupId(null)
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [groups, storeNodes, removeNodeFromGroup, setGroupNodePositions, updateNodePosition, updateNodePositionInGroup, addNodeToGroup, setGraphDirty, currentGraphId, setNodeHoveringGroupId])

  // Store initial node position in group (local only, no CRDT update)
  const storeInitialNodePositionInGroup = (
    nodeId: string,
    groupId: string,
    position: { x: number; y: number }
  ) => {
    // [Page] Storing initial node position in group

    // Only update local group position state
    setGroupNodePositions(prev => ({
      ...prev,
      [groupId]: {
        ...prev[groupId],
        [nodeId]: position,
      },
    }))
  }

  // Handle node position change within a group (during drag)
  const handleNodePositionInGroup = useCallback(
    (nodeId: string, groupId: string, position: { x: number; y: number }) => {
      // 🔥 [Page] Node position changed within group (v2 approach)

      // Update local state first for immediate visual feedback
      setGroupNodePositions(prev => ({
        ...prev,
        [groupId]: {
          ...prev[groupId],
          [nodeId]: position,
        },
      }))

      // Update the node position in the group through CRDT (this will sync to other clients)
      updateNodePositionInGroup(groupId, nodeId, position)

      // Calculate and update absolute position in CRDT for proper sync
      const group = groups.find((g: { id: string }) => g.id === groupId)
      if (group && group.position) {
        const headerOffset = group.description ? 100 : 32
        const absolutePosition = {
          x: group.position.x + position.x,
          y: group.position.y + headerOffset + position.y,
        }

        // Update node position in CRDT so other clients see it correctly
        updateNodePosition(nodeId, absolutePosition)
        setGraphDirty(currentGraphId, true)
      }
    },
    [groups, updateNodePositionInGroup, updateNodePosition, setGraphDirty, currentGraphId]
  )

  const handleNodeHoverGroup = useCallback((groupId: string | null) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }

    setNodeHoveringGroupId(groupId)

    // If hovering over a group, set a timeout to clear the hover state
    if (groupId) {
      hoverTimeoutRef.current = setTimeout(() => {
        setNodeHoveringGroupId(null)
        hoverTimeoutRef.current = null
      }, 5000) // Clear after 5 seconds
    }
  }, [setNodeHoveringGroupId])

  // Clear node hovering state when drag starts on a new node
  const handleNodeDragStart = useCallback((nodeId: string) => {
    // [DEBUG] Drag start
    // Clear any existing hover state when starting a new drag
    setNodeHoveringGroupId(null)
    // Track that this node is being dragged in both local and CRDT state
    draggingNodeIdsRef.current.add(nodeId)
    // Drag state is handled locally
    // [DEBUG] Dragging node IDs updated
  }, [setNodeHoveringGroupId])

  // Clear node hovering state when drag ends
  const handleNodeDragEnd = useCallback((nodeId: string, finalPosition?: { x: number; y: number }) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    // Ensure hover state is cleared when drag ends
    setNodeHoveringGroupId(null)

    // Update CRDT with the final dragged position
    if (finalPosition) {
      updateNodePosition(nodeId, finalPosition)
      setGraphDirty(currentGraphId, true)
    }

    // Remove node from dragging set AFTER updating CRDT
    // Use a small delay to ensure CRDT update completes
    setTimeout(() => {
      draggingNodeIdsRef.current.delete(nodeId)
      // Drag state is handled locally
      // [DEBUG] Removed from dragging
    }, 0)
  }, [setNodeHoveringGroupId, updateNodePosition, setGraphDirty, currentGraphId])

  const handleGroupEditClick = useCallback((groupId: string) => {
    setEditingGroupId(groupId)
  }, [])

  const handleGroupEditConfirm = (groupId: string, title: string, description: string) => {
    updateGroup(groupId, { title, description })
    setEditingGroupId(null)
  }

  const handleGroupEditCancel = () => {
    setEditingGroupId(null)
  }

  const handleGroupDeleteClick = useCallback((groupId: string) => {
    setDeletingGroupId(groupId)
  }, [])

  const handleContainerReady = useCallback((groupId: string) => {
    setReadyGroupContainers(prev => new Set(Array.from(prev).concat(groupId)))
    // Recalculate bounds after container and nodes are rendered
    setTimeout(() => {
      recalculateGroupBounds(groupId, groupNodePositions[groupId])
    }, 100)
  }, [setReadyGroupContainers, recalculateGroupBounds, groupNodePositions])

  const handleGroupDeleteConfirm = (groupId: string, preserveNodes: boolean) => {
    if (preserveNodes) {
      // Remove nodes from group but keep them
      const group = groups.find((g: any) => g.id === groupId)
      if (group) {
        group.nodeIds.forEach((nodeId: any) => {
          removeNodeFromGroup(groupId, nodeId)
        })
      }
    } else {
      // Delete all nodes in the group first
      const group = groups.find((g: any) => g.id === groupId)
      if (group) {
        group.nodeIds.forEach((nodeId: any) => {
          removeNode(nodeId)
        })
      }
    }

    // Delete the group
    removeGroup(groupId)

    // Clean up stored positions for this group
    setGroupNodePositions(prev => {
      const newPositions = { ...prev }
      delete newPositions[groupId]
      return newPositions
    })

    setDeletingGroupId(null)
  }

  const handleGroupDeleteCancel = () => {
    setDeletingGroupId(null)
  }

  // Tab bar handlers
  const handleTabSelect = (graphId: string) => {
    // Don't do anything if we're selecting the current graph
    if (graphId === currentGraphId) return

    const currentGraph = getCurrentGraph()
    const workflowId = useWorkflowStore.getState().workflowId

    // Always save current graph state before switching (in memory, not to storage)
    if (currentGraph) {
      // Save canvas state to store
      updateCanvasState(currentGraph.id, {
        offset: canvasOffset,
        zoom: canvasZoom,
      })

      // Save canvas state to user preferences for persistence
      if (workflowId) {
        UserPreferencesService.updateCanvasState(workflowId, currentGraph.id, {
          zoom: canvasZoom,
          offset: canvasOffset,
        })
      }

      // Save workflow state
      const workflowState = {
        nodes: storeNodes,
        connections: connections,
        groups: groups,
        triggerConfig: currentGraph.isMain ? workflowTrigger : null,
        portPositions: {}, // TODO: Implement port positions tracking
      }
      // State is automatically saved in CRDT
      updateWorkflowState(currentGraph.id, workflowState)
    }

    // Switch to new graph
    switchGraph(graphId)

    // Save active tab preference
    if (workflowId) {
      UserPreferencesService.updateActiveGraphId(workflowId, graphId)
    }

    // Restore canvas state for the new graph from user preferences
    let targetGraphCanvasState = null
    if (workflowId) {
      targetGraphCanvasState = UserPreferencesService.getCanvasState(workflowId, graphId)
    }

    // Fall back to local state if no preferences saved
    if (!targetGraphCanvasState) {
      targetGraphCanvasState = graphCanvasStates[graphId]
    }

    if (targetGraphCanvasState) {
      setCanvasOffset(targetGraphCanvasState.offset)
      setCanvasZoom(targetGraphCanvasState.zoom)
    } else {
      // Default canvas state if none saved
      setCanvasOffset({ x: 0, y: 0 })
      setCanvasZoom(1)
    }
  }

  const handleTabClose = (graphId: string) => {
    const graph = graphs.find((g: { id: string }) => g.id === graphId)
    if (graph?.isMain) {
      // Can't close main graph
      return
    }

    // Check if this graph has unsaved changes
    if (graph?.isDirty) {
      handleNavigationWithCheck(() => {
        if (removeGraph(graphId)) {
          // Graph was removed successfully
        }
      }, graph.name)
    } else {
      if (removeGraph(graphId)) {
        // Graph was removed successfully
      }
    }
  }

  const handleTabAdd = () => {
    const currentGraph = getCurrentGraph()

    // Save current graph state before adding new graph (in memory, not to storage)
    if (currentGraph) {
      const workflowState = {
        nodes: storeNodes,
        connections: connections,
        groups: groups,
        triggerConfig: currentGraph.isMain ? workflowTrigger : null,
        portPositions: {}, // TODO: Implement port positions tracking
      }
      // State is automatically saved in CRDT
      updateWorkflowState(currentGraph.id, workflowState)
      updateCanvasState(currentGraph.id, {
        offset: canvasOffset,
        zoom: canvasZoom,
      })
    }

    const newGraphId = addGraph(`Graph ${graphs.length + 1}`)
    switchGraph(newGraphId)
  }

  const handleTabRename = (graphId: string, newName: string) => {
    renameGraph(graphId, newName)
  }

  const handleSetMainTab = (graphId: string) => {
    setMainGraph(graphId)
  }

  const handlePortDragStart = useCallback((nodeId: string, portId: string, portType: 'input' | 'output') => {
    // TODO: Re-implement port positions in V2
    const portPosition = getStoredPortPosition(nodeId, portId) // Using old store method temporarily

    if (portPosition) {
      startDrag(nodeId, portId, portType, {
        x: portPosition.x,
        y: portPosition.y,
      })
    } else {
      // If port position isn't available yet, try again after a short delay
      setTimeout(() => {
        const delayedPosition = getStoredPortPosition(nodeId, portId) // Using old store method temporarily
        if (delayedPosition) {
          startDrag(nodeId, portId, portType, {
            x: delayedPosition.x,
            y: delayedPosition.y,
          })
        }
      }, 100)
    }
  }, [getStoredPortPosition, startDrag])

  const handlePortDragEnd = useCallback((nodeId: string, portId: string, portType: 'input' | 'output') => {
    // Only process if we're currently dragging
    if (dragState.isDragging) {
      const newConnection = endDrag(nodeId, portId, portType)
      if (newConnection) {
        // New connections start in pending state by default
        addConnection(newConnection)
        // Mark graph as dirty when connections are created
        setGraphDirty(currentGraphId, true)
      }
    }
  }, [dragState.isDragging, endDrag, addConnection, setGraphDirty, currentGraphId])

  // Selection handlers
  const startSelection = (point: { x: number; y: number }) => {
    setSelectionBounds({ start: point, end: point })
    setSelection({
      isSelecting: true,
      selectionStart: point,
      selectionEnd: point,
      selectedNodeIds: [],
      dragSelecting: true,
    })
    setSelectedNodes([])
  }

  const updateSelection = (point: { x: number; y: number }) => {
    if (selectionBounds) {
      setSelectionBounds({ ...selectionBounds, end: point })

      // Calculate which nodes are in the selection bounds
      const minX = Math.min(selectionBounds.start.x, point.x)
      const maxX = Math.max(selectionBounds.start.x, point.x)
      const minY = Math.min(selectionBounds.start.y, point.y)
      const maxY = Math.max(selectionBounds.start.y, point.y)

      const selectedIds = storeNodes
        .filter((node: { position: { x: any; y: any } }) => {
          const nodeX = node.position.x
          const nodeY = node.position.y
          return nodeX >= minX && nodeX <= maxX && nodeY >= minY && nodeY <= maxY
        })
        .map((node: { metadata: { id: any } }) => node.metadata.id)

      setSelectedNodes(selectedIds)
      setSelection(prev => ({
        ...prev,
        selectionEnd: point,
        selectedNodeIds: selectedIds,
      }))
    }
  }

  const endSelection = () => {
    const hasSelectedNodes = selection.selectedNodeIds.length > 0
    setSelectionBounds(null)
    setSelection(prev => ({
      ...prev,
      isSelecting: false,
      selectionStart: null,
      selectionEnd: null,
      dragSelecting: false,
    }))
    return hasSelectedNodes
  }

  const clearSelection = () => {
    setSelectedNodes([])
    setSelectionBounds(null)
    setSelection({
      isSelecting: false,
      selectionStart: null,
      selectionEnd: null,
      selectedNodeIds: [],
      dragSelecting: false,
    })
  }

  const isNodeSelected = useCallback(
    (nodeId: string) => {
      return selectedNodeIds.includes(nodeId) || selection.selectedNodeIds.includes(nodeId)
    },
    [selectedNodeIds, selection.selectedNodeIds]
  )

  // Handle connection click for deletion
  const handleConnectionClick = (connectionId: string) => {
    setConnectionToDelete(connectionId)
    setDeleteDialogOpen(true)
  }

  // Confirm connection deletion
  const handleDeleteConnection = () => {
    if (connectionToDelete) {
      removeConnection(connectionToDelete)
      // Mark graph as dirty when connections are deleted
      setGraphDirty(currentGraphId, true)
      setConnectionToDelete(null)
      setDeleteDialogOpen(false)
    }
  }

  // Cancel connection deletion
  const handleCancelDelete = () => {
    setConnectionToDelete(null)
    setDeleteDialogOpen(false)
  }

  // Handle mouse move for drag line
  useEffect(() => {
    if (!dragState.isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = document.querySelector('.relative.w-full.h-full.overflow-hidden')
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        // Account for canvas offset and zoom
        updateDrag({
          x: (e.clientX - rect.left - canvasOffset.x) / canvasZoom,
          y: (e.clientY - rect.top - canvasOffset.y) / canvasZoom,
        })
      }
    }

    const handleMouseUp = () => {
      endDrag(null, null, null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState.isDragging, canvasOffset, canvasZoom, updateDrag, endDrag])

  // Keyboard shortcuts for testing connection states and undo/redo
  useEffect(() => {
    // Detect if user is on macOS
    const isMac = navigator.userAgent.toUpperCase().indexOf('MAC') >= 0

    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts if user is typing in an input field
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Press '1', '2', '3', '4' to set the first connection to different states
      if (['1', '2', '3', '4'].includes(e.key) && connections.length > 0) {
        const states: ('pending' | 'warning' | 'error' | 'success')[] = [
          'pending',
          'warning',
          'error',
          'success',
        ]
        const stateIndex = parseInt(e.key) - 1
        const firstConnectionId = connections[0].id
        updateConnectionState(firstConnectionId, states[stateIndex])
      }

      // Check for the appropriate modifier key based on platform
      const hasModifier = isMac ? e.metaKey : e.ctrlKey

      // Undo/Redo shortcuts (Cmd+Z / Cmd+Shift+Z on Mac, Ctrl+Z / Ctrl+Shift+Z on Windows/Linux)
      if (hasModifier) {
        // Undo/redo not yet implemented in new store
        // if (e.key === "z" && !e.shiftKey) {
        //   e.preventDefault();
        //   undo();
        // } else if (e.key === "z" && e.shiftKey) {
        //   e.preventDefault();
        //   redo();
        // }

        // Select All (Cmd+A / Ctrl+A)
        if (e.key === 'a' && !e.shiftKey) {
          e.preventDefault()
          const allNodeIds = storeNodes.map((node: { metadata: { id: any } }) => node.metadata.id)
          setSelectedNodes(allNodeIds)
          setSelection(prev => ({
            ...prev,
            selectedNodeIds: allNodeIds,
            isSelecting: false,
            selectionStart: null,
            selectionEnd: null,
            dragSelecting: false,
          }))
        }

        // Group selected nodes (Cmd+G on Mac, Ctrl+G on Windows/Linux)
        if (e.key === 'g' && !e.shiftKey) {
          e.preventDefault()
          if (selectedNodeIds.length > 0 || selection.selectedNodeIds.length > 0) {
            setIsGroupCreationModalOpen(true)
          }
        }

        // Ctrl/Cmd + E: Create empty group at center of viewport
        if (e.key === 'e' && !e.shiftKey) {
          e.preventDefault()
          // Calculate center of viewport in canvas coordinates
          const centerX = (-canvasOffset.x + viewportSize.width / 2) / canvasZoom
          const centerY = (-canvasOffset.y + viewportSize.height / 2) / canvasZoom
          handleCreateEmptyGroup({ x: centerX, y: centerY })
        }
      }

      // Clear selection with Escape
      if (e.key === 'Escape') {
        e.preventDefault()
        clearSelection()
      }

      // Delete selected nodes with Delete/Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        const nodesToDelete =
          selectedNodeIds.length > 0 ? selectedNodeIds : selection.selectedNodeIds
        if (nodesToDelete.length > 0) {
          // Remove all selected nodes
          nodesToDelete.forEach(nodeId => {
            removeNode(nodeId)
          })
          // Clear selection after deletion
          clearSelection()
          // Mark graph as dirty
          setGraphDirty(currentGraphId, true)
        }
      }

      // Other keyboard shortcuts (Cmd+Shift+...)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        // Cmd+Shift+P to simulate published workflows (for testing)
        if (e.key === 'p') {
          e.preventDefault()
          simulatePublishedWorkflows()
          ToastManager.info('Simulated published workflows created')
        }

        // Cmd+Shift+E to clear environment variable storage (for testing)
        if (e.key === 'e') {
          e.preventDefault()
          EnvVarService.clearStorage()
          // Clear configured vars in store
          useEnvVarStore.getState().updateConfiguredVars([])
          ToastManager.info('Environment variable storage cleared')
        }

        // Cmd+Shift+D to clear dirty state on all graphs (for debugging)
        if (e.key === 'd') {
          e.preventDefault()
          graphs.forEach((graph: { id: string }) => {
            setGraphDirty(graph.id, false)
          })
          ToastManager.info('Cleared dirty state on all graphs')
        }

        // Cmd+Shift+C to create test connection (for debugging)
        if (e.key === 'c') {
          e.preventDefault()
          if (storeNodes.length >= 2) {
            const firstNode = storeNodes[0]
            const secondNode = storeNodes[1]

            // Create a test connection between first two nodes
            const testConnection = {
              id: `test-conn-${Date.now()}`,
              source: {
                nodeId: firstNode.metadata.id,
                portId: firstNode.metadata.ports?.[0]?.id || 'test-out',
              },
              target: {
                nodeId: secondNode.metadata.id,
                portId: secondNode.metadata.ports?.[0]?.id || 'test-in',
              },
              state: 'pending' as const,
            }

            addConnection(testConnection)
            ToastManager.info('Test connection created')
          } else {
            ToastManager.error('Need at least 2 nodes to create a test connection')
          }
        }

        // Cmd+Shift+R to manually resize all groups (for debugging)
        if (e.key === 'r') {
          e.preventDefault()
          groups.forEach((group: any) => {
            // TODO: Re-implement autoResizeGroup in V2
            // autoResizeGroup(group.id)
          })
          ToastManager.info(`Resized ${groups.length} groups`)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [connections /**undo, redo**/])

  // Track mouse movement for collaborative cursors
  // NOTE: Disabled because cursor tracking is handled by InteractiveCanvas onMouseMove
  useEffect(() => {
    return // Disabled - using InteractiveCanvas instead
    if (!isCollaborative) return

    const handleMouseMove = (e: MouseEvent) => {
      // Find the canvas container
      const canvas = document.querySelector('[data-canvas="true"]') as HTMLElement
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        // Convert mouse position to world coordinates
        // The formula is: (mousePos - canvasPos - offset) / zoom
        const worldX = (e.clientX - rect.left - canvasOffset.x) / canvasZoom
        const worldY = (e.clientY - rect.top - canvasOffset.y) / canvasZoom

        const cursorUpdate = {
          cursor: {
            x: worldX,
            y: worldY,
            graphId: currentGraphId,
          },
        }
        // [CursorTracking] Sending cursor update
        updateCursorPosition({ x: e.clientX, y: e.clientY })
      }
    }

    // Use requestAnimationFrame for smooth cursor updates
    let rafId: number | null = null
    const throttledMouseMove = (e: MouseEvent) => {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          handleMouseMove(e)
          rafId = null
        })
      }
    }

    window.addEventListener('mousemove', throttledMouseMove)
    return () => {
      window.removeEventListener('mousemove', throttledMouseMove)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isCollaborative, updateCursorPosition, canvasOffset, canvasZoom, currentGraphId])

  return (
    <main className="flex h-screen flex-col bg-gray-50 overflow-hidden">
      {/* Loading Overlay */}
      {isLoading && <LoadingOverlay message={loadingMessage} />}

      {/* Header */}
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
                  // Find and click the trigger manager button to open the modal
                  const triggerButton = document.querySelector(
                    '[title="Edit Trigger"]'
                  ) as HTMLButtonElement
                  if (triggerButton) triggerButton.click()
                }}
                className="flex items-center gap-2 px-3 py-1 bg-purple-100 hover:bg-purple-200 rounded-full transition-colors group"
                title={`${workflowTrigger.name}: ${
                  workflowTrigger.description || 'Click to edit trigger'
                }`}
              >
                <span className="text-xs font-medium text-gray-600">Trigger</span>
                <div className="w-px h-4 bg-purple-300"></div>
                <div className="flex items-center gap-1.5">
                  {workflowTrigger.type === 'rest' ? (
                    <Globe className="w-3 h-3 text-blue-600" />
                  ) : workflowTrigger.type === 'websocket' ? (
                    <Cable className="w-3 h-3 text-green-600" />
                  ) : (
                    <Clock className="w-3 h-3 text-purple-600" />
                  )}
                  <span className="text-xs font-medium text-gray-700">
                    {workflowTrigger.type === 'rest'
                      ? 'HTTP'
                      : workflowTrigger.type === 'websocket'
                        ? 'WebSocket'
                        : workflowTrigger.type === 'scheduler'
                          ? (workflowTrigger.config as any).isOneTime
                            ? 'Once'
                            : (workflowTrigger.config as any).interval
                              ? `Every ${
                                  (workflowTrigger.config as any).interval.value
                                } ${(workflowTrigger.config as any).interval.unit}`
                              : 'Cron'
                          : 'Active'}
                  </span>
                  <Edit2 className="w-3 h-3 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Autosave Indicator and Save Button */}
          <div className="flex items-center gap-2">
            {/* Show save button only when autosave is disabled */}
            {!autosaveEnabled && (
              <button
                onClick={handleSaveWorkflow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            )}

            {/* Autosave Toggle */}
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
              {/* {isCollaborative && <span className="ml-1 text-[10px]">(Required)</span>} */}
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

          {/* Notification Button - only show in collaborative mode */}
          {isCollaborative && <NotificationButton />}

          {/* Share and User Settings moved to Presence Dropdown */}

          {/* Presence Dropdown */}
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
                } catch (error) {
                  // Fallback for older browsers
                  const textArea = document.createElement('textarea')
                  textArea.value = shareUrl
                  textArea.style.position = 'fixed'
                  textArea.style.opacity = '0'
                  document.body.appendChild(textArea)
                  textArea.select()

                  try {
                    document.execCommand('copy')
                    toast.success('Share link copied to clipboard!')
                  } catch (err) {
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

      {/* Tab Bar */}
      <TabBar
        tabs={graphs.map(g => ({
          id: g.id,
          name: g.name,
          isMain: g.isMain,
          isDirty: g.isDirty || false, // Default to false if not set
        }))}
        activeTabId={currentGraphId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onTabAdd={handleTabAdd}
        onTabRename={handleTabRename}
        onSetMainTab={handleSetMainTab}
      />

      {/* Main Content */}
      <div className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          <InteractiveCanvas
            offset={canvasOffset}
            onOffsetChange={handleCanvasOffsetChange}
            zoom={canvasZoom}
            onZoomChange={handleCanvasZoomChange}
            onSelectionStart={startSelection}
            onSelectionUpdate={updateSelection}
            onSelectionEnd={() => {
              const hasSelectedNodes = endSelection()
              // Automatically open group creation modal if nodes were selected
              if (hasSelectedNodes) {
                setIsGroupCreationModalOpen(true)
              }
            }}
            onSelectionClear={clearSelection}
            onMouseMove={point => {
              updateCursorPosition(point)
            }}
            onContextMenu={handleSelectionContextMenu}
          >
            {/* Collaborative Cursors - render first so they appear behind everything */}
            {isCollaborative && (
              <CollaborativeCursors
                presence={presence}
                currentGraphId={currentGraphId}
                canvasOffset={canvasOffset}
                canvasZoom={canvasZoom}
                currentUserId={doc?.clientID}
              />
            )}

            {/* Connection Lines - render before nodes so they appear behind */}
            <ConnectionLines
              connections={connections}
              getPortPosition={getStoredPortPosition}
              onConnectionClick={handleConnectionClick}
              localGroupCollapseState={localGroupCollapseState}
            />

            {/* Drag connection line */}
            {dragState.isDragging &&
              dragState.sourceNodeId &&
              dragState.sourcePortId &&
              dragState.currentPosition &&
              (() => {
                const sourcePos = getStoredPortPosition(
                  dragState.sourceNodeId,
                  dragState.sourcePortId
                ) // Using old store method temporarily
                return sourcePos ? (
                  <DragConnectionLine
                    sourcePosition={sourcePos}
                    currentPosition={dragState.currentPosition}
                  />
                ) : null
              })()}

            {/* Node Groups - render before nodes so they appear behind - Only render when CRDT is in stable state */}
            {shouldRenderNodes &&
              groups.map((group: any) => {
                // Debug log group rendering
                // 🔷GROUPOPS PAGE-RENDER: Rendering group

                // Ensure group has required properties before rendering
                if (!group.id) {
                  return null
                }

                // Get nodes that belong to this group from memoized calculation
                const groupNodes = groupNodesByGroupId[group.id] || []

                // Use local size if available, otherwise use CRDT size
                const localSize = expandedGroupSizes[group.id]

                // Create a plain object with the group data
                const groupToRender = {
                  id: group.id,
                  title: group.title,
                  description: group.description,
                  position: group.position,
                  size: localSize || group.size,
                  color: group.color,
                  nodeIds: group.nodeIds,
                  nodePositions: group.nodePositions,
                  isCollapsed: group.isCollapsed,
                  createdAt: group.createdAt,
                  updatedAt: group.updatedAt,
                }

                return (
                  <React.Fragment key={group.id}>
                    <NodeGroupContainer
                      group={groupToRender}
                      isCollapsed={localGroupCollapseState[group.id] || false}
                      onCollapseToggle={handleGroupCollapseToggle}
                      isDropTarget={nodeHoveringGroupId === group.id}
                      onEditClick={handleGroupEditClick}
                      onDeleteClick={handleGroupDeleteClick}
                      zoom={canvasZoom}
                      nodePositions={groupNodePositions[group.id] || {}}
                      nodeBounds={nodeBounds}
                      onGroupResize={handleGroupResize}
                      onContainerReady={handleContainerReady}
                    >
                      {/* Render nodes that belong to this group - only if group is fully loaded */}
                      <GroupNodes
                        group={group}
                        groupNodes={groupNodes}
                        groupNodePositions={groupNodePositions}
                        readyGroupContainers={readyGroupContainers}
                        newlyCreatedGroups={newlyCreatedGroups}
                        canvasZoom={canvasZoom}
                        handleNodePositionInGroup={handleNodePositionInGroup}
                        updateNodeBoundsHook={updateNodeBoundsHook}
                        oldUpdatePortPosition={oldUpdatePortPosition}
                        handlePortDragStart={handlePortDragStart}
                        handlePortDragEnd={handlePortDragEnd}
                        handleNodeSelect={handleNodeSelect}
                        isNodeSelected={isNodeSelected}
                        handleNodeDropIntoGroup={handleNodeDropIntoGroup}
                        handleNodeHoverGroup={handleNodeHoverGroup}
                        groups={groups}
                        handleNodePropertyChange={handleNodePropertyChange}
                        handleNodeDragStart={handleNodeDragStart}
                        handleNodeDragEnd={handleNodeDragEnd}
                        highlightedNodeId={highlightedNodeId}
                        updateGroup={updateGroup}
                        setGraphDirty={setGraphDirty}
                        currentGraphId={currentGraphId}
                        getNodeId={getNodeId}
                      />
                    </NodeGroupContainer>

                    {/* Register port positions for collapsed groups */}
                    {localGroupCollapseState[group.id] && (
                      <CollapsedGroupPortHandler
                        groupId={group.id}
                        groupPosition={group.position}
                        groupSize={group.size}
                        groupNodeIds={group.nodeIds}
                        onPortPositionUpdate={oldUpdatePortPosition}
                      />
                    )}
                  </React.Fragment>
                )
              })}

            {/* Selection Rectangle */}
            {selection.isSelecting && selection.selectionStart && selection.selectionEnd && (
              <SelectionRectangle
                startPoint={selection.selectionStart}
                endPoint={selection.selectionEnd}
                visible={selection.isSelecting}
              />
            )}

            {/* Ungrouped Workflow Nodes - Only render when CRDT is in stable state */}
            {shouldRenderNodes && (
              <UngroupedNodes
                storeNodes={storeNodes}
                groups={groups}
                initialized={initialized}
                handlePortDragStart={handlePortDragStart}
                handlePortDragEnd={handlePortDragEnd}
                handleNodeSelect={handleNodeSelect}
                isNodeSelected={isNodeSelected}
                handleNodeDropIntoGroup={handleNodeDropIntoGroup}
                handleNodeHoverGroup={handleNodeHoverGroup}
                canvasZoom={canvasZoom}
                handleNodePositionChange={handleNodePositionChange}
                handleNodePropertyChange={handleNodePropertyChange}
                handleNodeDragStart={handleNodeDragStart}
                handleNodeDragEnd={handleNodeDragEnd}
                highlightedNodeId={highlightedNodeId}
                getNodeId={getNodeId}
                updateNodeBoundsHook={updateNodeBoundsHook}
                oldUpdatePortPosition={oldUpdatePortPosition}
              />
            )}

            {/* Selection Rectangle */}
            {selection.isSelecting && selection.selectionStart && selection.selectionEnd && (
              <SelectionRectangle
                startPoint={selection.selectionStart}
                endPoint={selection.selectionEnd}
                visible={selection.isSelecting}
              />
            )}
          </InteractiveCanvas>

          {/* Floating UI Components */}
          <WorkflowSidebar
            isCollapsed={isSidebarCollapsed}
            onCategoryClick={handleCategoryClick}
            // onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />

          <SearchButton onClick={() => setIsSearchOpen(true)} />
          <NodeBrowserButton onClick={handleNodeBrowserToggle} isActive={isNodeBrowserOpen} />
          <TriggerManager />
          <UndoRedoButtons onUndo={() => {}} onRedo={() => {}} canUndo={false} canRedo={false} />
          <WorkflowBottomToolbar
            onHistoryClick={() => setIsHistoryBrowserOpen(true)}
            onDebuggerClick={() => setIsFlowTracerOpen(true)}
            onCreateEmptyGroupClick={() => {
              // Calculate center of viewport in canvas coordinates
              const centerX = (-canvasOffset.x + viewportSize.width / 2) / canvasZoom
              const centerY = (-canvasOffset.y + viewportSize.height / 2) / canvasZoom
              handleCreateEmptyGroup({ x: centerX, y: centerY })
            }}
            onConfigClick={async () => {
              // Fetch env vars when opening configuration
              await updateConfiguredEnvVars()
              setIsConfigOpen(true)
            }}
            onAddSubgraphClick={() => {
              setSelectedCategory(null) // Reset category
              setSearchModalInitialTab('subgraphs') // Open to subgraphs tab
              setIsSearchOpen(true)
            }}
          />

          <Minimap
            canvasOffset={canvasOffset}
            nodes={(() => {
              const minimapNodes = storeNodes.map((node: any) => {
                const nodeId = getNodeId(node)

                // Check if node is in a group
                const parentGroup = groups.find((g: { nodeIds: string | string[] }) =>
                  g.nodeIds?.includes(nodeId)
                )

                let visualPosition = node.position || { x: 0, y: 0 }

                // If node is in a group and we have a local position stored, calculate the absolute visual position
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
                  size: { width: 200, height: 80 }, // Default node size
                }
              })

              return minimapNodes
            })()}
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

          <ZoomControls
            zoom={canvasZoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
          />

          {/* Save Graph Button */}
          <SaveGraphButton
            isVisible={getCurrentGraph()?.isDirty || false}
            graphName={getCurrentGraph()?.name || ''}
            onSave={handleSaveGraph}
            isSaving={isSavingGraph}
          />

          {/* CRDT Feature Indicator */}
          {/* <CRDTFeatureIndicator isCollaborative={isCollaborative} /> */}
        </div>

        {/* Node Browser Panel */}
        {isNodeBrowserOpen && (
          <div className="fixed inset-0 z-10" onClick={handleNodeBrowserToggle} />
        )}
        <NodeBrowserPanel
          isExpanded={isNodeBrowserOpen}
          onNodeSelect={handleNodeSelectFromBrowser}
          onNodeAdded={handleNodeAdded}
          onGroupCreationRequest={() => setIsGroupCreationModalOpen(true)}
        />

        {/* Property Pane */}
        {isPropertyPaneVisible && (
          <>
            {/* Backdrop */}
            <div
              className={`fixed inset-0 z-30 bg-black/20 transition-opacity duration-300 ${
                isPropertyPaneClosing ? 'opacity-0' : 'opacity-100'
              }`}
              onClick={handlePropertyPaneClose}
            />
            {/* Property Pane */}
            <div className="fixed right-0 top-0 h-full z-55">
              <PropertyPane
                selectedNodeId={selectedNodeId}
                onClose={handlePropertyPaneClose}
                isClosing={isPropertyPaneClosing}
              />
            </div>
          </>
        )}
      </div>

      {/* Search Modal */}
      <ModalPortal isOpen={isSearchOpen}>
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => {
            setIsSearchOpen(false)
            setSelectedCategory(null) // Reset category selection
            setSearchModalInitialTab(undefined) // Reset tab selection
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
        onViewFlowTrace={workflowId => {
          setIsHistoryBrowserOpen(false)
          setIsFlowTracerOpen(true)
          // In production, you would load flow traces for the specific workflow
          ToastManager.info(`Viewing flow traces for workflow ${workflowId}`)
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
          // Update the user button display
          setUserName(newUserName)
          setIsUserSettingsOpen(false)

          const store = (window as any).__zealStore
          if (store && typeof store === 'function') {
            const state = store()

            // Update presence if in collaborative mode
            if (isCollaborative && store.updatePresence) {
              store.updatePresence({
                userId: sessionStorage.getItem('userId') || 'anonymous',
                userName: userName,
                userColor: userColor,
              })
            }
          }
        }}
      />

      {/* Notification Panel - only show in collaborative mode */}
      {isCollaborative && <NotificationPanel />}

      {/* Test Notifications - Temporary for debugging */}
      {/* {isCollaborative && <TestNotifications />} */}

      {/* Debug Panel - Temporary for debugging graph issues */}
      {/* <GraphDebugPanel /> */}
    </main>
  )
}
