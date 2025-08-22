import { GraphRAGEngine } from '../knowledge-graph'
import Graph from 'graphology'
import path from 'path'

interface GraphSnapshot {
  nodes: Array<{
    id: string
    attributes: any
  }>
  edges: Array<{
    source: string
    target: string
    attributes: any
  }>
  metadata: {
    createdAt: string
    templateCount: number
    version: string
  }
}

export async function initializeGraphRAGForOrchestrator(llm: any, embeddings: any) {
  console.log('🚀 Initializing GraphRAG from snapshot...')
  
  try {
    // Load the pre-built snapshot
    const snapshotPath = path.join(process.cwd(), 'data', 'graphrag-snapshot.json')
    
    // In browser environment, fetch from public directory
    let snapshot: GraphSnapshot
    if (typeof window !== 'undefined') {
      // Client-side: fetch from public directory
      const response = await fetch('/graphrag-snapshot.json')
      if (!response.ok) {
        throw new Error('GraphRAG snapshot not found. Build the project first.')
      }
      snapshot = await response.json()
    } else {
      // Server-side: read from file system
      const fs = await import('fs/promises')
      const data = await fs.readFile(snapshotPath, 'utf-8')
      snapshot = JSON.parse(data)
    }
    
    // Rebuild graph from snapshot
    const graph = new Graph({ multi: true, type: 'directed' })
    
    // Add nodes
    snapshot.nodes.forEach(node => {
      graph.addNode(node.id, node.attributes)
    })
    
    // Add edges
    snapshot.edges.forEach(edge => {
      graph.addEdge(edge.source, edge.target, edge.attributes)
    })
    
    console.log(`✅ Loaded GraphRAG snapshot with ${snapshot.metadata.templateCount} templates`)
    
    // Create GraphRAG engine with the loaded graph
    const graphRAG = new GraphRAGEngine(graph, llm, embeddings)
    
    return graphRAG
  } catch (error) {
    console.error('❌ Failed to initialize GraphRAG from snapshot:', error)
    throw error
  }
}