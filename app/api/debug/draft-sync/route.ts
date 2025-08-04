import { NextRequest, NextResponse } from 'next/server'
import * as Y from 'yjs'

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')
  const workflowId = req.nextUrl.searchParams.get('workflowId') || `workflow-${Date.now()}`

  if (action === 'create') {
    // Simulate creating a draft workflow
    const doc = new Y.Doc({ guid: workflowId })
    const graphsMap = doc.getMap('graphs')
    const metadataMap = doc.getMap('metadata')

    // Set up draft workflow
    metadataMap.set('name', 'Test Draft Workflow')
    metadataMap.set('isDraft', true)

    // Add main graph
    graphsMap.set('main', {
      id: 'main',
      name: 'Main',
      isMain: true,
    })

    // Add a test node to main graph
    const nodesMap = doc.getMap('nodes-main')
    nodesMap.set('test-node', {
      id: 'test-node',
      position: { x: 100, y: 100 },
      metadata: { type: 'input', label: 'Test Node' },
    })

    const state = Y.encodeStateAsUpdate(doc)

    return NextResponse.json({
      workflowId,
      stateSize: state.length,
      graphs: Array.from(graphsMap.entries()),
      nodes: Array.from(nodesMap.entries()),
      metadata: {
        name: metadataMap.get('name'),
        isDraft: metadataMap.get('isDraft'),
      },
    })
  }

  if (action === 'check') {
    // Check if workflow exists and has proper structure
    const doc = new Y.Doc({ guid: workflowId })
    const graphsMap = doc.getMap('graphs')
    const metadataMap = doc.getMap('metadata')

    return NextResponse.json({
      workflowId,
      hasGraphs: graphsMap.size > 0,
      graphs: Array.from(graphsMap.entries()),
      metadata: {
        name: metadataMap.get('name'),
        isDraft: metadataMap.get('isDraft'),
      },
    })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
