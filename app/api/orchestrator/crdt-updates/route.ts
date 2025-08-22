import { NextRequest, NextResponse } from 'next/server'
import { ServerCRDTOperations } from '../../../../lib/crdt/server-operations'

// GET /api/orchestrator/crdt-updates?workflowId=xxx&since=timestamp
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const workflowId = searchParams.get('workflowId')
    const since = searchParams.get('since')

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 })
    }

    const sinceTimestamp = since ? parseInt(since) : undefined
    const updates = ServerCRDTOperations.getPendingUpdates(workflowId, sinceTimestamp)

    return NextResponse.json({
      success: true,
      updates,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Error fetching CRDT updates:', error)
    return NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 })
  }
}

// POST /api/orchestrator/crdt-updates/clear
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workflowId } = body

    if (!workflowId) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 })
    }

    ServerCRDTOperations.clearPendingUpdates(workflowId)

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('Error clearing CRDT updates:', error)
    return NextResponse.json({ error: 'Failed to clear updates' }, { status: 500 })
  }
}
