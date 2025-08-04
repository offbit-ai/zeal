import type { FlowTrace, FlowTraceSession, TraceNode, TraceData } from '@/types/flowTrace'
import type { WorkflowNodeData } from '@/types/workflow'
import type { Connection } from '@/types/workflow'
import { ApiError } from '@/types/api'

export class FlowTraceService {
  // Get all trace sessions from API
  static async getAllSessions(filters?: {
    search?: string
    status?: string
    timeFilter?: '1h' | '6h' | '24h' | '7d'
    page?: number
    limit?: number
  }): Promise<{ sessions: FlowTraceSession[]; total: number }> {
    try {
      const params = new URLSearchParams()
      if (filters?.search) params.append('search', filters.search)
      if (filters?.status) params.append('status', filters.status)
      if (filters?.timeFilter) params.append('timeFilter', filters.timeFilter)
      if (filters?.page) params.append('page', filters.page.toString())
      if (filters?.limit) params.append('limit', filters.limit.toString())

      const response = await fetch(`/api/flow-traces?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`)
      }

      const result = await response.json()
      return {
        sessions: result.data || [],
        total: result.meta?.pagination?.total || 0,
      }
    } catch (error) {
      console.error('Error loading trace sessions:', error)
      return { sessions: [], total: 0 }
    }
  }

  // Start a new trace session
  static async startSession(
    workflowId: string,
    workflowName: string,
    workflowVersionId?: string
  ): Promise<FlowTraceSession> {
    try {
      const response = await fetch('/api/flow-traces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId, workflowName, workflowVersionId }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`)
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Error starting trace session:', error)
      throw error
    }
  }

  // End a trace session
  static async endSession(
    sessionId: string,
    status: 'completed' | 'failed' = 'completed'
  ): Promise<void> {
    try {
      const response = await fetch(`/api/flow-traces/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error(`Failed to end session: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Error ending trace session:', error)
      throw error
    }
  }

  // Add a trace to the active session
  static async addTrace(
    sessionId: string,
    trace: Omit<FlowTrace, 'id' | 'timestamp'>
  ): Promise<FlowTrace> {
    try {
      const response = await fetch(`/api/flow-traces/sessions/${sessionId}/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trace),
      })

      if (!response.ok) {
        throw new Error(`Failed to add trace: ${response.statusText}`)
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Error adding trace:', error)
      throw error
    }
  }

  // Get a specific session with all traces
  static async getSession(sessionId: string): Promise<FlowTraceSession | null> {
    try {
      const response = await fetch(`/api/flow-traces/sessions/${sessionId}`)
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error(`Failed to fetch session: ${response.statusText}`)
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Error fetching session:', error)
      return null
    }
  }

  // Get replay data for a session
  static async getReplayData(
    sessionId: string,
    filters?: {
      search?: string
      status?: string
    }
  ): Promise<any> {
    try {
      const params = new URLSearchParams()
      if (filters?.search) params.append('search', filters.search)
      if (filters?.status) params.append('status', filters.status)

      const response = await fetch(`/api/flow-traces/sessions/${sessionId}/replay?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch replay data: ${response.statusText}`)
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Error fetching replay data:', error)
      throw error
    }
  }

  // Generate report for a session
  static async generateReport(
    sessionId: string,
    filters?: {
      search?: string
      status?: string
      format?: 'json' | 'text'
    }
  ): Promise<any> {
    try {
      const params = new URLSearchParams()
      if (filters?.search) params.append('search', filters.search)
      if (filters?.status) params.append('status', filters.status)
      if (filters?.format) params.append('format', filters.format)

      const response = await fetch(`/api/flow-traces/sessions/${sessionId}/report?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to generate report: ${response.statusText}`)
      }

      if (filters?.format === 'text') {
        return await response.text()
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Error generating report:', error)
      throw error
    }
  }

  // Get subgraph traces
  static async getSubgraphTraces(parentTraceId: string): Promise<FlowTrace[]> {
    try {
      const response = await fetch(`/api/flow-traces/traces/${parentTraceId}/subgraph`)
      if (!response.ok) {
        throw new Error(`Failed to fetch subgraph traces: ${response.statusText}`)
      }

      const result = await response.json()
      return result.data || []
    } catch (error) {
      console.error('Error fetching subgraph traces:', error)
      return []
    }
  }

  // Get workflow sessions
  static async getWorkflowSessions(
    workflowId: string,
    filters?: {
      page?: number
      limit?: number
      status?: string
      startTimeFrom?: string
      startTimeTo?: string
    }
  ): Promise<{ sessions: FlowTraceSession[]; total: number }> {
    try {
      const params = new URLSearchParams()
      if (filters?.page) params.append('page', filters.page.toString())
      if (filters?.limit) params.append('limit', filters.limit.toString())
      if (filters?.status) params.append('status', filters.status)
      if (filters?.startTimeFrom) params.append('startTimeFrom', filters.startTimeFrom)
      if (filters?.startTimeTo) params.append('startTimeTo', filters.startTimeTo)

      const response = await fetch(`/api/workflows/${workflowId}/flow-traces?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch workflow sessions: ${response.statusText}`)
      }

      const result = await response.json()
      return {
        sessions: result.data || [],
        total: result.meta?.pagination?.total || 0,
      }
    } catch (error) {
      console.error('Error loading workflow sessions:', error)
      return { sessions: [], total: 0 }
    }
  }

  // Clear old sessions (admin function)
  static async clearOldSessions(daysToKeep: number = 30): Promise<{ deleted: number }> {
    try {
      const response = await fetch(`/api/flow-traces/cleanup?daysToKeep=${daysToKeep}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Failed to clear sessions: ${response.statusText}`)
      }

      const result = await response.json()
      return result.data
    } catch (error) {
      console.error('Error clearing old sessions:', error)
      throw error
    }
  }

  // Generate simulated traces for testing
  static async generateSimulatedTraces(
    nodes: WorkflowNodeData[],
    connections: Connection[]
  ): Promise<FlowTraceSession> {
    const session = await this.startSession('demo-workflow', 'Demo Workflow')

    // Sample data payloads
    const sampleData = {
      database: {
        records: [
          { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'active' },
          { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'inactive' },
        ],
        count: 3,
      },
      aiResponse: {
        text: 'Based on the analysis, I recommend focusing on active users for the campaign.',
        confidence: 0.92,
        tokens: 18,
      },
      crmUpdate: {
        success: true,
        updated: 3,
        failed: 0,
        response: { status: 200, message: 'Records updated successfully' },
      },
      branchDecision: {
        condition: 'count > 2',
        result: true,
        evaluated: { count: 3 },
      },
      transformedData: {
        users: [
          { fullName: 'John Doe', isActive: true, domain: 'example.com' },
          { fullName: 'Jane Smith', isActive: true, domain: 'example.com' },
          { fullName: 'Bob Johnson', isActive: false, domain: 'example.com' },
        ],
        summary: { activeCount: 2, inactiveCount: 1, totalCount: 3 },
      },
    }

    // Generate traces for each connection
    for (let index = 0; index < connections.length; index++) {
      const connection = connections[index]
      const sourceNode = nodes.find(n => n.metadata.id === connection.source.nodeId)
      const targetNode = nodes.find(n => n.metadata.id === connection.target.nodeId)

      if (!sourceNode || !targetNode) continue

      const sourcePort = sourceNode.metadata.ports?.find(
        (p: any) => p.id === connection.source.portId
      )
      const targetPort = targetNode.metadata.ports?.find(
        (p: any) => p.id === connection.target.portId
      )

      if (!sourcePort || !targetPort) continue

      // Determine data based on node type
      let data: any = {}
      let dataType = 'object'

      if (sourceNode.metadata.type === 'database') {
        data =
          sourcePort.label === 'Count' ? sampleData.database.count : sampleData.database.records
        dataType = sourcePort.label === 'Count' ? 'number' : 'array'
      } else if (sourceNode.metadata.type === 'service') {
        data = sampleData.aiResponse
        dataType = 'object'
      } else if (sourceNode.metadata.type === 'code') {
        data = sampleData.crmUpdate
        dataType = 'object'
      } else if (sourceNode.metadata.type === 'condition') {
        data = sampleData.branchDecision
        dataType = 'object'
      } else if (sourceNode.metadata.type === 'transformer') {
        data = sampleData.transformedData
        dataType = 'object'
      }

      // Calculate data size
      const dataSize = JSON.stringify(data).length

      // Create trace with some randomization
      const duration = Math.floor(Math.random() * 500) + 100 // 100-600ms
      const statuses: FlowTrace['status'][] = ['success', 'success', 'success', 'warning']
      const status = statuses[Math.floor(Math.random() * statuses.length)]

      const trace: Omit<FlowTrace, 'id' | 'timestamp'> = {
        duration,
        status,
        graphId: undefined,
        graphName: undefined,
        source: {
          nodeId: sourceNode.metadata.id,
          nodeName: sourceNode.metadata.title,
          nodeType: sourceNode.metadata.type,
          portId: sourcePort.id,
          portName: sourcePort.label,
          portType: sourcePort.type,
        },
        target: {
          nodeId: targetNode.metadata.id,
          nodeName: targetNode.metadata.title,
          nodeType: targetNode.metadata.type,
          portId: targetPort.id,
          portName: targetPort.label,
          portType: targetPort.type,
        },
        data: {
          payload: data,
          size: dataSize,
          type: dataType,
          preview: JSON.stringify(data).substring(0, 100) + '...',
        },
      }

      // Add error for some traces
      if (status === 'error') {
        trace.error = {
          message: 'Connection timeout',
          code: 'TIMEOUT_ERROR',
        }
      }

      await this.addTrace(session.id, trace)
    }

    await this.endSession(session.id, 'completed')
    return session
  }
}
