import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  parsePaginationParams,
  parseFilterParams,
  extractUserId,
  mockDelay
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'

interface FlowTraceResponse {
  id: string
  traceSessionId: string
  workflowId: string
  workflowName: string
  executionId: string
  sourceNodeId: string
  sourceNodeTitle: string
  sourcePortId: string
  targetNodeId: string
  targetNodeTitle: string
  targetPortId: string
  status: 'success' | 'error' | 'pending' | 'timeout'
  timestamp: string
  duration: number
  dataSize: number
  errorMessage?: string
  errorCode?: string
  metadata: {
    dataType: string
    transformations?: string[]
    retryCount: number
    executionTime: number
  }
}

// Mock flow traces store
let flowTracesStore: FlowTraceResponse[] = [
  {
    id: 'trace_001',
    traceSessionId: 'session_abc123',
    workflowId: 'wf_sample_001',
    workflowName: 'Sample Data Processing Workflow',
    executionId: 'exec_001',
    sourceNodeId: 'node_db_001',
    sourceNodeTitle: 'PostgreSQL',
    sourcePortId: 'db-out-data',
    targetNodeId: 'node_ai_001',
    targetNodeTitle: 'GPT-4',
    targetPortId: 'ai-in-prompt',
    status: 'success',
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    duration: 1250,
    dataSize: 2048,
    metadata: {
      dataType: 'application/json',
      transformations: ['sanitize', 'validate'],
      retryCount: 0,
      executionTime: 1250
    }
  },
  {
    id: 'trace_002',
    traceSessionId: 'session_abc123',
    workflowId: 'wf_sample_001',
    workflowName: 'Sample Data Processing Workflow',
    executionId: 'exec_001',
    sourceNodeId: 'node_ai_001',
    sourceNodeTitle: 'GPT-4',
    sourcePortId: 'ai-out-result',
    targetNodeId: 'node_transform_001',
    targetNodeTitle: 'Data Transformer',
    targetPortId: 'transform-in-data',
    status: 'error',
    timestamp: new Date(Date.now() - 3590000).toISOString(),
    duration: 5000,
    dataSize: 1024,
    errorMessage: 'Rate limit exceeded for OpenAI API',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    metadata: {
      dataType: 'text/plain',
      retryCount: 2,
      executionTime: 5000
    }
  },
  {
    id: 'trace_003',
    traceSessionId: 'session_def456',
    workflowId: 'wf_sample_002',
    workflowName: 'Advanced Analytics Pipeline',
    executionId: 'exec_002',
    sourceNodeId: 'node_api_001',
    sourceNodeTitle: 'REST API',
    sourcePortId: 'api-out-response',
    targetNodeId: 'node_script_001',
    targetNodeTitle: 'Python Script',
    targetPortId: 'script-in-data',
    status: 'success',
    timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
    duration: 750,
    dataSize: 4096,
    metadata: {
      dataType: 'application/json',
      transformations: ['decode', 'parse'],
      retryCount: 0,
      executionTime: 750
    }
  },
  {
    id: 'trace_004',
    traceSessionId: 'session_ghi789',
    workflowId: 'wf_sample_003',
    workflowName: 'Real-time Monitoring',
    executionId: 'exec_003',
    sourceNodeId: 'node_sensor_001',
    sourceNodeTitle: 'IoT Sensor',
    sourcePortId: 'sensor-out-reading',
    targetNodeId: 'node_branch_001',
    targetNodeTitle: 'Branch Logic',
    targetPortId: 'branch-in-condition',
    status: 'pending',
    timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    duration: 0,
    dataSize: 512,
    metadata: {
      dataType: 'application/json',
      retryCount: 0,
      executionTime: 0
    }
  }
]

