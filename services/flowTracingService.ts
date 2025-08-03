import { apiClient } from './apiClient'

export interface FlowTrace {
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

export interface FlowTraceSession {
  sessionId: string
  workflowId: string
  workflowName: string
  executionId: string
  startTime: string
  endTime?: string
  duration: number
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  totalTraces: number
  successfulTraces: number
  failedTraces: number
  traces: FlowTrace[]
  metadata: {
    triggerType: 'manual' | 'scheduled' | 'webhook'
    triggeredBy: string
    environment: string
    version: string
  }
}

export interface FlowTraceAnalytics {
  summary: {
    totalTraces: number
    totalSessions: number
    totalWorkflows: number
    successRate: number
    avgDuration: number
    totalDataProcessed: number
  }
  performance: {
    slowestTraces: Array<{
      id: string
      workflowName: string
      sourceNode: string
      targetNode: string
      duration: number
      timestamp: string
    }>
    fastestTraces: Array<{
      id: string
      workflowName: string
      sourceNode: string
      targetNode: string
      duration: number
      timestamp: string
    }>
    avgDurationByNode: Record<string, number>
    avgDurationByWorkflow: Record<string, number>
  }
  errors: {
    errorsByType: Record<string, number>
    errorsByNode: Record<string, number>
    errorsByWorkflow: Record<string, number>
    recentErrors: Array<{
      id: string
      workflowName: string
      nodeTitle: string
      errorCode: string
      errorMessage: string
      timestamp: string
    }>
  }
  trends: {
    dailyTraceCount: Array<{
      date: string
      count: number
      successCount: number
      errorCount: number
    }>
    hourlyDistribution: Record<string, number>
    dataVolumeOverTime: Array<{
      timestamp: string
      totalSize: number
    }>
  }
}

export class FlowTracingService {
  private static cache: Map<string, FlowTrace[]> = new Map()
  private static sessionCache: Map<string, FlowTraceSession> = new Map()
  private static CACHE_DURATION = 2 * 60 * 1000 // 2 minutes (shorter for real-time data)

