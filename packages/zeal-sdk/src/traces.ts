/**
 * Traces API for ZIP SDK
 */

import { ZealClient } from './client'
import {
  CreateTraceSessionRequest,
  TraceEvent,
  ZealClientConfig,
} from './types'

export class TracesAPI {
  private sessionId: string | null = null
  
  constructor(private baseUrl: string, private config?: ZealClientConfig) {}
  
  /**
   * Create a new trace session
   */
  async createSession(
    request: CreateTraceSessionRequest
  ): Promise<{ sessionId: string; startTime: string }> {
    const response = await ZealClient.request(
      `${this.baseUrl}/api/zip/traces/sessions`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      this.config
    )
    
    this.sessionId = response.sessionId
    return response
  }
  
  /**
   * Submit trace events
   */
  async submitEvents(
    sessionId: string,
    events: TraceEvent[]
  ): Promise<{ success: boolean; eventsProcessed: number }> {
    return ZealClient.request(
      `${this.baseUrl}/api/zip/traces/${sessionId}/events`,
      {
        method: 'POST',
        body: JSON.stringify({ events }),
      },
      this.config
    )
  }
  
  /**
   * Submit a single trace event
   */
  async submitEvent(
    sessionId: string,
    event: TraceEvent
  ): Promise<{ success: boolean; eventsProcessed: number }> {
    return this.submitEvents(sessionId, [event])
  }
  
  /**
   * Complete a trace session
   */
  async completeSession(
    sessionId: string,
    request: {
      status: 'success' | 'error' | 'cancelled'
      summary?: {
        totalNodes: number
        successfulNodes: number
        failedNodes: number
        totalDuration: number
        totalDataProcessed: number
      }
      error?: {
        message: string
        nodeId?: string
        stack?: string
      }
    }
  ): Promise<{ success: boolean; sessionId: string; status: string }> {
    const response = await ZealClient.request(
      `${this.baseUrl}/api/zip/traces/${sessionId}/complete`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      this.config
    )
    
    if (this.sessionId === sessionId) {
      this.sessionId = null
    }
    
    return response
  }
  
  /**
   * Helper method to trace node execution
   */
  async traceNodeExecution(
    sessionId: string,
    nodeId: string,
    type: 'input' | 'output' | 'error',
    data: any,
    duration?: number
  ): Promise<void> {
    await this.submitEvent(sessionId, {
      timestamp: Date.now(),
      nodeId,
      eventType: type,
      data: {
        size: JSON.stringify(data).length,
        type: typeof data,
        preview: data,
      },
      duration,
    })
  }
  
  /**
   * Batch trace submission
   */
  async submitBatch(request: {
    sessionId: string
    events: TraceEvent[]
    isComplete?: boolean
  }): Promise<{ success: boolean }> {
    return ZealClient.request(
      `${this.baseUrl}/api/zip/traces/batch`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      },
      this.config
    )
  }
}