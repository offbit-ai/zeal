import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'

// GET /api/flow-traces/sessions/[sessionId]/report - Generate trace report
export const GET = withAuth(async (request: AuthenticatedRequest, context?: { params: { sessionId: string } }) => {
  if (!context || !context.params) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  const { sessionId } = context.params
  const { searchParams } = new URL(request.url)

    // Get optional filters
    const search = searchParams.get('search') || undefined
    const status = searchParams.get('status') || undefined
    const format = searchParams.get('format') || 'json' // json or text

    const session = await FlowTraceDatabase.getSession(sessionId)

    if (!session) {
      return NextResponse.json({ error: 'Trace session not found' }, { status: 404 })
    }

    // Validate tenant access for trace session reports
    if ((session as any).tenantId && !validateTenantAccess(session as any, request as NextRequest)) {
      return createTenantViolationError()
    }

    // Filter traces if needed
    let traces = session.traces

    if (status && status !== 'all') {
      traces = traces.filter(trace => trace.status === status)
    }

    if (search) {
      const query = search.toLowerCase()
      traces = traces.filter(
        trace =>
          trace.source.nodeName.toLowerCase().includes(query) ||
          trace.target.nodeName.toLowerCase().includes(query) ||
          trace.source.portName.toLowerCase().includes(query) ||
          trace.target.portName.toLowerCase().includes(query)
      )
    }

    // Generate report data
    const report = {
      title: 'Flow Trace Report',
      generatedAt: new Date().toISOString(),
      session: {
        id: session.id,
        workflowId: session.workflowId,
        workflowName: session.workflowName,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        duration: session.endTime
          ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
          : 0,
      },
      summary: {
        totalTraces: traces.length,
        successCount: traces.filter(t => t.status === 'success').length,
        errorCount: traces.filter(t => t.status === 'error').length,
        warningCount: traces.filter(t => t.status === 'warning').length,
        totalDataSize: traces.reduce((sum, t) => sum + t.data.size, 0),
        averageDuration:
          traces.length > 0 ? traces.reduce((sum, t) => sum + t.duration, 0) / traces.length : 0,
      },
      traces: traces.map(trace => ({
        id: trace.id,
        timestamp: trace.timestamp,
        duration: trace.duration,
        status: trace.status,
        flow: `${trace.source.nodeName} (${trace.source.portName}) → ${trace.target.nodeName} (${trace.target.portName})`,
        dataSize: trace.data.size,
        dataType: trace.data.type,
        error: trace.error?.message || null,
      })),
      analysis: {
        totalTraces: traces.length,
        successRate:
          traces.length > 0
            ? ((traces.filter(t => t.status === 'success').length / traces.length) * 100).toFixed(
                1
              ) + '%'
            : '0%',
        averageLatency:
          traces.length > 0
            ? (traces.reduce((sum, t) => sum + t.duration, 0) / traces.length).toFixed(2) + 'ms'
            : '0ms',
        totalDataTransferred:
          (traces.reduce((sum, t) => sum + t.data.size, 0) / 1024).toFixed(2) + 'KB',
        errorTraces: traces
          .filter(t => t.status === 'error')
          .map(t => ({
            flow: `${t.source.nodeName} → ${t.target.nodeName}`,
            error: t.error?.message || 'Unknown error',
            timestamp: new Date(t.timestamp).toLocaleString(),
          })),
        slowestTraces: traces
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 5)
          .map(t => ({
            flow: `${t.source.nodeName} → ${t.target.nodeName}`,
            duration: t.duration + 'ms',
            timestamp: new Date(t.timestamp).toLocaleString(),
          })),
      },
      filters: {
        search: search || 'None',
        status: status || 'all',
      },
    }

    // Return based on format
    if (format === 'text') {
      const textReport = `FLOW TRACE REPORT
================

Generated: ${new Date(report.generatedAt).toLocaleString()}

SESSION INFORMATION
------------------
Workflow: ${report.session.workflowName}
Session ID: ${report.session.id}
Status: ${report.session.status}
Start Time: ${new Date(report.session.startTime).toLocaleString()}
${report.session.endTime ? `End Time: ${new Date(report.session.endTime).toLocaleString()}` : ''}
Duration: ${(report.session.duration / 1000).toFixed(2)}s

SUMMARY STATISTICS
-----------------
Total Traces: ${report.summary.totalTraces}
Successful: ${report.summary.successCount}
Errors: ${report.summary.errorCount}
Warnings: ${report.summary.warningCount}
Success Rate: ${report.analysis.successRate}
Average Latency: ${report.analysis.averageLatency}
Total Data Transferred: ${report.analysis.totalDataTransferred}

TRACE DETAILS
-------------
${report.traces
  .map(
    (trace, i) => `
${i + 1}. ${trace.flow}
   Status: ${trace.status}
   Duration: ${trace.duration}ms
   Data Size: ${(trace.dataSize / 1024).toFixed(2)}KB
   Data Type: ${trace.dataType}
   Timestamp: ${new Date(trace.timestamp).toLocaleString()}
   ${trace.error ? `Error: ${trace.error}` : ''}
`
  )
  .join('\n')}

${
  report.analysis.errorTraces.length > 0
    ? `
ERROR ANALYSIS
--------------
${report.analysis.errorTraces
  .map(
    (error, i) => `
${i + 1}. ${error.flow}
   Error: ${error.error}
   Time: ${error.timestamp}
`
  )
  .join('\n')}
`
    : ''
}

PERFORMANCE ANALYSIS
-------------------
Slowest Traces:
${report.analysis.slowestTraces
  .map(
    (trace, i) => `
${i + 1}. ${trace.flow}
   Duration: ${trace.duration}
   Time: ${trace.timestamp}
`
  )
  .join('\n')}

FILTERS APPLIED
--------------
Search Query: ${report.filters.search}
Status Filter: ${report.filters.status}
`

      return new NextResponse(textReport, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename=flow-trace-report-${session.workflowName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.txt`,
        },
      })
    }

    // Default to JSON
    return NextResponse.json(createSuccessResponse(report))
}, {
  resource: 'execution',
  action: 'read'
})
