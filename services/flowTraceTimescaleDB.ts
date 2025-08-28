import { getTimescaleDB, executeWithRetry } from '@/lib/timescaledb-config'
import { generateTraceSessionId, generateTraceId } from '@/lib/database'
import type {
  FlowTrace,
  FlowTraceSession,
  TraceNode,
  TraceData,
  TraceError,
} from '@/types/flowTrace'
import { ApiError } from '@/types/api'
import { webhookEvents } from '@/services/event-bus'

/**
 * FlowTraceTimescaleDB - Time-series optimized flow trace operations
 * Uses TimescaleDB for efficient time-series data storage and querying
 */
export class FlowTraceTimescaleDB {
  // Create a new trace session
  static async createSession(data: {
    workflowId: string
    workflowVersionId?: string
    workflowName: string
    userId: string
    metadata?: Record<string, any>
  }): Promise<FlowTraceSession> {
    const db = await getTimescaleDB()
    const sessionId = generateTraceSessionId()
    const now = new Date().toISOString()

    await db.query(
      `
      INSERT INTO flow_trace_sessions (
        id, workflow_id, workflow_version_id, workflow_name, 
        start_time, status, user_id, created_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
      [
        sessionId,
        data.workflowId,
        data.workflowVersionId || null,
        data.workflowName,
        now,
        'running',
        data.userId,
        now,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    )

    const session = {
      id: sessionId,
      workflowId: data.workflowId,
      workflowName: data.workflowName,
      startTime: now,
      traces: [],
      status: 'running' as const,
      metadata: data.metadata,
      summary: {
        totalTraces: 0,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        totalDataSize: 0,
        averageDuration: 0,
      },
    }
    
    // Emit webhook event
    await webhookEvents.executionStarted(data.workflowId, sessionId, {
      sessionId,
      workflowName: data.workflowName,
      startTime: now,
      metadata: data.metadata,
    })
    
    return session
  }

  // Add a trace to a session
  static async addTrace(
    sessionId: string,
    data: {
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
    }
  ): Promise<FlowTrace> {
    const db = await getTimescaleDB()
    const traceId = generateTraceId()
    const now = new Date().toISOString()

    await db.query(
      `
      INSERT INTO flow_traces (
        id, session_id, timestamp, duration, status,
        source_node_id, source_node_name, source_node_type, 
        source_port_id, source_port_name, source_port_type,
        target_node_id, target_node_name, target_node_type,
        target_port_id, target_port_name, target_port_type,
        data_payload, data_size, data_type, data_preview,
        error_message, error_code, error_stack,
        graph_id, graph_name, parent_trace_id, depth,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
    `,
      [
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
        now,
      ]
    )

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
      depth: data.depth || 0,
    }

    return trace
  }

  // Add a single event to a session
  static async addEvent(data: {
    id: string
    sessionId: string
    timestamp: string
    nodeId: string
    portId?: string
    eventType: 'input' | 'output' | 'error' | 'log' | 'start' | 'complete'
    data: any
    duration?: number
    metadata?: any
  }): Promise<void> {
    const db = await getTimescaleDB()
    
    await db.query(
      `
      INSERT INTO flow_trace_events (
        id, session_id, node_id, port_id, timestamp,
        event_type, data, duration, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        data.id,
        data.sessionId,
        data.nodeId,
        data.portId || null,
        data.timestamp,
        data.eventType,
        JSON.stringify(data.data),
        data.duration || null,
        JSON.stringify(data.metadata || {}),
        new Date().toISOString(),
      ]
    )
    
    // Emit webhook event for trace
    await webhookEvents.traceEvent(data.sessionId, data.nodeId, {
      eventType: data.eventType,
      data: data.data,
      duration: data.duration,
      metadata: data.metadata,
    })
  }

  // Update session status and summary
  static async updateSession(
    sessionId: string,
    data: {
      status?: 'running' | 'completed' | 'failed' | 'cancelled',
      endTime?: string,
      summary?: any,
      error?: any
    }
  ): Promise<void> {
    const db = await getTimescaleDB()
    const now = new Date().toISOString()

    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (data.status) {
      values.push(data.status)
      updates.push(`status = $${++paramCount}`)

      if (data.status !== 'running') {
        values.push(now)
        updates.push(`end_time = $${++paramCount}`)
      }
    }

    if (data.summary) {
      values.push(JSON.stringify(data.summary))
      updates.push(`summary = $${++paramCount}`)
    }

    values.push(now)
    updates.push(`updated_at = $${++paramCount}`)

    if (updates.length > 0) {
      values.push(sessionId)
      await db.query(
        `UPDATE flow_trace_sessions SET ${updates.join(', ')} WHERE id = $${++paramCount}`,
        values
      )
    }
  }

  // Get session by ID with TimescaleDB optimizations
  static async getSession(sessionId: string): Promise<FlowTraceSession | null> {
    const db = await getTimescaleDB()

    // Get session details
    const sessionResult = await db.query(
      'SELECT * FROM flow_trace_sessions WHERE id = $1',
      [sessionId]
    )

    const session = sessionResult.rows[0]
    if (!session) return null

    // Get all traces for this session using time-series optimized query
    const tracesResult = await db.query(
      `SELECT * FROM flow_traces 
       WHERE session_id = $1 
       ORDER BY timestamp ASC`,
      [sessionId]
    )

    const traces: FlowTrace[] = tracesResult.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      duration: row.duration,
      status: row.status,
      source: {
        nodeId: row.source_node_id,
        nodeName: row.source_node_name,
        nodeType: row.source_node_type,
        portId: row.source_port_id,
        portName: row.source_port_name,
        portType: row.source_port_type,
      },
      target: {
        nodeId: row.target_node_id,
        nodeName: row.target_node_name,
        nodeType: row.target_node_type,
        portId: row.target_port_id,
        portName: row.target_port_name,
        portType: row.target_port_type,
      },
      data: {
        payload: row.data_payload,
        size: row.data_size,
        type: row.data_type,
        preview: row.data_preview,
      },
      error: row.error_message
        ? {
            message: row.error_message,
            code: row.error_code,
            stack: row.error_stack,
          }
        : undefined,
      graphId: row.graph_id,
      graphName: row.graph_name,
      parentTraceId: row.parent_trace_id,
      depth: row.depth,
    }))

    return {
      id: session.id,
      workflowId: session.workflow_id,
      workflowName: session.workflow_name,
      startTime: session.start_time,
      endTime: session.end_time,
      traces,
      status: session.status,
      metadata: session.metadata,
      summary: session.summary || {
        totalTraces: traces.length,
        successCount: traces.filter(t => t.status === 'success').length,
        errorCount: traces.filter(t => t.status === 'error').length,
        warningCount: traces.filter(t => t.status === 'warning').length,
        totalDataSize: traces.reduce((sum, t) => sum + t.data.size, 0),
        averageDuration:
          traces.length > 0
            ? traces.reduce((sum, t) => sum + t.duration, 0) / traces.length
            : 0,
      },
    }
  }

  // Time travel: Get workflow state at a specific point in time
  static async getWorkflowStateAt(
    workflowId: string,
    timestamp: Date
  ): Promise<any> {
    const db = await getTimescaleDB()
    
    const result = await db.query(
      'SELECT * FROM get_workflow_state_at($1, $2)',
      [workflowId, timestamp.toISOString()]
    )
    
    return result.rows
  }

  // Replay traces between two timestamps
  static async replayTraces(
    sessionId: string,
    startTime: Date,
    endTime: Date
  ): Promise<any[]> {
    const db = await getTimescaleDB()
    
    const result = await db.query(
      'SELECT * FROM replay_traces($1, $2, $3)',
      [sessionId, startTime.toISOString(), endTime.toISOString()]
    )
    
    return result.rows
  }

  // Get execution timeline with configurable buckets
  static async getExecutionTimeline(
    sessionId: string,
    intervalSeconds = 1
  ): Promise<any[]> {
    const db = await getTimescaleDB()
    
    const result = await db.query(
      'SELECT * FROM get_execution_timeline($1, $2)',
      [sessionId, intervalSeconds]
    )
    
    return result.rows
  }

  // Get aggregated statistics from continuous aggregates
  static async getSessionStats(
    workflowId: string,
    timeRange: {
      start: Date
      end: Date
      bucket: 'hour' | 'day'
    }
  ): Promise<any[]> {
    const db = await getTimescaleDB()
    
    const view = timeRange.bucket === 'hour' 
      ? 'session_stats_hourly' 
      : 'session_stats_daily'
    
    const result = await db.query(
      `SELECT * FROM ${view}
       WHERE workflow_id = $1 
         AND ${timeRange.bucket} >= $2 
         AND ${timeRange.bucket} <= $3
       ORDER BY ${timeRange.bucket}`,
      [workflowId, timeRange.start.toISOString(), timeRange.end.toISOString()]
    )
    
    return result.rows
  }

  // Get node performance metrics
  static async getNodePerformance(
    nodeId: string,
    hours = 24
  ): Promise<any[]> {
    const db = await getTimescaleDB()
    
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)
    
    const result = await db.query(
      `SELECT * FROM node_performance_hourly
       WHERE target_node_id = $1 
         AND hour >= $2
       ORDER BY hour DESC`,
      [nodeId, startTime.toISOString()]
    )
    
    return result.rows
  }

  // List sessions with pagination and TimescaleDB optimizations
  static async listSessions(params: {
    workflowId?: string
    status?: string
    limit?: number
    offset?: number
    startDate?: string
    endDate?: string
  }): Promise<{ sessions: FlowTraceSession[]; total: number }> {
    const db = await getTimescaleDB()
    const { workflowId, status, limit = 20, offset = 0, startDate, endDate } = params

    let whereClause = 'WHERE 1=1'
    const queryParams: any[] = []
    let paramCount = 0

    if (workflowId) {
      queryParams.push(workflowId)
      whereClause += ` AND workflow_id = $${++paramCount}`
    }

    if (status) {
      queryParams.push(status)
      whereClause += ` AND status = $${++paramCount}`
    }

    if (startDate) {
      queryParams.push(startDate)
      whereClause += ` AND start_time >= $${++paramCount}`
    }

    if (endDate) {
      queryParams.push(endDate)
      whereClause += ` AND start_time <= $${++paramCount}`
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM flow_trace_sessions ${whereClause}`,
      queryParams
    )
    const total = parseInt(countResult.rows[0]?.count || '0')

    // Get sessions with pagination - optimized for time-series
    queryParams.push(limit)
    queryParams.push(offset)
    
    const sessionsResult = await db.query(
      `SELECT * FROM flow_trace_sessions 
       ${whereClause} 
       ORDER BY start_time DESC
       LIMIT $${++paramCount} OFFSET $${++paramCount}`,
      queryParams
    )

    const sessions: FlowTraceSession[] = sessionsResult.rows.map(row => ({
      id: row.id,
      workflowId: row.workflow_id,
      workflowName: row.workflow_name,
      startTime: row.start_time,
      endTime: row.end_time,
      traces: [], // Don't load traces for list view
      status: row.status,
      metadata: row.metadata,
      summary: row.summary || {
        totalTraces: 0,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        totalDataSize: 0,
        averageDuration: 0,
      },
    }))

    return { sessions, total }
  }

  // Complete a session
  static async completeSession(
    sessionId: string,
    status: 'completed' | 'failed',
    summary?: any
  ): Promise<void> {
    const db = await getTimescaleDB()
    const now = new Date().toISOString()

    await db.query(
      `
      UPDATE flow_trace_sessions 
      SET status = $1, end_time = $2, summary = $3, updated_at = $4
      WHERE id = $5
    `,
      [status, now, summary ? JSON.stringify(summary) : null, now, sessionId]
    )
    
    // Emit webhook event based on status
    if (status === 'completed') {
      const sessionData = await this.getSession(sessionId)
      if (sessionData) {
        await webhookEvents.executionCompleted(sessionData.workflowId, sessionId, {
          sessionId,
          endTime: now,
          summary,
        })
      }
    } else if (status === 'failed') {
      const sessionData = await this.getSession(sessionId)
      if (sessionData) {
        await webhookEvents.executionFailed(sessionData.workflowId, sessionId, {
          sessionId,
          endTime: now,
          summary,
        })
      }
    }
  }

  // Get all events for a session
  static async getSessionEvents(sessionId: string): Promise<any[]> {
    const db = await getTimescaleDB()
    
    const result = await db.query(
      `
      SELECT * FROM flow_trace_events 
      WHERE session_id = $1 
      ORDER BY timestamp ASC
      `,
      [sessionId]
    )
    
    return result.rows.map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      nodeId: row.node_id,
      portId: row.port_id,
      timestamp: row.timestamp,
      eventType: row.event_type,
      data: row.data,
      duration: row.duration,
      metadata: row.metadata,
    }))
  }

  // Health check for TimescaleDB
  static async healthCheck(): Promise<{
    healthy: boolean
    details?: any
  }> {
    try {
      const db = await getTimescaleDB()
      
      // Check hypertable status
      const hypertableResult = await db.query(`
        SELECT hypertable_name, 
               num_chunks,
               compression_enabled,
               replication_factor
        FROM timescaledb_information.hypertables
        WHERE hypertable_name IN ('flow_trace_sessions', 'flow_traces', 'flow_trace_events')
      `)
      
      // Check retention policy status
      const retentionResult = await db.query(`
        SELECT hypertable_name,
               drop_after,
               schedule_interval
        FROM timescaledb_information.retention_policies
      `)
      
      // Check continuous aggregate status
      const aggregateResult = await db.query(`
        SELECT view_name,
               refresh_lag,
               refresh_interval
        FROM timescaledb_information.continuous_aggregate_stats
      `)
      
      return {
        healthy: true,
        details: {
          hypertables: hypertableResult.rows,
          retentionPolicies: retentionResult.rows,
          continuousAggregates: aggregateResult.rows,
        }
      }
    } catch (error) {
      console.error('TimescaleDB health check failed:', error)
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }
  }
}