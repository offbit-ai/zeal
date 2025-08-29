import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { buildTenantQuery } from '@/lib/auth/tenant-utils'

interface AnalyticsResponse {
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

// Import mock stores
let flowTracesStore: any[] = []

// GET /api/flow-traces/analytics - Get flow trace analytics
export const GET = withAuth(
  withErrorHandling(async (req: AuthenticatedRequest) => {

  const { searchParams } = new URL(req.url)
  const userId = req.auth?.subject?.id || extractUserId(req)
  const tenantQuery = buildTenantQuery(req as NextRequest)

  // Parse date range filters
  const dateFrom = searchParams.get('date_from')
    ? new Date(searchParams.get('date_from')!)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Default: 30 days ago

  const dateTo = searchParams.get('date_to') ? new Date(searchParams.get('date_to')!) : new Date() // Default: now

  const workflowId = searchParams.get('workflow_id')

  // Filter traces based on date range and optional workflow
  let filteredTraces = flowTracesStore.filter(trace => {
    const traceDate = new Date(trace.timestamp)
    const inDateRange = traceDate >= dateFrom && traceDate <= dateTo
    const matchesWorkflow = !workflowId || trace.workflowId === workflowId
    return inDateRange && matchesWorkflow
  })

  // Calculate summary statistics
  const totalTraces = filteredTraces.length
  const successfulTraces = filteredTraces.filter(t => t.status === 'success')
  const errorTraces = filteredTraces.filter(t => t.status === 'error')
  const uniqueSessions = new Set(filteredTraces.map(t => t.traceSessionId)).size
  const uniqueWorkflows = new Set(filteredTraces.map(t => t.workflowId)).size

  const summary = {
    totalTraces,
    totalSessions: uniqueSessions,
    totalWorkflows: uniqueWorkflows,
    successRate: totalTraces > 0 ? Math.round((successfulTraces.length / totalTraces) * 100) : 0,
    avgDuration:
      totalTraces > 0
        ? Math.round(filteredTraces.reduce((sum, t) => sum + t.duration, 0) / totalTraces)
        : 0,
    totalDataProcessed: filteredTraces.reduce((sum, t) => sum + t.dataSize, 0),
  }

  // Performance analysis
  const sortedByDuration = [...filteredTraces].sort((a, b) => b.duration - a.duration)
  const slowestTraces = sortedByDuration.slice(0, 10).map(trace => ({
    id: trace.id,
    workflowName: trace.workflowName,
    sourceNode: trace.sourceNodeTitle,
    targetNode: trace.targetNodeTitle,
    duration: trace.duration,
    timestamp: trace.timestamp,
  }))

  const fastestTraces = sortedByDuration
    .slice(-10)
    .reverse()
    .map(trace => ({
      id: trace.id,
      workflowName: trace.workflowName,
      sourceNode: trace.sourceNodeTitle,
      targetNode: trace.targetNodeTitle,
      duration: trace.duration,
      timestamp: trace.timestamp,
    }))

  // Average duration by node
  const durationByNode: Record<string, { total: number; count: number }> = {}
  filteredTraces.forEach(trace => {
    const key = `${trace.sourceNodeTitle} → ${trace.targetNodeTitle}`
    if (!durationByNode[key]) {
      durationByNode[key] = { total: 0, count: 0 }
    }
    durationByNode[key].total += trace.duration
    durationByNode[key].count += 1
  })

  const avgDurationByNode = Object.fromEntries(
    Object.entries(durationByNode).map(([key, value]) => [
      key,
      Math.round(value.total / value.count),
    ])
  )

  // Average duration by workflow
  const durationByWorkflow: Record<string, { total: number; count: number }> = {}
  filteredTraces.forEach(trace => {
    if (!durationByWorkflow[trace.workflowName]) {
      durationByWorkflow[trace.workflowName] = { total: 0, count: 0 }
    }
    durationByWorkflow[trace.workflowName].total += trace.duration
    durationByWorkflow[trace.workflowName].count += 1
  })

  const avgDurationByWorkflow = Object.fromEntries(
    Object.entries(durationByWorkflow).map(([key, value]) => [
      key,
      Math.round(value.total / value.count),
    ])
  )

  // Error analysis
  const errorsByType: Record<string, number> = {}
  const errorsByNode: Record<string, number> = {}
  const errorsByWorkflow: Record<string, number> = {}

  errorTraces.forEach(trace => {
    // Count by error type
    const errorType = trace.errorCode || 'UNKNOWN_ERROR'
    errorsByType[errorType] = (errorsByType[errorType] || 0) + 1

    // Count by node
    const nodeName = trace.targetNodeTitle
    errorsByNode[nodeName] = (errorsByNode[nodeName] || 0) + 1

    // Count by workflow
    const workflowName = trace.workflowName
    errorsByWorkflow[workflowName] = (errorsByWorkflow[workflowName] || 0) + 1
  })

  const recentErrors = errorTraces
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20)
    .map(trace => ({
      id: trace.id,
      workflowName: trace.workflowName,
      nodeTitle: trace.targetNodeTitle,
      errorCode: trace.errorCode || 'UNKNOWN_ERROR',
      errorMessage: trace.errorMessage || 'No error message available',
      timestamp: trace.timestamp,
    }))

  // Trend analysis
  const dailyTraceCount: Record<
    string,
    { count: number; successCount: number; errorCount: number }
  > = {}
  filteredTraces.forEach(trace => {
    const date = trace.timestamp.split('T')[0] // Get YYYY-MM-DD
    if (!dailyTraceCount[date]) {
      dailyTraceCount[date] = { count: 0, successCount: 0, errorCount: 0 }
    }
    dailyTraceCount[date].count += 1
    if (trace.status === 'success') {
      dailyTraceCount[date].successCount += 1
    } else if (trace.status === 'error') {
      dailyTraceCount[date].errorCount += 1
    }
  })

  const dailyTrends = Object.entries(dailyTraceCount)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }))

  // Hourly distribution
  const hourlyDistribution: Record<string, number> = {}
  filteredTraces.forEach(trace => {
    const hour = new Date(trace.timestamp).getHours().toString()
    hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1
  })

  // Data volume over time (grouped by day)
  const dataVolumeByDay: Record<string, number> = {}
  filteredTraces.forEach(trace => {
    const date = trace.timestamp.split('T')[0]
    dataVolumeByDay[date] = (dataVolumeByDay[date] || 0) + trace.dataSize
  })

  const dataVolumeOverTime = Object.entries(dataVolumeByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([timestamp, totalSize]) => ({ timestamp, totalSize }))

  const analytics: AnalyticsResponse = {
    summary,
    performance: {
      slowestTraces,
      fastestTraces,
      avgDurationByNode,
      avgDurationByWorkflow,
    },
    errors: {
      errorsByType,
      errorsByNode,
      errorsByWorkflow,
      recentErrors,
    },
    trends: {
      dailyTraceCount: dailyTrends,
      hourlyDistribution,
      dataVolumeOverTime,
    },
  }

  return NextResponse.json(createSuccessResponse(analytics))
  }),
  {
    resource: 'flow-traces',
    action: 'read'
  }
)

