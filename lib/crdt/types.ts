/**
 * CRDT Type Definitions for Workflow Collaboration
 *
 * These types define the structure of our Conflict-Free Replicated Data Types
 * using Y.js for real-time collaboration and offline-first functionality.
 */

import * as Y from 'yjs'
import type {
  WorkflowNodeData,
  Connection as WorkflowConnection,
  NodeGroup,
} from '@/types/workflow'
import type { WorkflowGraph, WorkflowSnapshot } from '@/types/snapshot'

/**
 * Root document structure containing all workflow data
 */
export interface CRDTWorkflowDoc extends Y.Doc {
  getMap(name: 'metadata'): Y.Map<any>
  getMap(name: 'graphs'): Y.Map<Y.Map<any>>
  getArray(name: 'snapshots'): Y.Array<any>
  getMap(name: 'settings'): Y.Map<any>
  getMap(name: 'presence'): Y.Map<any>
}

/**
 * Workflow metadata stored in CRDT
 */
export interface CRDTWorkflowMetadata {
  id: string
  name: string
  description?: string
  version: number
  createdAt: number
  updatedAt: number
  createdBy?: string
  lastModifiedBy?: string
}

/**
 * Graph structure in CRDT format
 */
export interface CRDTGraph {
  id: string
  name: string
  namespace: string
  isMain: boolean
  nodes: Y.Map<CRDTNode>
  connections: Y.Map<CRDTConnection>
  groups: Y.Map<CRDTNodeGroup>
  metadata: Y.Map<any>
}

/**
 * Node structure optimized for CRDT operations
 */
export interface CRDTNode {
  id: string
  position: Y.Map<{ x: number; y: number }>
  metadata: Y.Map<any>
  properties: Y.Map<any>
  // Track who is currently editing this node
  lockedBy?: string
  lockedAt?: number
}

/**
 * Connection structure for CRDT
 */
export interface CRDTConnection {
  id: string
  source: Y.Map<{ nodeId: string; portId: string }>
  target: Y.Map<{ nodeId: string; portId: string }>
  metadata: Y.Map<any>
}

/**
 * Node group structure for CRDT
 */
export interface CRDTNodeGroup {
  id: string
  name: string
  nodeIds: Y.Array<string>
  style: Y.Map<any>
  collapsed: boolean
  position: Y.Map<{ x: number; y: number }>
  size: Y.Map<{ width: number; height: number }>
}

/**
 * User presence information for real-time collaboration
 */
export interface CRDTPresence {
  userId: string
  userName: string
  userColor: string
  cursor?: {
    x: number
    y: number
    graphId: string
  }
  selection?: {
    nodeIds: string[]
    connectionIds: string[]
    graphId: string
  }
  activeGraphId?: string
  isActive: boolean
  lastSeen: number
}

/**
 * Sync state for tracking synchronization status
 */
export interface CRDTSyncState {
  isSyncing: boolean
  lastSyncedAt?: number
  pendingChanges: number
  syncError?: string
  peers: string[]
}

/**
 * Operation types for CRDT updates
 */
export enum CRDTOperationType {
  // Node operations
  NODE_ADD = 'node:add',
  NODE_UPDATE = 'node:update',
  NODE_DELETE = 'node:delete',
  NODE_MOVE = 'node:move',

  // Connection operations
  CONNECTION_ADD = 'connection:add',
  CONNECTION_DELETE = 'connection:delete',

  // Group operations
  GROUP_CREATE = 'group:create',
  GROUP_UPDATE = 'group:update',
  GROUP_DELETE = 'group:delete',

  // Graph operations
  GRAPH_CREATE = 'graph:create',
  GRAPH_UPDATE = 'graph:update',
  GRAPH_DELETE = 'graph:delete',

  // Workflow operations
  WORKFLOW_UPDATE = 'workflow:update',
  SNAPSHOT_CREATE = 'snapshot:create',
}

/**
 * CRDT operation for undo/redo and history tracking
 */
export interface CRDTOperation {
  id: string
  type: CRDTOperationType
  userId: string
  timestamp: number
  graphId?: string
  data: any
  // For undo/redo
  inverse?: CRDTOperation
}

/**
 * Configuration for CRDT providers
 */
export interface CRDTProviderConfig {
  // Persistence
  enableIndexedDB: boolean
  indexedDBName?: string

  // Network sync
  enableWebSocket: boolean
  webSocketUrl?: string

  // WebRTC for P2P
  enableWebRTC: boolean
  webRTCSignalingServer?: string

  // Performance
  gcEnabled: boolean
  gcInterval?: number

  // Security
  encryption?: {
    enabled: boolean
    publicKey?: string
    privateKey?: string
  }
}

/**
 * Helper type for converting regular types to CRDT types
 */
export type ToCRDT<T> = T extends object
  ? T extends Array<infer U>
    ? Y.Array<ToCRDT<U>>
    : Y.Map<{
        [K in keyof T]: ToCRDT<T[K]>
      }>
  : T

/**
 * Type guards for CRDT types
 */
export const isCRDTMap = (value: any): value is Y.Map<any> => {
  return value instanceof Y.Map
}

export const isCRDTArray = (value: any): value is Y.Array<any> => {
  return value instanceof Y.Array
}

export const isCRDTText = (value: any): value is Y.Text => {
  return value instanceof Y.Text
}
