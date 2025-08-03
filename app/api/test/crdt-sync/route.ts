import { NextRequest, NextResponse } from 'next/server'

// This is a test endpoint to verify CRDT sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, workflowId } = body
    
    if (action === 'add-test-node') {
      // In a real implementation, this would trigger a CRDT update
      return NextResponse.json({
        success: true,
        message: 'Test node addition triggered',
        workflowId,
        timestamp: new Date().toISOString()
      })
    }
    
    return NextResponse.json({
      success: false,
      message: 'Unknown action'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'CRDT sync test endpoint',
    info: 'POST to this endpoint with action: "add-test-node" to test'
  })
}