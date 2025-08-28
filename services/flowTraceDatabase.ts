import { FlowTraceTimescaleDB } from '@/services/flowTraceTimescaleDB'
import type {
  FlowTrace,
  FlowTraceSession,
  TraceNode,
  TraceData,
  TraceError,
} from '@/types/flowTrace'
import { ApiError } from '@/types/api'

/**
 * FlowTraceDatabase - Facade that delegates to TimescaleDB implementation
 * Maintains backward compatibility while using TimescaleDB underneath
 */
export class FlowTraceDatabase {
  // Create a new trace session - delegates to TimescaleDB
  static async createSession(data: {
    workflowId: string
    workflowVersionId?: string
    workflowName: string
    userId: string
    metadata?: Record<string, any>
  }): Promise<FlowTraceSession> {
    return FlowTraceTimescaleDB.createSession(data)
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
    return FlowTraceTimescaleDB.addTrace(sessionId, data)
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
    return FlowTraceTimescaleDB.updateSession(sessionId, data)
  }

  // Get session by ID
  static async getSession(sessionId: string): Promise<FlowTraceSession | null> {
    return FlowTraceTimescaleDB.getSession(sessionId)
  }

  // Get sessions for a user with pagination
  static async getSessions(
    userId: string,
    params: {
      status?: string
      limit?: number
      offset?: number
      search?: string
      startDate?: string
      endDate?: string
    }
  ): Promise<{ sessions: FlowTraceSession[]; total: number }> {
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
    return FlowTraceTimescaleDB.listSessions(params)
  }

  // Delete old sessions - not supported in TimescaleDB (uses retention policies instead)
  static async deleteOldSessions(olderThan: Date): Promise<number> {
    console.warn('deleteOldSessions is deprecated. TimescaleDB uses automatic retention policies.')
    return 0
  }

  // Get trace analytics - delegates to TimescaleDB aggregated views
  static async getTraceAnalytics(
    workflowId: string,
    timeRange: {
      start: Date
      end: Date
    }
  ): Promise<{
    totalSessions: number
    averageSessionDuration: number
    successRate: number
    errorRate: number
    mostFrequentErrors: Array<{ code: string; count: number }>
    slowestNodes: Array<{ nodeId: string; nodeName: string; avgDuration: number }>
  }> {
    // Use TimescaleDB continuous aggregates for efficient analytics
    const stats = await FlowTraceTimescaleDB.getSessionStats(workflowId, {
      start: timeRange.start,
      end: timeRange.end,
      bucket: 'hour'
    })
    
    // Calculate aggregated metrics from the hourly stats
    const totalSessions = stats.reduce((sum, s) => sum + s.session_count, 0)
    const successCount = stats.reduce((sum, s) => sum + s.completed_count, 0)
    const failCount = stats.reduce((sum, s) => sum + s.failed_count, 0)
    const avgDuration = stats.reduce((sum, s) => sum + s.avg_duration_ms, 0) / (stats.length || 1)
    
    // Get node performance data
    const nodePerf = await Promise.all(
      Array.from(new Set(stats.map(s => s.workflow_id)))
        .slice(0, 10)
        .map(nodeId => FlowTraceTimescaleDB.getNodePerformance(nodeId, 24))
    )
    
    const slowestNodes = nodePerf
      .flat()
      .sort((a, b) => b.avg_duration - a.avg_duration)
      .slice(0, 10)
      .map(n => ({
        nodeId: n.target_node_id,
        nodeName: n.target_node_name,
        avgDuration: n.avg_duration
      }))
    
    return {
      totalSessions,
      averageSessionDuration: avgDuration,
      successRate: totalSessions > 0 ? (successCount / totalSessions) * 100 : 0,
      errorRate: totalSessions > 0 ? (failCount / totalSessions) * 100 : 0,
      mostFrequentErrors: [], // Would need a separate query for error codes
      slowestNodes,
    }
  }

  // Complete a session (mark as completed or failed)
  static async completeSession(
    sessionId: string,
    status: 'completed' | 'failed',
    summary?: any
  ): Promise<void> {
    return FlowTraceTimescaleDB.completeSession(sessionId, status, summary)
  }

  // Get subgraph traces for a parent trace
  static async getSubgraphTraces(parentTraceId: string): Promise<FlowTrace[]> {
    // This would need to be implemented in TimescaleDB service
    // For now, return empty array
    console.warn('getSubgraphTraces needs to be implemented in TimescaleDB service')
    return []
  }

  // Add a single event to a session
  static async addEvent(data: {
    id: string
    sessionId: string
    timestamp: string
    nodeId: string
    portId?: string
    eventType: 'input' | 'output' | 'error' | 'log'
    data: any
    duration?: number
    metadata?: any
  }): Promise<void> {
    return FlowTraceTimescaleDB.addEvent({
      ...data,
      eventType: data.eventType as 'input' | 'output' | 'error' | 'log' | 'start' | 'complete'
    })
  }

  // Get all events for a session
  static async getSessionEvents(sessionId: string): Promise<any[]> {
    return FlowTraceTimescaleDB.getSessionEvents(sessionId)
  }

  // Get a single session by ID
  static async getSessionById(sessionId: string): Promise<FlowTraceSession | null> {
    return FlowTraceTimescaleDB.getSession(sessionId)
  }

  // ============================================================================
  // NEW TIMESCALEDB-SPECIFIC FEATURES
  // ============================================================================

  /**
   * Time travel: Get workflow state at a specific point in time
   */
  static async getWorkflowStateAt(
    workflowId: string,
    timestamp: Date
  ): Promise<any> {
    return FlowTraceTimescaleDB.getWorkflowStateAt(workflowId, timestamp)
  }

  /**
   * Replay traces between two timestamps
   */
  static async replayTraces(
    sessionId: string,
    startTime: Date,
    endTime: Date
  ): Promise<any[]> {
    return FlowTraceTimescaleDB.replayTraces(sessionId, startTime, endTime)
  }

  /**
   * Get execution timeline with configurable buckets
   */
  static async getExecutionTimeline(
    sessionId: string,
    intervalSeconds = 1
  ): Promise<any[]> {
    return FlowTraceTimescaleDB.getExecutionTimeline(sessionId, intervalSeconds)
  }

  /**
   * Health check for TimescaleDB
   */
  static async healthCheck(): Promise<{
    healthy: boolean
    details?: any
  }> {
    return FlowTraceTimescaleDB.healthCheck()
  }
}