import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId, mockDelay } from '@/lib/api-utils'
import { ApiError } from '@/types/api'

// Import the mock store
let flowTracesStore: any[] = []

// GET /api/flow-traces/[id] - Get specific flow trace
export const GET = withErrorHandling(
  async (req: NextRequest, context: { params: { id: string } } | undefined) => {
    await mockDelay(75)

    if (!context || !context.params || !context.params.id) {
      throw new ApiError('FLOW_TRACE_NOT_FOUND', 'Flow trace ID is required', 400)
    }

    const userId = extractUserId(req)
    const { id } = context.params

    const trace = flowTracesStore.find(t => t.id === id)

    if (!trace) {
      throw new ApiError('FLOW_TRACE_NOT_FOUND', 'Flow trace not found', 404)
    }

    // In real implementation, add detailed trace data including:
    // - Full data payload (if available)
    // - Execution context
    // - Performance metrics
    // - Related traces in the same session

    const detailedTrace = {
      ...trace,
      details: {
        dataPayload: {
          input: {
            type: trace.metadata.dataType,
            size: trace.dataSize,
            sample:
              trace.metadata.dataType === 'application/json'
                ? '{"id": 123, "name": "Sample Data", "status": "active"}'
                : 'Sample data content...',
          },
          output:
            trace.status === 'success'
              ? {
                  type: 'application/json',
                  size: Math.round(trace.dataSize * 1.2),
                  sample:
                    '{"processed": true, "result": "Success", "timestamp": "2024-01-15T10:30:00Z"}',
                }
              : null,
          transformations: trace.metadata.transformations || [],
        },
        performance: {
          networkLatency: Math.round(trace.duration * 0.1),
          processingTime: Math.round(trace.duration * 0.8),
          serializationTime: Math.round(trace.duration * 0.1),
          memoryUsage: Math.round(trace.dataSize * 1.5),
          cpuUsage: Math.random() * 100,
        },
        context: {
          executionEnvironment: 'docker-container-abc123',
          resourceLimits: {
            maxMemory: '512MB',
            maxCpu: '0.5 cores',
            timeout: '30s',
          },
          environmentVariables: ['NODE_ENV', 'DATABASE_URL', 'API_KEY'],
        },
      },
    }

    return NextResponse.json(createSuccessResponse(detailedTrace))
  }
)

// PUT /api/flow-traces/[id] - Update flow trace status (internal API)
export const PUT = withErrorHandling(
  async (req: NextRequest, context?: { params: { id: string } }) => {
    await mockDelay(100)

    if (!context || !context.params || !context.params.id) {
      throw new ApiError('FLOW_TRACE_NOT_FOUND', 'Flow trace ID is required', 400)
    }

    const userId = extractUserId(req)
    const { id } = context.params
    const body = await req.json()

    const traceIndex = flowTracesStore.findIndex(t => t.id === id)

    if (traceIndex === -1) {
      throw new ApiError('FLOW_TRACE_NOT_FOUND', 'Flow trace not found', 404)
    }

    const existingTrace = flowTracesStore[traceIndex]

    // Update trace with new status and metadata
    const updatedTrace = {
      ...existingTrace,
      status: body.status !== undefined ? body.status : existingTrace.status,
      duration: body.duration !== undefined ? body.duration : existingTrace.duration,
      dataSize: body.dataSize !== undefined ? body.dataSize : existingTrace.dataSize,
      errorMessage:
        body.errorMessage !== undefined ? body.errorMessage : existingTrace.errorMessage,
      errorCode: body.errorCode !== undefined ? body.errorCode : existingTrace.errorCode,
      metadata: {
        ...existingTrace.metadata,
        ...body.metadata,
        executionTime:
          body.duration !== undefined ? body.duration : existingTrace.metadata.executionTime,
      },
    }

    flowTracesStore[traceIndex] = updatedTrace

    return NextResponse.json(createSuccessResponse(updatedTrace))
  }
)

// DELETE /api/flow-traces/[id] - Delete flow trace (admin only)
export const DELETE = withErrorHandling(
  async (req: NextRequest, context: { params: { id: string } } | undefined) => {
    await mockDelay(75)
    if (!context || !context.params || !context.params.id) {
      throw new ApiError('FLOW_TRACE_NOT_FOUND', 'Flow trace ID is required', 400)
    }

    const userId = extractUserId(req)
    const { id } = context.params

    // In real implementation, check if user has admin permissions
    if (!userId.startsWith('admin_')) {
      throw new ApiError('FORBIDDEN', 'Only administrators can delete flow traces', 403)
    }

    const traceIndex = flowTracesStore.findIndex(t => t.id === id)

    if (traceIndex === -1) {
      throw new ApiError('FLOW_TRACE_NOT_FOUND', 'Flow trace not found', 404)
    }

    // Remove trace
    flowTracesStore.splice(traceIndex, 1)

    return NextResponse.json(createSuccessResponse({ deleted: true }))
  }
)
