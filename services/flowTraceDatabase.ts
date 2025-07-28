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
    
    await db.run(`
      INSERT INTO flow_trace_sessions (
        id, workflowId, workflowVersionId, workflowName, 
        startTime, status, userId, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
    
    await db.run(`
      INSERT INTO flow_traces (
        id, sessionId, timestamp, duration, status,
        sourceNodeId, sourceNodeName, sourceNodeType, 
        sourcePortId, sourcePortName, sourcePortType,
        targetNodeId, targetNodeName, targetNodeType,
        targetPortId, targetPortName, targetPortType,
        dataPayload, dataSize, dataType, dataPreview,
        errorMessage, errorCode, errorStack,
        graphId, graphName, parentTraceId, depth,
        createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      JSON.stringify(data.data.payload),
      data.data.size,
      data.data.type,
      data.data.preview || null,
      data.error?.message || null,
      data.error?.code || null,
      data.error?.stack || null,
      data.graphId || 'main',
      data.graphName || 'Main',
      data.parentTraceId || null,
      data.depth || 0,
      now
    ])
    
    // Update session summary
    await this.updateSessionSummary(sessionId)
    
    return {
      id: traceId,
      timestamp: now,
      duration: data.duration,
      status: data.status,
      source: data.source,
      target: data.target,
      data: data.data,
      error: data.error
    }
  }
  
  // Complete a session
  static async completeSession(sessionId: string, status: 'completed' | 'failed'): Promise<void> {
    const db = await getDatabase()
    const now = new Date().toISOString()
    
    await db.run(`
      UPDATE flow_trace_sessions 
      SET status = ?, endTime = ?
      WHERE id = ?
    `, [status, now, sessionId])
    
    await this.updateSessionSummary(sessionId)
  }
  
  // Update session summary statistics
  private static async updateSessionSummary(sessionId: string): Promise<void> {
    const db = await getDatabase()
    
    const stats = await db.get(`
      SELECT 
        COUNT(*) as totalTraces,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successCount,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as errorCount,
        COUNT(CASE WHEN status = 'warning' THEN 1 END) as warningCount,
        SUM(dataSize) as totalDataSize,
        AVG(duration) as averageDuration
      FROM flow_traces
      WHERE sessionId = ?
    `, sessionId)
    
    const summary = {
      totalTraces: stats.totalTraces || 0,
      successCount: stats.successCount || 0,
      errorCount: stats.errorCount || 0,
      warningCount: stats.warningCount || 0,
      totalDataSize: stats.totalDataSize || 0,
      averageDuration: stats.averageDuration || 0
    }
    
    await db.run(`
      UPDATE flow_trace_sessions
      SET summary = ?
      WHERE id = ?
    `, [JSON.stringify(summary), sessionId])
  }
  
  // Get a session with all its traces
  static async getSession(sessionId: string): Promise<FlowTraceSession | null> {
    const db = await getDatabase()
    
    const session = await db.get(`
      SELECT * FROM flow_trace_sessions WHERE id = ?
    `, sessionId)
    
    if (!session) return null
    
    // Get all traces for this session
    const traces = await db.all(`
      SELECT * FROM flow_traces 
      WHERE sessionId = ? 
      ORDER BY timestamp ASC
    `, sessionId)
    
    return {
      id: session.id,
      workflowId: session.workflowId,
      workflowName: session.workflowName,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      traces: traces.map(trace => ({
        id: trace.id,
        timestamp: trace.timestamp,
        duration: trace.duration,
        status: trace.status,
        source: {
          nodeId: trace.sourceNodeId,
          nodeName: trace.sourceNodeName,
          nodeType: trace.sourceNodeType,
          portId: trace.sourcePortId,
          portName: trace.sourcePortName,
          portType: trace.sourcePortType
        },
        target: {
          nodeId: trace.targetNodeId,
          nodeName: trace.targetNodeName,
          nodeType: trace.targetNodeType,
          portId: trace.targetPortId,
          portName: trace.targetPortName,
          portType: trace.targetPortType
        },
        data: {
          payload: JSON.parse(trace.dataPayload || '{}'),
          size: trace.dataSize,
          type: trace.dataType,
          preview: trace.dataPreview
        },
        error: trace.errorMessage ? {
          message: trace.errorMessage,
          code: trace.errorCode,
          stack: trace.errorStack
        } : undefined
      })),
      summary: session.summary ? JSON.parse(session.summary) : {
        totalTraces: 0,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        totalDataSize: 0,
        averageDuration: 0
      }
    }
  }
  
  // Get subgraph traces for a parent trace
  static async getSubgraphTraces(parentTraceId: string): Promise<FlowTrace[]> {
    const db = await getDatabase()
    
    const traces = await db.all(`
      SELECT * FROM flow_traces 
      WHERE parentTraceId = ? 
      ORDER BY timestamp ASC
    `, parentTraceId)
    
    return traces.map(trace => ({
      id: trace.id,
      timestamp: trace.timestamp,
      duration: trace.duration,
      status: trace.status,
      source: {
        nodeId: trace.sourceNodeId,
        nodeName: trace.sourceNodeName,
        nodeType: trace.sourceNodeType,
        portId: trace.sourcePortId,
        portName: trace.sourcePortName,
        portType: trace.sourcePortType
      },
      target: {
        nodeId: trace.targetNodeId,
        nodeName: trace.targetNodeName,
        nodeType: trace.targetNodeType,
        portId: trace.targetPortId,
        portName: trace.targetPortName,
        portType: trace.targetPortType
      },
      data: {
        payload: JSON.parse(trace.dataPayload || '{}'),
        size: trace.dataSize,
        type: trace.dataType,
        preview: trace.dataPreview
      },
      error: trace.errorMessage ? {
        message: trace.errorMessage,
        code: trace.errorCode,
        stack: trace.errorStack
      } : undefined
    }))
  }
  
  // Get all sessions for a workflow
  static async getWorkflowSessions(workflowId: string, options?: {
    limit?: number
    offset?: number
    status?: string
    startTimeFrom?: string
    startTimeTo?: string
  }): Promise<{ sessions: FlowTraceSession[], total: number }> {
    const db = await getDatabase()
    const { limit = 50, offset = 0, status, startTimeFrom, startTimeTo } = options || {}
    
    // Build query conditions
    const conditions = ['workflowId = ?']
    const params = [workflowId]
    
    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }
    
    if (startTimeFrom) {
      conditions.push('startTime >= ?')
      params.push(startTimeFrom)
    }
    
    if (startTimeTo) {
      conditions.push('startTime <= ?')
      params.push(startTimeTo)
    }
    
    const whereClause = conditions.join(' AND ')
    
    // Get total count
    const countResult = await db.get(
      `SELECT COUNT(*) as count FROM flow_trace_sessions WHERE ${whereClause}`,
      params
    )
    const total = countResult?.count || 0
    
    // Get sessions
    const sessions = await db.all(`
      SELECT * FROM flow_trace_sessions 
      WHERE ${whereClause}
      ORDER BY startTime DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])
    
    // Convert sessions and parse summaries
    const sessionResults = sessions.map(session => ({
      id: session.id,
      workflowId: session.workflowId,
      workflowName: session.workflowName,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      traces: [], // Don't load traces for list view
      summary: session.summary ? JSON.parse(session.summary) : {
        totalTraces: 0,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        totalDataSize: 0,
        averageDuration: 0
      }
    }))
    
    return { sessions: sessionResults, total }
  }
  
  // Get all sessions (for all workflows)
  static async getAllSessions(userId: string, options?: {
    limit?: number
    offset?: number
    search?: string
    status?: string
    timeFilter?: '1h' | '6h' | '24h' | '7d'
  }): Promise<{ sessions: FlowTraceSession[], total: number }> {
    const db = await getDatabase()
    const { limit = 50, offset = 0, search, status, timeFilter } = options || {}
    
    // Build query conditions
    const conditions = ['userId = ?']
    const params = [userId]
    
    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }
    
    if (search) {
      conditions.push('workflowName LIKE ?')
      params.push(`%${search}%`)
    }
    
    if (timeFilter) {
      const now = new Date()
      const filterMs = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
      }[timeFilter]
      
      const fromTime = new Date(now.getTime() - filterMs).toISOString()
      conditions.push('startTime >= ?')
      params.push(fromTime)
    }
    
    const whereClause = conditions.join(' AND ')
    
    // Get total count
    const countResult = await db.get(
      `SELECT COUNT(*) as count FROM flow_trace_sessions WHERE ${whereClause}`,
      params
    )
    const total = countResult?.count || 0
    
    // Get sessions
    const sessions = await db.all(`
      SELECT * FROM flow_trace_sessions 
      WHERE ${whereClause}
      ORDER BY startTime DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset])
    
    // Convert sessions and parse summaries
    const sessionResults = sessions.map(session => ({
      id: session.id,
      workflowId: session.workflowId,
      workflowName: session.workflowName,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      traces: [], // Don't load traces for list view
      summary: session.summary ? JSON.parse(session.summary) : {
        totalTraces: 0,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        totalDataSize: 0,
        averageDuration: 0
      }
    }))
    
    return { sessions: sessionResults, total }
  }
  
  // Delete old sessions (cleanup)
  static async deleteOldSessions(daysToKeep: number = 30): Promise<number> {
    const db = await getDatabase()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    const result = await db.run(`
      DELETE FROM flow_trace_sessions
      WHERE startTime < ?
    `, cutoffDate.toISOString())
    
    return result.changes || 0
  }
}