import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

interface GraphInfo {
  id: string
  name: string
  namespace: string
  isMain: boolean
  isDirty?: boolean
  canvasState?: {
    offset: { x: number; y: number }
    zoom: number
  }
  workflowState?: {
    nodes: any[]
    connections: any[]
    groups: any[]
    triggerConfig: any
    portPositions?: Map<
      string,
      {
        nodeId: string
        portId: string
        x: number
        y: number
        position: 'top' | 'right' | 'bottom' | 'left'
      }
    >
  }
}

interface GraphState {
  graphs: GraphInfo[]
  currentGraphId: string
}

interface GraphActions {
  // Graph management
  addGraph: (name: string, isMain?: boolean, id?: string, namespace?: string) => string
  removeGraph: (graphId: string) => boolean
  switchGraph: (graphId: string) => void
  renameGraph: (graphId: string, newName: string) => void
  setMainGraph: (graphId: string) => void
  setGraphDirty: (graphId: string, isDirty: boolean) => void
  updateCanvasState: (
    graphId: string,
    canvasState: { offset: { x: number; y: number }; zoom: number }
  ) => void
  updateWorkflowState: (
    graphId: string,
    workflowState: {
      nodes: any[]
      connections: any[]
      groups: any[]
      triggerConfig: any
      portPositions?: Map<
        string,
        {
          nodeId: string
          portId: string
          x: number
          y: number
          position: 'top' | 'right' | 'bottom' | 'left'
        }
      >
    }
  ) => void
  loadGraphs: (graphs: GraphInfo[], currentGraphId?: string) => void

  // Getters
  getCurrentGraph: () => GraphInfo | null
  getMainGraph: () => GraphInfo | null
  getGraphById: (graphId: string) => GraphInfo | null
}

type GraphStore = GraphState & GraphActions

export const useGraphStore = create<GraphStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state with main graph
    graphs: [
      {
        id: 'main',
        name: 'Main',
        namespace: 'main',
        isMain: true,
        isDirty: false,
        canvasState: { offset: { x: 0, y: 0 }, zoom: 1 },
      },
    ],
    currentGraphId: 'main',

    // Graph management actions
    addGraph: (name: string, isMain = false, id?: string, namespace?: string) => {
      const graphId = id || `graph-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      const graphNamespace = namespace || name.toLowerCase().replace(/\s+/g, '-')

      const newGraph: GraphInfo = {
        id: graphId,
        name,
        namespace: graphNamespace,
        isMain,
        isDirty: false,
        canvasState: { offset: { x: 0, y: 0 }, zoom: 1 },
      }

      set(state => ({
        graphs: [...state.graphs, newGraph],
      }))

      return graphId
    },

    removeGraph: (graphId: string) => {
      const state = get()

      // Can't remove the last graph or main graph
      if (state.graphs.length <= 1) return false
      const graphToRemove = state.graphs.find(g => g.id === graphId)
      if (!graphToRemove || graphToRemove.isMain) return false

      const newGraphs = state.graphs.filter(g => g.id !== graphId)
      const newCurrentId = state.currentGraphId === graphId ? newGraphs[0].id : state.currentGraphId

      set({
        graphs: newGraphs,
        currentGraphId: newCurrentId,
      })

      return true
    },

    switchGraph: (graphId: string) => {
      const state = get()
      const targetGraph = state.graphs.find(g => g.id === graphId)
      if (!targetGraph) return

      set({ currentGraphId: graphId })
    },

    renameGraph: (graphId: string, newName: string) => {
      set(state => ({
        graphs: state.graphs.map(g =>
          g.id === graphId
            ? { ...g, name: newName, namespace: newName.toLowerCase().replace(/\s+/g, '-') }
            : g
        ),
      }))
    },

    setMainGraph: (graphId: string) => {
      set(state => ({
        graphs: state.graphs.map(g => ({
          ...g,
          isMain: g.id === graphId,
        })),
      }))
    },

    setGraphDirty: (graphId: string, isDirty: boolean) => {
      set(state => ({
        graphs: state.graphs.map(g => (g.id === graphId ? { ...g, isDirty } : g)),
      }))
    },

    updateCanvasState: (
      graphId: string,
      canvasState: { offset: { x: number; y: number }; zoom: number }
    ) => {
      set(state => ({
        graphs: state.graphs.map(g => (g.id === graphId ? { ...g, canvasState } : g)),
      }))
    },

    updateWorkflowState: (
      graphId: string,
      workflowState: { nodes: any[]; connections: any[]; groups: any[]; triggerConfig: any }
    ) => {
      set(state => ({
        graphs: state.graphs.map(g => (g.id === graphId ? { ...g, workflowState } : g)),
      }))
    },

    loadGraphs: (graphs: GraphInfo[], currentGraphId?: string) => {
      // Ensure at least one graph exists and has a main graph
      const validGraphs =
        graphs.length > 0
          ? graphs
          : [
              {
                id: 'main',
                name: 'Main',
                namespace: 'main',
                isMain: true,
                isDirty: false,
                canvasState: { offset: { x: 0, y: 0 }, zoom: 1 },
              },
            ]

      // Ensure there's exactly one main graph
      const hasMainGraph = validGraphs.some(g => g.isMain)
      if (!hasMainGraph) {
        validGraphs[0].isMain = true
      }

      set({
        graphs: validGraphs,
        currentGraphId: currentGraphId || validGraphs.find(g => g.isMain)?.id || validGraphs[0].id,
      })
    },

    // Getters
    getCurrentGraph: () => {
      const state = get()
      return state.graphs.find(g => g.id === state.currentGraphId) || null
    },

    getMainGraph: () => {
      const state = get()
      return state.graphs.find(g => g.isMain) || null
    },

    getGraphById: (graphId: string) => {
      const state = get()
      return state.graphs.find(g => g.id === graphId) || null
    },
  }))
)
