import { getDatabase, generateTraceSessionId, generateTraceId } from '@/lib/database'
import type { FlowTrace, FlowTraceSession, TraceNode, TraceData, TraceError } from '@/types/flowTrace'
import { ApiError } from '@/types/api'

export class FlowTraceDatabase {
  // Create a new trace session
  static async createSession(data: {
    workflowId: string
    workflowVersionId?: string
    workflowName: string
    userId: string
  }): Promise<FlowTraceSession> {
    const db = await getDatabase()
    const sessionId = generateTraceSessionId()
    const now = new Date().toISOString()
    
    await db.query(`
      INSERT INTO flow_trace_sessions (
        id, "workflowId", "workflowVersionId", "workflowName", 
        "startTime", status, "userId", "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      sessionId,
      data.workflowId,
      data.workflowVersionId || null,
      data.workflowName,
      now,
      'running',
      data.userId,
      now
    ])
    
    return {
      id: sessionId,
      workflowId: data.workflowId,
      workflowName: data.workflowName,
      startTime: now,
      traces: [],
      status: 'running',
      summary: {
        totalTraces: 0,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        totalDataSize: 0,
        averageDuration: 0
      }
    }
  }
  
  // Add a trace to a session
  static async addTrace(sessionId: string, data: {
    source: TraceNode
    target: TraceNode
    duration: number
    status: 'success' | 'error' | 'warning'
    data: TraceData
    error?: TraceError
    graphId?: string
    graphName?: string
    parentTraceId?: string
    depth?: number
  }): Promise<FlowTrace> {
    const db = await getDatabase()
    const traceId = generateTraceId()
    const now = new Date().toISOString()
    
    // For subgraph nodes, we need to track the parent trace
    const isSubgraphNode = data.source.nodeType === 'subgraph' || data.target.nodeType === 'subgraph'
    
    await db.query(`
      INSERT INTO flow_traces (
        id, "sessionId", timestamp, duration, status,
        "sourceNodeId", "sourceNodeName", "sourceNodeType", 
        "sourcePortId", "sourcePortName", "sourcePortType",
        "targetNodeId", "targetNodeName", "targetNodeType",
        "targetPortId", "targetPortName", "targetPortType",
        "dataPayload", "dataSize", "dataType", "dataPreview",
        "errorMessage", "errorCode", "errorStack",
        "graphId", "graphName", "parentTraceId", depth,
        "createdAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
    `, [
      traceId,
      sessionId,
      now,
      data.duration,
      data.status,
      data.source.nodeId,
      data.source.nodeName,
      data.source.nodeType,
      data.source.portId,
      data.source.portName,
      data.source.portType,
      data.target.nodeId,
      data.target.nodeName,
      data.target.nodeType,
      data.target.portId,
      data.target.portName,
      data.target.portType,
      data.data.payload ? JSON.stringify(data.data.payload) : null,
      data.data.size,
      data.data.type,
      data.data.preview,
      data.error?.message || null,
      data.error?.code || null,
      data.error?.stack || null,
      data.graphId || null,
      data.graphName || null,
      data.parentTraceId || null,
      data.depth || 0,
      now
    ])
    
    const trace: FlowTrace = {
      id: traceId,
      timestamp: now,
      duration: data.duration,
      status: data.status,
      source: data.source,
      target: data.target,
      data: data.data,
      error: data.error,
      graphId: data.graphId ?? 'main',
      graphName: data.graphName ?? 'Main',
      parentTraceId: data.parentTraceId,
      depth: data.depth || 0
    }
    
    return trace
  }
  
  // Update session status and summary
  static async updateSession(sessionId: string, data: {
    status?: 'running' | 'completed' | 'failed'
    summary?: any
  }): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0
    
    if (data.status) {
      values.push(data.status)
      updates.push(`status = $${++paramCount}`)
      
      if (data.status !== 'running') {
        values.push(now)
        updates.push(`"endTime" = $${++paramCount}`)
      }
    }
    
    if (data.summary) {
      values.push(JSON.stringify(data.summary))
      updates.push(`summary = $${++paramCount}`)
    }
    
    if (updates.length > 0) {
      values.push(sessionId)
      await db.query(
        `UPDATE flow_trace_sessions SET ${updates.join(', ')} WHERE id = $${++paramCount}`,
        values
      )
    }
  }
  
  // Get session by ID
  static async getSession(sessionId: string): Promise<FlowTraceSession | null> {
    const db = await getDatabase()
    
    // Get session details
    const sessionResult = await db.query(
      'SELECT * FROM flow_trace_sessions WHERE id = $1',
      [sessionId]
    )
    
    const session = sessionResult.rows[0]
    if (!session) return null
    
    // Get all traces for this session
    const tracesResult = await db.query(
      'SELECT * FROM flow_traces WHERE "sessionId" = $1 ORDER BY timestamp ASC',
      [sessionId]
    )
    
    const traces: FlowTrace[] = tracesResult.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      duration: row.duration,
      status: row.status,
      source: {
        nodeId: row.sourceNodeId,
        nodeName: row.sourceNodeName,
        nodeType: row.sourceNodeType,
        portId: row.sourcePortId,
        portName: row.sourcePortName,
        portType: row.sourcePortType
      },
      target: {
        nodeId: row.targetNodeId,
        nodeName: row.targetNodeName,
        nodeType: row.targetNodeType,
        portId: row.targetPortId,
        portName: row.targetPortName,
        portType: row.targetPortType
      },
      data: {
        payload: row.dataPayload ? JSON.parse(row.dataPayload) : undefined,
        size: row.dataSize,
        type: row.dataType,
        preview: row.dataPreview
      },
      error: row.errorMessage ? {
        message: row.errorMessage,
        code: row.errorCode,
        stack: row.errorStack
      } : undefined,
      graphId: row.graphId,
      graphName: row.graphName,
      parentTraceId: row.parentTraceId,
      depth: row.depth
    }))
    
    return {
      id: session.id,
      workflowId: session.workflowId,
      workflowName: session.workflowName,
      startTime: session.startTime,
      endTime: session.endTime,
      traces,
      status: session.status,
      summary: session.summary ? JSON.parse(session.summary) : {
        totalTraces: traces.length,
        successCount: traces.filter(t => t.status === 'success').length,
        errorCount: traces.filter(t => t.status === 'error').length,
        warningCount: traces.filter(t => t.status === 'warning').length,
        totalDataSize: traces.reduce((sum, t) => sum + t.data.size, 0),
        averageDuration: traces.length > 0 
          ? traces.reduce((sum, t) => sum + t.duration, 0) / traces.length 
          : 0
      }
    }
  }
  
  // Get sessions for a user with pagination
  static async getSessions(userId: string, params: {
    status?: string
    limit?: number
    offset?: number
    search?: string
    startDate?: string
    endDate?: string
  }): Promise<{ sessions: FlowTraceSession[]; total: number }> {
    // For now, ignore userId as we don't have user filtering in the mock
    // In a real implementation, you would filter by userId
    return FlowTraceDatabase.listSessions(params)
  }
  
  // List sessions with pagination
  static async listSessions(params: {
    workflowId?: string
    status?: string
    limit?: number
    offset?: number
    startDate?: string
    endDate?: string
  }): Promise<{ sessions: FlowTraceSession[]; total: number }> {
    const db = await getDatabase()
    const { workflowId, status, limit = 20, offset = 0, startDate, endDate } = params
    
    let whereClause = 'WHERE 1=1'
    const queryParams: any[] = []
    let paramCount = 0
    
    if (workflowId) {
      queryParams.push(workflowId)
      whereClause += ` AND "workflowId" = $${++paramCount}`
    }
    
    if (status) {
      queryParams.push(status)
      whereClause += ` AND status = $${++paramCount}`
    }
    
    if (startDate) {
      queryParams.push(startDate)
      whereClause += ` AND "startTime" >= $${++paramCount}`
    }
    
    if (endDate) {
      queryParams.push(endDate)
      whereClause += ` AND "startTime" <= $${++paramCount}`
    }
    
    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM flow_trace_sessions ${whereClause}`,
      queryParams
    )
    const total = parseInt(countResult.rows[0]?.count || '0')
    
    // Get sessions with pagination
    let query = `SELECT * FROM flow_trace_sessions ${whereClause} ORDER BY "startTime" DESC`
    
    if (limit) {
      queryParams.push(limit)
      query += ` LIMIT $${++paramCount}`
      
      if (offset) {
        queryParams.push(offset)
        query += ` OFFSET $${++paramCount}`
      }
    }
    
    const sessionsResult = await db.query(query, queryParams)
    
    // For each session, get basic info (not all traces for performance)
    const sessions: FlowTraceSession[] = sessionsResult.rows.map(row => ({
      id: row.id,
      workflowId: row.workflowId,
      workflowName: row.workflowName,
      startTime: row.startTime,
      endTime: row.endTime,
      traces: [], // Don't load traces for list view
      status: row.status,
      summary: row.summary ? JSON.parse(row.summary) : {
        totalTraces: 0,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        totalDataSize: 0,
        averageDuration: 0
      }
    }))
    
    return { sessions, total }
  }
  
  // Delete old sessions
  static async deleteOldSessions(olderThan: Date): Promise<number> {
    const db = await getDatabase()
    const result = await db.query(
      'DELETE FROM flow_trace_sessions WHERE "startTime" < $1',
      [olderThan.toISOString()]
    )
    return result.rowCount || 0
  }
  
  // Get trace analytics
  static async getTraceAnalytics(workflowId: string, timeRange: {
    start: Date
    end: Date
  }): Promise<{
    totalSessions: number
    averageSessionDuration: number
    successRate: number
    errorRate: number
    mostFrequentErrors: Array<{ code: string; count: number }>
    slowestNodes: Array<{ nodeId: string; nodeName: string; avgDuration: number }>
  }> {
    const db = await getDatabase()
    
    // Get session stats
    const sessionStatsResult = await db.query(`
      SELECT 
        COUNT(*) as "totalSessions",
        AVG(EXTRACT(EPOCH FROM ("endTime" - "startTime")) * 1000) as "avgDuration",
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as "successCount",
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as "failCount"
      FROM flow_trace_sessions
      WHERE "workflowId" = $1 
        AND "startTime" >= $2 
        AND "startTime" <= $3
        AND "endTime" IS NOT NULL
    `, [workflowId, timeRange.start.toISOString(), timeRange.end.toISOString()])
    
    const stats = sessionStatsResult.rows[0] || {
      totalSessions: 0,
      avgDuration: 0,
      successCount: 0,
      failCount: 0
    }
    
    // Get most frequent errors
    const errorStatsResult = await db.query(`
      SELECT 
        "errorCode" as code,
        COUNT(*) as count
      FROM flow_traces
      WHERE "sessionId" IN (
        SELECT id FROM flow_trace_sessions 
        WHERE "workflowId" = $1 
          AND "startTime" >= $2 
          AND "startTime" <= $3
      )
      AND "errorCode" IS NOT NULL
      GROUP BY "errorCode"
      ORDER BY count DESC
      LIMIT 10
    `, [workflowId, timeRange.start.toISOString(), timeRange.end.toISOString()])
    
    // Get slowest nodes
    const slowNodesResult = await db.query(`
      SELECT 
        "targetNodeId" as "nodeId",
        "targetNodeName" as "nodeName",
        AVG(duration) as "avgDuration"
      FROM flow_traces
      WHERE "sessionId" IN (
        SELECT id FROM flow_trace_sessions 
        WHERE "workflowId" = $1 
          AND "startTime" >= $2 
          AND "startTime" <= $3
      )
      GROUP BY "targetNodeId", "targetNodeName"
      ORDER BY "avgDuration" DESC
      LIMIT 10
    `, [workflowId, timeRange.start.toISOString(), timeRange.end.toISOString()])
    
    const totalSessions = parseInt(stats.totalSessions) || 0
    const successCount = parseInt(stats.successCount) || 0
    const failCount = parseInt(stats.failCount) || 0
    
    return {
      totalSessions,
      averageSessionDuration: parseFloat(stats.avgDuration) || 0,
      successRate: totalSessions > 0 ? (successCount / totalSessions) * 100 : 0,
      errorRate: totalSessions > 0 ? (failCount / totalSessions) * 100 : 0,
      mostFrequentErrors: errorStatsResult.rows.map(row => ({
        code: row.code,
        count: parseInt(row.count)
      })),
      slowestNodes: slowNodesResult.rows.map(row => ({
        nodeId: row.nodeId,
        nodeName: row.nodeName,
        avgDuration: parseFloat(row.avgDuration)
      }))
    }
  }
  
  // Complete a session (mark as completed or failed)
  static async completeSession(
    sessionId: string,
    status: 'completed' | 'failed',
    summary?: any
  ): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    await db.query(`
      UPDATE flow_trace_sessions 
      SET status = $1, "endTime" = $2, summary = $3, "updatedAt" = $4
      WHERE id = $5
    `, [status, now, summary ? JSON.stringify(summary) : null, now, sessionId])
  }
  