// GET /api/flow-traces - List flow traces
export const GET = withErrorHandling(async (req: NextRequest) => {
  await mockDelay(150)
  
  const { searchParams } = new URL(req.url)
  const userId = extractUserId(req)
  const pagination = parsePaginationParams(searchParams)
  const filters = parseFilterParams(searchParams)
  
  // Filter flow traces
  let filteredTraces = [...flowTracesStore]
  
  if (filters.workflowId) {
    filteredTraces = filteredTraces.filter(trace => 
      trace.workflowId === filters.workflowId
    )
  }
  
  if (filters.executionId) {
    filteredTraces = filteredTraces.filter(trace => 
      trace.executionId === filters.executionId
    )
  }
  
  if (filters.traceSessionId) {
    filteredTraces = filteredTraces.filter(trace => 
      trace.traceSessionId === filters.traceSessionId
    )
  }
  
  if (filters.status) {
    const statusFilter = Array.isArray(filters.status) ? filters.status : [filters.status]
    filteredTraces = filteredTraces.filter(trace => 
      statusFilter.includes(trace.status)
    )
  }
  
  if (filters.nodeId) {
    filteredTraces = filteredTraces.filter(trace => 
      trace.sourceNodeId === filters.nodeId || trace.targetNodeId === filters.nodeId
    )
  }
  
  // Date filters
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom)
    filteredTraces = filteredTraces.filter(trace => 
      new Date(trace.timestamp) >= fromDate
    )
  }
  
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo)
    filteredTraces = filteredTraces.filter(trace => 
      new Date(trace.timestamp) <= toDate
    )
  }
  
  // Hours ago filter (common for debugging)
  if (filters.hoursAgo) {
    const hoursAgo = parseInt(filters.hoursAgo)
    const cutoffTime = new Date(Date.now() - (hoursAgo * 60 * 60 * 1000))
    filteredTraces = filteredTraces.filter(trace => 
      new Date(trace.timestamp) >= cutoffTime
    )
  }
  
  // Duration filter (for performance analysis)
  if (filters.minDuration) {
    const minDuration = parseInt(filters.minDuration)
    filteredTraces = filteredTraces.filter(trace => 
      trace.duration >= minDuration
    )
  }
  
  if (filters.maxDuration) {
    const maxDuration = parseInt(filters.maxDuration)
    filteredTraces = filteredTraces.filter(trace => 
      trace.duration <= maxDuration
    )
  }
  
  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    filteredTraces = filteredTraces.filter(trace => 
      trace.workflowName.toLowerCase().includes(searchLower) ||
      trace.sourceNodeTitle.toLowerCase().includes(searchLower) ||
      trace.targetNodeTitle.toLowerCase().includes(searchLower) ||
      trace.errorMessage?.toLowerCase().includes(searchLower)
    )
  }
  
  // Sort traces
  filteredTraces.sort((a, b) => {
    if (pagination.sortBy === 'timestamp') {
      return pagination.sortOrder === 'asc'
        ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    }
    if (pagination.sortBy === 'duration') {
      return pagination.sortOrder === 'asc'
        ? a.duration - b.duration
        : b.duration - a.duration
    }
    if (pagination.sortBy === 'status') {
      return pagination.sortOrder === 'asc'
        ? a.status.localeCompare(b.status)
        : b.status.localeCompare(a.status)
    }
    // Default sort by timestamp desc
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })
  
  // Apply pagination
  const total = filteredTraces.length
  const totalPages = Math.ceil(total / pagination.limit)
  const offset = (pagination.page - 1) * pagination.limit
  const paginatedTraces = filteredTraces.slice(offset, offset + pagination.limit)
  
  // Calculate statistics
  const stats = {
    totalTraces: total,
    successCount: filteredTraces.filter(t => t.status === 'success').length,
    errorCount: filteredTraces.filter(t => t.status === 'error').length,
    pendingCount: filteredTraces.filter(t => t.status === 'pending').length,
    avgDuration: filteredTraces.length > 0 
      ? Math.round(filteredTraces.reduce((sum, t) => sum + t.duration, 0) / filteredTraces.length)
      : 0,
    totalDataSize: filteredTraces.reduce((sum, t) => sum + t.dataSize, 0)
  }
  
  return NextResponse.json(createSuccessResponse(paginatedTraces, {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages
    },
    stats,
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}`
  }))
})

// POST /api/flow-traces - Create flow trace (internal API for execution engine)
export const POST = withErrorHandling(async (req: NextRequest) => {
  await mockDelay(100)
  
  const userId = extractUserId(req)
  const body = await req.json()
  
  // In real implementation, this would typically be called by the execution engine
  // Validate required fields
  if (!body.traceSessionId || !body.workflowId || !body.sourceNodeId || !body.targetNodeId) {
    throw new ApiError(
      'VALIDATION_ERROR', 
      'traceSessionId, workflowId, sourceNodeId, and targetNodeId are required',
      400
    )
  }
  
  // Create new flow trace
  const newTrace: FlowTraceResponse = {
    id: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    traceSessionId: body.traceSessionId,
    workflowId: body.workflowId,
    workflowName: body.workflowName || 'Unknown Workflow',
    executionId: body.executionId || '',
    sourceNodeId: body.sourceNodeId,
    sourceNodeTitle: body.sourceNodeTitle || 'Unknown Node',
    sourcePortId: body.sourcePortId || '',
    targetNodeId: body.targetNodeId,
    targetNodeTitle: body.targetNodeTitle || 'Unknown Node',
    targetPortId: body.targetPortId || '',
    status: body.status || 'pending',
    timestamp: body.timestamp || new Date().toISOString(),
    duration: body.duration || 0,
    dataSize: body.dataSize || 0,
    errorMessage: body.errorMessage,
    errorCode: body.errorCode,
    metadata: {
      dataType: body.metadata?.dataType || 'unknown',
      transformations: body.metadata?.transformations || [],
      retryCount: body.metadata?.retryCount || 0,
      executionTime: body.metadata?.executionTime || body.duration || 0
    }
  }
  
  flowTracesStore.push(newTrace)
  
  return NextResponse.json(createSuccessResponse(newTrace), { status: 201 })
})