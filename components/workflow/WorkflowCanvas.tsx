'use client'

import React, { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { WorkflowNode } from './WorkflowNode'

const initialNodes: Node[] = []
const initialEdges: Edge[] = []

const nodeTypes = {
  workflow: WorkflowNode,
}

interface WorkflowCanvasProps {
  className?: string
}

export function WorkflowCanvas({ className }: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const reactFlowBounds = (event.target as Element)
        .closest('.react-flow')
        ?.getBoundingClientRect()

      if (!reactFlowBounds) return

      const type = event.dataTransfer.getData('application/reactflow')
      const label = event.dataTransfer.getData('application/label')
      const description = event.dataTransfer.getData('application/description')
      const config = event.dataTransfer.getData('application/config')

      if (!type) return

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      }

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: 'workflow',
        position,
        data: {
          label,
          nodeType: type,
          description,
          config: config ? JSON.parse(config) : undefined,
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [setNodes]
  )

  const proOptions = useMemo(
    () => ({
      hideAttribution: true,
    }),
    []
  )

  return (
    <div
      className={`workflow-canvas ${className || ''}`}
      data-testid="workflow-canvas"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        proOptions={proOptions}
        fitView
      >
        <Controls
          showZoom={true}
          showFitView={true}
          showInteractive={false}
          position="top-right"
        />
        <MiniMap
          nodeColor="#374151"
          maskColor="rgba(0, 0, 0, 0.1)"
          position="bottom-right"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#E5E7EB"
        />
      </ReactFlow>
    </div>
  )
}