// POST /api/flow-traces/analytics/report - Generate analytics report
export const POST = withAuth(
  withErrorHandling(async (req: AuthenticatedRequest) => {

  const userId = req.auth?.subject?.id || extractUserId(req)
  const body = await req.json()

  // In real implementation, this would:
  // 1. Generate comprehensive report based on provided filters
  // 2. Export to various formats (PDF, CSV, Excel)
  // 3. Store report for later download
  // 4. Send notification when ready

  const reportConfig = {
    reportId: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    format: body.format || 'pdf', // pdf, csv, excel, json
    dateRange: {
      from: body.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to: body.dateTo || new Date().toISOString(),
    },
    filters: {
      workflowIds: body.workflowIds || [],
      nodeTypes: body.nodeTypes || [],
      statusFilter: body.statusFilter || ['success', 'error'],
      includePerformanceMetrics: body.includePerformanceMetrics !== false,
      includeErrorAnalysis: body.includeErrorAnalysis !== false,
      includeTrendAnalysis: body.includeTrendAnalysis !== false,
    },
    status: 'generating',
    createdAt: new Date().toISOString(),
    estimatedCompletionTime: new Date(Date.now() + 60000).toISOString(), // 1 minute
    downloadUrl: null,
  }

  // Simulate report generation
  setTimeout(() => {
    // console.log removed
    // In real implementation, update report status and send notification
  }, 5000)

  return NextResponse.json(createSuccessResponse(reportConfig), { status: 202 })
  }),
  {
    resource: 'flow-traces',
    action: 'create'
  }
)
