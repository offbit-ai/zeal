/**
 * Orchestrator API for ZIP SDK
 */

import { ZealClient } from './client'
import {
  CreateWorkflowRequest,
  CreateWorkflowResponse,
  AddNodeRequest,
  AddNodeResponse,
  ConnectNodesRequest,
} from './types'

export class OrchestratorAPI {
  constructor(private baseUrl: string) {}
  
  /**
   * Create a new workflow
   */
  async createWorkflow(request: CreateWorkflowRequest): Promise<CreateWorkflowResponse> {
    return ZealClient.request(`${this.baseUrl}/api/zip/orchestrator/workflows`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }
  
  /**
   * List workflows
   */
  async listWorkflows(params?: {
    limit?: number
    offset?: number
  }): Promise<{
    workflows: any[]
    total: number
    limit: number
    offset: number
  }> {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.offset) searchParams.append('offset', params.offset.toString())
    
    return ZealClient.request(
      `${this.baseUrl}/api/zip/orchestrator/workflows?${searchParams}`
    )
  }
  
  /**
   * Get workflow state
   */
  async getWorkflowState(
    workflowId: string,
    graphId = 'main'
  ): Promise<{
    workflowId: string
    graphId: string
    name: string
    description: string
    version: number
    state: {
      nodes: any[]
      connections: any[]
      groups: any[]
    }
    metadata: any
  }> {
    return ZealClient.request(
      `${this.baseUrl}/api/zip/orchestrator/workflows/${workflowId}/state?graphId=${graphId}`
    )
  }
  
  /**
   * Add a node to a workflow
   */
  async addNode(request: AddNodeRequest): Promise<AddNodeResponse> {
    return ZealClient.request(`${this.baseUrl}/api/zip/orchestrator/nodes`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }
  
  /**
   * Update node properties
   */
  async updateNode(
    nodeId: string,
    updates: {
      workflowId: string
      graphId?: string
      properties?: Record<string, any>
      position?: { x: number; y: number }
    }
  ): Promise<{ success: boolean }> {
    return ZealClient.request(`${this.baseUrl}/api/zip/orchestrator/nodes/${nodeId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }
  
  /**
   * Delete a node
   */
  async deleteNode(
    nodeId: string,
    workflowId: string,
    graphId = 'main'
  ): Promise<{ success: boolean; message: string }> {
    return ZealClient.request(
      `${this.baseUrl}/api/zip/orchestrator/nodes/${nodeId}?workflowId=${workflowId}&graphId=${graphId}`,
      {
        method: 'DELETE',
      }
    )
  }
  
  /**
   * Connect two nodes
   */
  async connectNodes(request: ConnectNodesRequest): Promise<{
    connectionId: string
    connection: any
  }> {
    return ZealClient.request(`${this.baseUrl}/api/zip/orchestrator/connections`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }
  
  /**
   * Remove a connection between nodes
   */
  async removeConnection(request: {
    workflowId: string
    graphId?: string
    connectionId: string
  }): Promise<{
    success: boolean
    message: string
  }> {
    return ZealClient.request(`${this.baseUrl}/api/zip/orchestrator/connections`, {
      method: 'DELETE',
      body: JSON.stringify({
        ...request,
        graphId: request.graphId || 'main'
      }),
    })
  }
  
  /**
   * Create a node group
   */
  async createGroup(request: {
    workflowId: string
    graphId?: string
    title: string
    nodeIds: string[]
    color?: string
    description?: string
  }): Promise<{
    success: boolean
    groupId: string
    group: any
  }> {
    return ZealClient.request(`${this.baseUrl}/api/zip/orchestrator/groups`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }
  
  /**
   * Update group properties
   */
  async updateGroup(request: {
    workflowId: string
    graphId?: string
    groupId: string
    title?: string
    nodeIds?: string[]
    color?: string
    description?: string
  }): Promise<{
    success: boolean
    group: any
  }> {
    return ZealClient.request(`${this.baseUrl}/api/zip/orchestrator/groups`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...request,
        graphId: request.graphId || 'main'
      }),
    })
  }
  
  /**
   * Remove a group
   */
  async removeGroup(request: {
    workflowId: string
    graphId?: string
    groupId: string
  }): Promise<{
    success: boolean
    message: string
  }> {
    return ZealClient.request(`${this.baseUrl}/api/zip/orchestrator/groups`, {
      method: 'DELETE',
      body: JSON.stringify({
        ...request,
        graphId: request.graphId || 'main'
      }),
    })
  }
}