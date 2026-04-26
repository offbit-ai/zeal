'use client'

import { useEffect, useState } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'

export function GraphDebugPanel() {
  const { doc, currentGraphId, graphs, nodes } = useWorkflowStore()
  const [graphData, setGraphData] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!doc) return

    const updateDebugData = () => {
      const data: Record<string, any> = {}

      graphs.forEach(graph => {
        const nodesMap = doc.getMap(`nodes-${graph.id}`)
        const nodesList: any[] = []

        // [GraphDebugPanel] log removed

        nodesMap.forEach((yNode: any, nodeId: string) => {
          const metadata = yNode.get('metadata')
          nodesList.push({
            id: nodeId,
            title: metadata?.title || 'Unknown',
            type: metadata?.type || 'Unknown',
          })
        })

        data[graph.id] = {
          name: graph.name,
          nodeCount: nodesMap.size,
          nodes: nodesList,
        }
      })

      setGraphData(data)
    }

    // Update initially
    updateDebugData()

    // Set up observer for all graph maps
    const observers: (() => void)[] = []
    graphs.forEach(graph => {
      const nodesMap = doc.getMap(`nodes-${graph.id}`)
      const observer = () => updateDebugData()
      nodesMap.observe(observer)
      observers.push(() => nodesMap.unobserve(observer))
    })

    return () => {
      observers.forEach(unobserve => unobserve())
    }
  }, [doc, graphs])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: 'white',
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 16,
        maxWidth: 400,
        maxHeight: 300,
        overflow: 'auto',
        fontSize: 12,
        fontFamily: 'monospace',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        zIndex: 9999,
      }}
    >
      <h3 style={{ margin: '0 0 8px 0' }}>Graph Debug Panel</h3>
      <div>
        Current Graph: <strong>{currentGraphId}</strong>
      </div>
      <div>
        UI Nodes: <strong>{nodes.length}</strong>
      </div>
      <hr style={{ margin: '8px 0' }} />
      <h4 style={{ margin: '8px 0' }}>CRDT Graph Data:</h4>
      {Object.entries(graphData).map(([graphId, data]) => (
        <div
          key={graphId}
          style={{
            marginBottom: 8,
            padding: 8,
            background: graphId === currentGraphId ? '#e3f2fd' : '#f5f5f5',
            borderRadius: 4,
          }}
        >
          <div>
            <strong>{data.name}</strong> ({graphId})
          </div>
          <div>Nodes in CRDT: {data.nodeCount}</div>
          {data.nodes.length > 0 && (
            <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
              {data.nodes.map((node: any) => (
                <li key={node.id}>
                  {node.title} ({node.type})
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