  static async getFlowTraces(params?: {
    workflowId?: string
    executionId?: string
    traceSessionId?: string
    status?: string[]
    nodeId?: string
    dateFrom?: string
    dateTo?: string
    hoursAgo?: number
    minDuration?: number
    maxDuration?: number
    search?: string
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<{
    traces: FlowTrace[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
    stats: {
      totalTraces: number
      successCount: number
      errorCount: number
      pendingCount: number
      avgDuration: number
      totalDataSize: number
    }
  }> {
    try {
      const response = await apiClient.getPaginated<FlowTrace>('/flow-traces', {
        workflow_id: params?.workflowId,
        execution_id: params?.executionId,
        trace_session_id: params?.traceSessionId,
        status: params?.status?.join(','),
        node_id: params?.nodeId,
        date_from: params?.dateFrom,
        date_to: params?.dateTo,
        hours_ago: params?.hoursAgo,
        min_duration: params?.minDuration,
        max_duration: params?.maxDuration,
        search: params?.search,
        page: params?.page || 1,
        limit: params?.limit || 50,
        sortBy: params?.sortBy || 'timestamp',
        sortOrder: params?.sortOrder || 'desc'
      })

      // Extract stats from response meta
      const stats = (response as any).meta?.stats || {
        totalTraces: response.data.length,
        successCount: response.data.filter((t: FlowTrace) => t.status === 'success').length,
        errorCount: response.data.filter((t: FlowTrace) => t.status === 'error').length,
        pendingCount: response.data.filter((t: FlowTrace) => t.status === 'pending').length,
        avgDuration: response.data.length > 0 
          ? Math.round(response.data.reduce((sum: number, t: FlowTrace) => sum + t.duration, 0) / response.data.length)
          : 0,
        totalDataSize: response.data.reduce((sum: number, t: FlowTrace) => sum + t.dataSize, 0)
      }

      return {
        traces: response.data,
        pagination: response.pagination,
        stats
      }
    } catch (error) {
      console.error('Failed to fetch flow traces:', error)
      
      // Fall back to local mock data
      return this.getMockFlowTraces(params)
    }
  }

  static async getFlowTrace(id: string): Promise<FlowTrace | null> {
    try {
      const trace = await apiClient.get<FlowTrace>(`/flow-traces/${id}`)
      return trace
    } catch (error) {
      console.error(`Failed to fetch flow trace ${id}:`, error)
      return null
    }
  }

  static async getTraceSession(sessionId: string, includeDetails = false): Promise<FlowTraceSession | null> {
    try {
      const session = await apiClient.get<FlowTraceSession>(`/flow-traces/sessions/${sessionId}`, {
        include_details: includeDetails
      })
      
      // Update cache
      this.sessionCache.set(sessionId, session)
      
      return session
    } catch (error) {
      console.error(`Failed to fetch trace session ${sessionId}:`, error)
      return null
    }
  }

  static async replaySession(
    sessionId: string, 
    options?: {
      preserveTimestamps?: boolean
      replaySpeed?: number
      skipFailedNodes?: boolean
      stopOnError?: boolean
      replayFrom?: string
      replayTo?: string
    }
  ): Promise<{
    originalSessionId: string
    replaySessionId: string
    replayExecutionId: string
    status: string
    queuedAt: string
    estimatedDuration: number
  }> {
    try {
      const replayConfig = await apiClient.post<{
        originalSessionId: string
        replaySessionId: string
        replayExecutionId: string
        status: string
        queuedAt: string
        estimatedDuration: number
      }>(`/flow-traces/sessions/${sessionId}/replay`, options || {})
      return replayConfig
    } catch (error) {
      console.error(`Failed to replay session ${sessionId}:`, error)
      throw error
    }
  }

  static async getAnalytics(params?: {
    dateFrom?: string
    dateTo?: string
    workflowId?: string
  }): Promise<FlowTraceAnalytics> {
    try {
      const analytics = await apiClient.get<FlowTraceAnalytics>('/flow-traces/analytics', {
        date_from: params?.dateFrom,
        date_to: params?.dateTo,
        workflow_id: params?.workflowId
      })
      
      return analytics
    } catch (error) {
      console.error('Failed to fetch flow trace analytics:', error)
      
      // Return mock analytics
      return this.getMockAnalytics()
    }
  }

  static async generateReport(config: {
    format: 'pdf' | 'csv' | 'excel' | 'json'
    dateFrom?: string
    dateTo?: string
    workflowIds?: string[]
    nodeTypes?: string[]
    statusFilter?: string[]
    includePerformanceMetrics?: boolean
    includeErrorAnalysis?: boolean
    includeTrendAnalysis?: boolean
  }): Promise<{
    reportId: string
    format: string
    status: string
    createdAt: string
    estimatedCompletionTime: string
    downloadUrl: string | null
  }> {
    try {
      const report = await apiClient.post<{
        reportId: string
        format: string
        status: string
        createdAt: string
        estimatedCompletionTime: string
        downloadUrl: string | null
      }>('/flow-traces/analytics/report', config)
      return report
    } catch (error) {
      console.error('Failed to generate flow trace report:', error)
      throw error
    }
  }

  // Query helper methods for filtering
  static buildTimeFilter(hoursAgo?: number, dateFrom?: string, dateTo?: string): {
    dateFrom?: string
    dateTo?: string
  } {
    if (hoursAgo) {
      const cutoff = new Date(Date.now() - (hoursAgo * 60 * 60 * 1000))
      return { dateFrom: cutoff.toISOString() }
    }
    
    return {
      dateFrom: dateFrom,
      dateTo: dateTo
    }
  }

  static async searchTraces(query: string, filters?: {
    workflowId?: string
    status?: string[]
    dateRange?: { from: string; to: string }
  }): Promise<FlowTrace[]> {
    try {
      const response = await this.getFlowTraces({
        search: query,
        workflowId: filters?.workflowId,
        status: filters?.status,
        dateFrom: filters?.dateRange?.from,
        dateTo: filters?.dateRange?.to,
        limit: 100
      })
      
      return response.traces
    } catch (error) {
      console.error('Failed to search flow traces:', error)
      return []
    }
  }

  // Utility methods for trace analysis
  static calculateSuccessRate(traces: FlowTrace[]): number {
    if (traces.length === 0) return 0
    const successCount = traces.filter(t => t.status === 'success').length
    return Math.round((successCount / traces.length) * 100)
  }

  static getAverageDuration(traces: FlowTrace[]): number {
    if (traces.length === 0) return 0
    const total = traces.reduce((sum, t) => sum + t.duration, 0)
    return Math.round(total / traces.length)
  }

  static groupTracesByStatus(traces: FlowTrace[]): Record<string, FlowTrace[]> {
    return traces.reduce((groups, trace) => {
      const status = trace.status
      if (!groups[status]) {
        groups[status] = []
      }
      groups[status].push(trace)
      return groups
    }, {} as Record<string, FlowTrace[]>)
  }

  // Mock data fallbacks
  private static getMockFlowTraces(params?: any): {
    traces: FlowTrace[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
    stats: any
  } {
    const mockTraces: FlowTrace[] = [
      {
        id: 'trace_001',
        traceSessionId: 'session_abc123',
        workflowId: 'wf_sample_001',
        workflowName: 'Sample Data Processing',
        executionId: 'exec_001',
        sourceNodeId: 'node_db_001',
        sourceNodeTitle: 'PostgreSQL',
        sourcePortId: 'db-out-data',
        targetNodeId: 'node_ai_001',
        targetNodeTitle: 'GPT-4',
        targetPortId: 'ai-in-prompt',
        status: 'success',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        duration: 1250,
        dataSize: 2048,
        metadata: {
          dataType: 'application/json',
          transformations: ['sanitize', 'validate'],
          retryCount: 0,
          executionTime: 1250
        }
      }
    ]

    return {
      traces: mockTraces,
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      stats: {
        totalTraces: 1,
        successCount: 1,
        errorCount: 0,
        pendingCount: 0,
        avgDuration: 1250,
        totalDataSize: 2048
      }
    }
  }

  private static getMockAnalytics(): FlowTraceAnalytics {
    return {
      summary: {
        totalTraces: 100,
        totalSessions: 25,
        totalWorkflows: 5,
        successRate: 85,
        avgDuration: 1500,
        totalDataProcessed: 524288
      },
      performance: {
        slowestTraces: [],
        fastestTraces: [],
        avgDurationByNode: {},
        avgDurationByWorkflow: {}
      },
      errors: {
        errorsByType: {},
        errorsByNode: {},
        errorsByWorkflow: {},
        recentErrors: []
      },
      trends: {
        dailyTraceCount: [],
        hourlyDistribution: {},
        dataVolumeOverTime: []
      }
    }
  }

  // Clear cache
  static clearCache(): void {
    this.cache.clear()
    this.sessionCache.clear()
  }
}