  // Get subgraph traces for a parent trace
  static async getSubgraphTraces(parentTraceId: string): Promise<FlowTrace[]> {
    const db = await getDatabase()
    
    const result = await db.query(`
      SELECT * FROM flow_traces 
      WHERE "parentTraceId" = $1
      ORDER BY "timestamp" ASC
    `, [parentTraceId])
    
    return result.rows.map(row => {
      const trace: FlowTrace = {
        id: row.id,
        graphId: row.graphId,
        graphName: row.graphName,
        parentTraceId: row.parentTraceId,
        depth: row.depth,
        timestamp: row.timestamp,
        duration: row.duration,
        status: row.status,
        source: {
          nodeId: row.sourceNodeId,
          nodeName: row.sourceNodeName,
          nodeType: row.sourceNodeType,
          portId: row.sourcePortId,
          portName: row.sourcePortName,
          portType: row.sourcePortType
        },
        target: {
          nodeId: row.targetNodeId,
          nodeName: row.targetNodeName,
          nodeType: row.targetNodeType,
          portId: row.targetPortId,
          portName: row.targetPortName,
          portType: row.targetPortType
        },
        data: {
          payload: row.dataPayload ? JSON.parse(row.dataPayload) : null,
          size: row.dataSize,
          type: row.dataType || 'unknown'
        },
        error: row.errorMessage ? {
          message: row.errorMessage,
          code: row.errorCode,
          stack: row.errorStack
        } : undefined
      }
      return trace
    })
  }
}