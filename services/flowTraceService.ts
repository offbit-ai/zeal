import type { FlowTrace, FlowTraceSession, TraceNode, TraceData } from '@/types/flowTrace'
import type { WorkflowNode } from '@/store/workflowStore'
import type { Connection } from '@/types/workflow'

const TRACE_STORAGE_KEY = 'zeal_flow_traces'
const MAX_SESSIONS = 50

export class FlowTraceService {
  private static activeSessions = new Map<string, FlowTraceSession>()

  // Get all trace sessions from storage
  static getAllSessions(): FlowTraceSession[] {
    try {
      const data = localStorage.getItem(TRACE_STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('Error loading trace sessions:', error)
      return []
    }
  }

  // Save sessions to storage
  private static saveToStorage() {
    try {
      const sessions = Array.from(this.activeSessions.values())
        .concat(this.getAllSessions().filter(s => !this.activeSessions.has(s.id)))
        .slice(0, MAX_SESSIONS)
      
      localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(sessions))
    } catch (error) {
      console.error('Error saving trace sessions:', error)
    }
  }

  // Start a new trace session
  static startSession(workflowId: string, workflowName: string): FlowTraceSession {
    const session: FlowTraceSession = {
      id: crypto.randomUUID(),
      workflowId,
      workflowName,
      startTime: new Date().toISOString(),
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

    this.activeSessions.set(session.id, session)
    return session
  }

  // End a trace session
  static endSession(sessionId: string, status: 'completed' | 'failed' = 'completed') {
    const session = this.activeSessions.get(sessionId)
    if (!session) return

    session.endTime = new Date().toISOString()
    session.status = status
    
    this.saveToStorage()
    this.activeSessions.delete(sessionId)
  }

  // Add a trace to the active session
  static addTrace(sessionId: string, trace: Omit<FlowTrace, 'id'>) {
    const session = this.activeSessions.get(sessionId)
    if (!session || session.status !== 'running') return

    const fullTrace: FlowTrace = {
      ...trace,
      id: crypto.randomUUID()
    }

    session.traces.push(fullTrace)
    
    // Update summary
    session.summary.totalTraces++
    if (trace.status === 'success') session.summary.successCount++
    else if (trace.status === 'error') session.summary.errorCount++
    else if (trace.status === 'warning') session.summary.warningCount++
    
    session.summary.totalDataSize += trace.data.size
    session.summary.averageDuration = session.traces.reduce((sum, t) => sum + t.duration, 0) / session.traces.length
  }

  // Get a specific session
  static getSession(sessionId: string): FlowTraceSession | null {
    return this.activeSessions.get(sessionId) || 
           this.getAllSessions().find(s => s.id === sessionId) || 
           null
  }

  // Clear all sessions
  static clearAllSessions() {
    this.activeSessions.clear()
    localStorage.removeItem(TRACE_STORAGE_KEY)
  }

  // Generate simulated traces for testing
  static generateSimulatedTraces(nodes: WorkflowNode[], connections: Connection[]): FlowTraceSession {
    const session = this.startSession('demo-workflow', 'Demo Workflow')
    
    // Sample data payloads
    const sampleData = {
      database: {
        records: [
          { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'active' },
          { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'inactive' }
        ],
        count: 3
      },
      aiResponse: {
        text: 'Based on the analysis, I recommend focusing on active users for the campaign.',
        confidence: 0.92,
        tokens: 18
      },
      crmUpdate: {
        success: true,
        updated: 3,
        failed: 0,
        response: { status: 200, message: 'Records updated successfully' }
      },
      branchDecision: {
        condition: 'count > 2',
        result: true,
        evaluated: { count: 3 }
      },
      transformedData: {
        users: [
          { fullName: 'John Doe', isActive: true, domain: 'example.com' },
          { fullName: 'Jane Smith', isActive: true, domain: 'example.com' },
          { fullName: 'Bob Johnson', isActive: false, domain: 'example.com' }
        ],
        summary: { activeCount: 2, inactiveCount: 1, totalCount: 3 }
      }
    }

    // Generate traces for each connection
    connections.forEach((connection, index) => {
      const sourceNode = nodes.find(n => n.metadata.id === connection.source.nodeId)
      const targetNode = nodes.find(n => n.metadata.id === connection.target.nodeId)
      
      if (!sourceNode || !targetNode) return

      const sourcePort = sourceNode.metadata.ports.find(p => p.id === connection.source.portId)
      const targetPort = targetNode.metadata.ports.find(p => p.id === connection.target.portId)
      
      if (!sourcePort || !targetPort) return

      // Determine data based on node type
      let data: any = {}
      let dataType = 'object'
      
      if (sourceNode.metadata.type === 'database') {
        data = sourcePort.label === 'Count' ? sampleData.database.count : sampleData.database.records
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

      const trace: Omit<FlowTrace, 'id'> = {
        timestamp: new Date(Date.now() + index * 1000).toISOString(),
        duration,
        status,
        source: {
          nodeId: sourceNode.metadata.id,
          nodeName: sourceNode.metadata.title,
          nodeType: sourceNode.metadata.type,
          portId: sourcePort.id,
          portName: sourcePort.label,
          portType: sourcePort.type
        },
        target: {
          nodeId: targetNode.metadata.id,
          nodeName: targetNode.metadata.title,
          nodeType: targetNode.metadata.type,
          portId: targetPort.id,
          portName: targetPort.label,
          portType: targetPort.type
        },
        data: {
          payload: data,
          size: dataSize,
          type: dataType,
          preview: JSON.stringify(data).substring(0, 100) + '...'
        }
      }

      // Add error for some traces
      if (status === 'error') {
        trace.error = {
          message: 'Connection timeout',
          code: 'TIMEOUT_ERROR'
        }
      }

      this.addTrace(session.id, trace)
    })

    this.endSession(session.id, 'completed')
    return session
  }
}