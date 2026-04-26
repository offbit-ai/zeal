/**
 * Workflow UI Store — transient page-level UI state for the workflow editor.
 *
 * Holds modal toggles, selection/highlight state, canvas viewport, loading
 * status, and other ephemeral concerns that previously lived as local
 * `useState` calls inside `app/workflow/page.tsx`.
 *
 * Each piece of state exposes a setter with the same shape as the original
 * `useState` setter so call sites stay identical:
 *   const isSearchOpen = useWorkflowUIStore(s => s.isSearchOpen)
 *   const setIsSearchOpen = useWorkflowUIStore(s => s.setIsSearchOpen)
 */

import { create } from 'zustand'

type Pos = { x: number; y: number }

type SearchModalTab = 'repository' | 'custom' | 'subgraphs' | undefined

type SelectionContextMenuState = {
  isVisible: boolean
  position: Pos
}

type CanvasState = {
  offset: Pos
  zoom: number
}

interface WorkflowUIState {
  // Layout / sidebar
  isSidebarCollapsed: boolean
  setIsSidebarCollapsed: (v: boolean) => void

  // Modals & panels
  isSearchOpen: boolean
  setIsSearchOpen: (v: boolean) => void
  isNodeBrowserOpen: boolean
  setIsNodeBrowserOpen: (v: boolean) => void
  isHistoryBrowserOpen: boolean
  setIsHistoryBrowserOpen: (v: boolean) => void
  isFlowTracerOpen: boolean
  setIsFlowTracerOpen: (v: boolean) => void
  isConfigOpen: boolean
  setIsConfigOpen: (v: boolean) => void
  isGroupCreationModalOpen: boolean
  setIsGroupCreationModalOpen: (v: boolean) => void
  isEmptyGroupModalOpen: boolean
  setIsEmptyGroupModalOpen: (v: boolean) => void
  isUserSettingsOpen: boolean
  setIsUserSettingsOpen: (v: boolean) => void

  // Search modal config
  selectedCategory: string | null
  setSelectedCategory: (v: string | null) => void
  searchModalInitialTab: SearchModalTab
  setSearchModalInitialTab: (v: SearchModalTab) => void

  // Property pane animation
  isPropertyPaneOpen: boolean
  setIsPropertyPaneOpen: (v: boolean) => void
  isPropertyPaneVisible: boolean
  setIsPropertyPaneVisible: (v: boolean) => void
  isPropertyPaneClosing: boolean
  setIsPropertyPaneClosing: (v: boolean) => void

  // Loading
  isLoading: boolean
  setIsLoading: (v: boolean) => void
  loadingMessage: string
  setLoadingMessage: (v: string) => void
  autosaveEnabled: boolean
  setAutosaveEnabled: (v: boolean) => void

  // User context (transient)
  userName: string
  setUserName: (v: string) => void

  // Selection & highlight
  selectedNodeId: string | null
  setSelectedNodeId: (v: string | null) => void
  highlightedNodeId: string | null
  setHighlightedNodeId: (v: string | null) => void

  // Configuration toast
  showEnvVarWarning: boolean
  setShowEnvVarWarning: (v: boolean) => void
  configurationToastNodeId: string | null
  setConfigurationToastNodeId: (v: string | null) => void

  // Group editing/deleting
  editingGroupId: string | null
  setEditingGroupId: (v: string | null) => void
  deletingGroupId: string | null
  setDeletingGroupId: (v: string | null) => void
  emptyGroupPosition: Pos
  setEmptyGroupPosition: (v: Pos) => void
  nodeHoveringGroupId: string | null
  setNodeHoveringGroupId: (v: string | null) => void

  // Selection context menu
  selectionContextMenu: SelectionContextMenuState
  setSelectionContextMenu: (v: SelectionContextMenuState) => void

  // Canvas viewport
  canvasOffset: Pos
  setCanvasOffset: (v: Pos | ((prev: Pos) => Pos)) => void
  canvasZoom: number
  setCanvasZoom: (v: number | ((prev: number) => number)) => void
  graphCanvasStates: Record<string, CanvasState>
  setGraphCanvasStates: (
    v:
      | Record<string, CanvasState>
      | ((prev: Record<string, CanvasState>) => Record<string, CanvasState>)
  ) => void
}

