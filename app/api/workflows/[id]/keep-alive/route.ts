import { NextRequest, NextResponse } from 'next/server'
import { ApiError } from '@/types/api'

// POST /api/workflows/[id]/keep-alive - Keep CRDT room alive
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const workflowId = params.id

    // Validate workflow ID format
    if (!workflowId || !workflowId.startsWith('wf_')) {
      throw new ApiError('INVALID_WORKFLOW_ID', 'Invalid workflow ID format', 400)
    }

    // For now, just return success - the CRDT server with persistent rooms will handle this
    // The frontend will keep calling this endpoint to show activity
    // In the future, we can add actual Redis interaction here if needed

    return NextResponse.json({
      success: true,
      data: {
        workflowId,
        roomActive: true,
        ttlExtended: true,
        message: 'Workflow rooms are now persistent and do not require keep-alive',
      },
    })
  } catch (error) {
    console.error('Error in keep-alive:', error)

    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to keep room alive' } },
      { status: 500 }
    )
  }
}