export const useWorkflowUIStore = create<WorkflowUIState>(set => ({
  // Layout / sidebar
  isSidebarCollapsed: true,
  setIsSidebarCollapsed: v => set({ isSidebarCollapsed: v }),

  // Modals & panels
  isSearchOpen: false,
  setIsSearchOpen: v => set({ isSearchOpen: v }),
  isNodeBrowserOpen: false,
  setIsNodeBrowserOpen: v => set({ isNodeBrowserOpen: v }),
  isHistoryBrowserOpen: false,
  setIsHistoryBrowserOpen: v => set({ isHistoryBrowserOpen: v }),
  isFlowTracerOpen: false,
  setIsFlowTracerOpen: v => set({ isFlowTracerOpen: v }),
  isConfigOpen: false,
  setIsConfigOpen: v => set({ isConfigOpen: v }),
  isGroupCreationModalOpen: false,
  setIsGroupCreationModalOpen: v => set({ isGroupCreationModalOpen: v }),
  isEmptyGroupModalOpen: false,
  setIsEmptyGroupModalOpen: v => set({ isEmptyGroupModalOpen: v }),
  isUserSettingsOpen: false,
  setIsUserSettingsOpen: v => set({ isUserSettingsOpen: v }),

  // Search modal config
  selectedCategory: null,
  setSelectedCategory: v => set({ selectedCategory: v }),
  searchModalInitialTab: undefined,
  setSearchModalInitialTab: v => set({ searchModalInitialTab: v }),

  // Property pane animation
  isPropertyPaneOpen: false,
  setIsPropertyPaneOpen: v => set({ isPropertyPaneOpen: v }),
  isPropertyPaneVisible: false,
  setIsPropertyPaneVisible: v => set({ isPropertyPaneVisible: v }),
  isPropertyPaneClosing: false,
  setIsPropertyPaneClosing: v => set({ isPropertyPaneClosing: v }),

  // Loading
  isLoading: true,
  setIsLoading: v => set({ isLoading: v }),
  loadingMessage: 'Initializing workflow...',
  setLoadingMessage: v => set({ loadingMessage: v }),
  autosaveEnabled: true,
  setAutosaveEnabled: v => set({ autosaveEnabled: v }),

  // User context (transient)
  userName: 'Anonymous',
  setUserName: v => set({ userName: v }),

  // Selection & highlight
  selectedNodeId: null,
  setSelectedNodeId: v => set({ selectedNodeId: v }),
  highlightedNodeId: null,
  setHighlightedNodeId: v => set({ highlightedNodeId: v }),

  // Configuration toast
  showEnvVarWarning: false,
  setShowEnvVarWarning: v => set({ showEnvVarWarning: v }),
  configurationToastNodeId: null,
  setConfigurationToastNodeId: v => set({ configurationToastNodeId: v }),

  // Group editing/deleting
  editingGroupId: null,
  setEditingGroupId: v => set({ editingGroupId: v }),
  deletingGroupId: null,
  setDeletingGroupId: v => set({ deletingGroupId: v }),
  emptyGroupPosition: { x: 0, y: 0 },
  setEmptyGroupPosition: v => set({ emptyGroupPosition: v }),
  nodeHoveringGroupId: null,
  setNodeHoveringGroupId: v => set({ nodeHoveringGroupId: v }),

  // Selection context menu
  selectionContextMenu: { isVisible: false, position: { x: 0, y: 0 } },
  setSelectionContextMenu: v => set({ selectionContextMenu: v }),

  // Canvas viewport — supports both value and updater forms (mirrors useState)
  canvasOffset: { x: 0, y: 0 },
  setCanvasOffset: v =>
    set(state => ({
      canvasOffset: typeof v === 'function' ? (v as (prev: Pos) => Pos)(state.canvasOffset) : v,
    })),
  canvasZoom: 1,
  setCanvasZoom: v =>
    set(state => ({
      canvasZoom: typeof v === 'function' ? (v as (prev: number) => number)(state.canvasZoom) : v,
    })),
  graphCanvasStates: {},
  setGraphCanvasStates: v =>
    set(state => ({
      graphCanvasStates:
        typeof v === 'function'
          ? (v as (prev: Record<string, CanvasState>) => Record<string, CanvasState>)(
              state.graphCanvasStates
            )
          : v,
    })),
}))
