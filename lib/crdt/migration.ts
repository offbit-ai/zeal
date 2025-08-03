/**
 * CRDT Migration Strategy
 * 
 * Provides utilities to migrate from the current workflow state
 * to CRDT-based state while maintaining backwards compatibility.
 */

import * as Y from 'yjs'
import type { 
  WorkflowState, 
  WorkflowGraph, 
  WorkflowNode, 
  WorkflowConnection,
  NodeGroup 
} from '@/types/workflow'
import type { WorkflowSnapshot } from '@/types/snapshot'
import { 
  nodeToCRDT, 
  connectionToCRDT,
  nodeFromCRDT,
  connectionFromCRDT 
} from './workflow-crdt'
import { CRDTPersistence } from './persistence'

/**
 * Migration phases for gradual adoption
 */
export enum MigrationPhase {
  LEGACY = 'legacy',           // Original state only
  DUAL_WRITE = 'dual-write',   // Write to both, read from legacy
  DUAL_READ = 'dual-read',     // Write to both, read from CRDT with fallback
  CRDT_ONLY = 'crdt-only'      // Full CRDT mode
}

/**
 * Migration configuration
 */
export interface MigrationConfig {
  phase: MigrationPhase
  enableAutoMigration: boolean
  preserveHistory: boolean
  batchSize: number
}

/**
 * Manages the migration process from legacy to CRDT
 */
export class CRDTMigration {
  private config: MigrationConfig
  private persistence: CRDTPersistence
  
  constructor(config: Partial<MigrationConfig> = {}) {
    this.config = {
      phase: MigrationPhase.LEGACY,
      enableAutoMigration: true,
      preserveHistory: true,
      batchSize: 100,
      ...config
    }
    
    this.persistence = new CRDTPersistence({
      dbName: 'zeal-crdt-migration'
    })
  }

  /**
   * Get current migration phase
   */
  async getCurrentPhase(): Promise<MigrationPhase> {
    const stored = localStorage.getItem('crdt-migration-phase')
    return (stored as MigrationPhase) || MigrationPhase.LEGACY
  }

  /**
   * Set migration phase
   */
  async setPhase(phase: MigrationPhase): Promise<void> {
    localStorage.setItem('crdt-migration-phase', phase)
    this.config.phase = phase
  }

  /**
   * Migrate a workflow snapshot to CRDT
   */
  async migrateSnapshot(
    snapshot: WorkflowSnapshot,
    progressCallback?: (progress: number) => void
  ): Promise<Y.Doc> {
    const doc = new Y.Doc({ guid: snapshot.id })
    
    // Set metadata
    const metadata = doc.getMap('metadata')
    metadata.set('id', snapshot.id)
    metadata.set('name', snapshot.name)
    metadata.set('version', snapshot.version)
    metadata.set('createdAt', snapshot.createdAt)
    metadata.set('updatedAt', snapshot.updatedAt)
    
    // Migrate graphs
    const graphsMap = doc.getMap('graphs')
    const graphs = snapshot.graphs || []
    
    for (let i = 0; i < graphs.length; i++) {
      await this.migrateGraph(doc, graphs[i], graphsMap)
      
      if (progressCallback) {
        progressCallback((i + 1) / graphs.length * 100)
      }
    }
    
    // Migrate settings
    const settings = doc.getMap('settings')
    if (snapshot.activeGraphId) {
      settings.set('activeGraphId', snapshot.activeGraphId)
    }
    
    return doc
  }

  /**
   * Migrate a single graph to CRDT
   */
  private async migrateGraph(
    doc: Y.Doc,
    graph: WorkflowGraph,
    graphsMap: Y.Map<any>
  ): Promise<void> {
    const graphMap = new Y.Map()
    
    // Set graph metadata
    graphMap.set('id', graph.id)
    graphMap.set('name', graph.name)
    graphMap.set('namespace', graph.namespace)
    graphMap.set('isMain', graph.isMain)
    
    // Migrate nodes
    const nodesMap = new Y.Map()
    const nodes = graph.workflowState?.nodes || []
    
    for (const node of nodes) {
      const crdtNode = this.migrateNode(node, doc)
      nodesMap.set(node.id, crdtNode)
    }
    graphMap.set('nodes', nodesMap)
    
    // Migrate connections
    const connectionsMap = new Y.Map()
    const connections = graph.workflowState?.connections || []
    
    for (const connection of connections) {
      const crdtConnection = connectionToCRDT(connection, doc)
      connectionsMap.set(connection.id, crdtConnection)
    }
    graphMap.set('connections', connectionsMap)
    
    // Migrate groups
    const groupsMap = new Y.Map()
    const groups = graph.workflowState?.groups || []
    
    for (const group of groups) {
      const crdtGroup = this.migrateGroup(group, doc)
      groupsMap.set(group.id, crdtGroup)
    }
    graphMap.set('groups', groupsMap)
    
    graphsMap.set(graph.id, graphMap)
  }

  /**
   * Migrate a node to CRDT format
   */
  private migrateNode(node: WorkflowNode, doc: Y.Doc): any {
    const crdtNode = nodeToCRDT(node, doc)
    
    // Add migration metadata
    crdtNode.metadata.set('migratedAt', Date.now())
    crdtNode.metadata.set('migrationVersion', '1.0')
    
    return crdtNode
  }

  /**
   * Migrate a node group to CRDT
   */
  private migrateGroup(group: NodeGroup, doc: Y.Doc): any {
    const nodeIds = new Y.Array()
    nodeIds.push(group.nodeIds)
    
    const style = new Y.Map()
    Object.entries(group.style || {}).forEach(([key, value]) => {
      style.set(key, value)
    })
    
    const position = new Y.Map()
    position.set('x', group.position.x)
    position.set('y', group.position.y)
    
    const size = new Y.Map()
    size.set('width', group.size.width)
    size.set('height', group.size.height)
    
    return {
      id: group.id,
      name: group.name,
      nodeIds,
      style,
      collapsed: group.collapsed,
      position,
      size
    }
  }

  /**
   * Create a compatibility layer for gradual migration
   */
  createCompatibilityLayer() {
    return {
      /**
       * Read with fallback based on migration phase
       */
      read: async (workflowId: string): Promise<any> => {
        const phase = await this.getCurrentPhase()
        
        switch (phase) {
          case MigrationPhase.LEGACY:
            return this.readLegacy(workflowId)
            
          case MigrationPhase.DUAL_WRITE:
            return this.readLegacy(workflowId)
            
          case MigrationPhase.DUAL_READ:
            try {
              return await this.readCRDT(workflowId)
            } catch (error) {
              console.warn('CRDT read failed, falling back to legacy:', error)
              return this.readLegacy(workflowId)
            }
            
          case MigrationPhase.CRDT_ONLY:
            return this.readCRDT(workflowId)
        }
      },

      /**
       * Write based on migration phase
       */
      write: async (workflowId: string, data: any): Promise<void> => {
        const phase = await this.getCurrentPhase()
        
        switch (phase) {
          case MigrationPhase.LEGACY:
            await this.writeLegacy(workflowId, data)
            break
            
          case MigrationPhase.DUAL_WRITE:
          case MigrationPhase.DUAL_READ:
            // Write to both systems
            await Promise.all([
              this.writeLegacy(workflowId, data),
              this.writeCRDT(workflowId, data)
            ])
            break
            
          case MigrationPhase.CRDT_ONLY:
            await this.writeCRDT(workflowId, data)
            break
        }
      }
    }
  }

  /**
   * Read from legacy storage
   */
  private async readLegacy(workflowId: string): Promise<any> {
    // Read from localStorage or SQLite
    const stored = localStorage.getItem(`workflow-${workflowId}`)
    return stored ? JSON.parse(stored) : null
  }

  /**
   * Write to legacy storage
   */
  private async writeLegacy(workflowId: string, data: any): Promise<void> {
    localStorage.setItem(`workflow-${workflowId}`, JSON.stringify(data))
  }

  /**
   * Read from CRDT storage
   */
  private async readCRDT(workflowId: string): Promise<any> {
    const doc = await this.persistence.loadDoc(workflowId)
    if (!doc) return null
    
    // Convert CRDT to regular format
    return this.convertCRDTToLegacy(doc)
  }

  /**
   * Write to CRDT storage
   */
  private async writeCRDT(workflowId: string, data: any): Promise<void> {
    let doc = await this.persistence.loadDoc(workflowId)
    
    if (!doc) {
      doc = new Y.Doc({ guid: workflowId })
    }
    
    // Update CRDT document
    doc.transact(() => {
      // Update implementation based on data structure
      const metadata = doc.getMap('metadata')
      metadata.set('lastModified', Date.now())
    })
    
    await this.persistence.initializeDoc(workflowId, doc)
  }

  /**
   * Convert CRDT document back to legacy format
   */
  private convertCRDTToLegacy(doc: Y.Doc): any {
    const metadata = doc.getMap('metadata')
    const graphsMap = doc.getMap('graphs')
    
    const graphs: WorkflowGraph[] = []
    graphsMap.forEach((graphMap: Y.Map<any>, graphId: string) => {
      const nodes: WorkflowNode[] = []
      const connections: WorkflowConnection[] = []
      const groups: NodeGroup[] = []
      
      // Convert nodes
      const nodesMap = graphMap.get('nodes') as Y.Map<any>
      if (nodesMap) {
        nodesMap.forEach((crdtNode: any) => {
          nodes.push(nodeFromCRDT(crdtNode))
        })
      }
      
      // Convert connections
      const connectionsMap = graphMap.get('connections') as Y.Map<any>
      if (connectionsMap) {
        connectionsMap.forEach((crdtConn: any) => {
          connections.push(connectionFromCRDT(crdtConn))
        })
      }
      
      graphs.push({
        id: graphId,
        name: graphMap.get('name'),
        namespace: graphMap.get('namespace'),
        isMain: graphMap.get('isMain'),
        isDirty: false,
        workflowState: {
          nodes,
          connections,
          groups
        }
      })
    })
    
    return {
      id: metadata.get('id'),
      name: metadata.get('name'),
      version: metadata.get('version'),
      graphs
    }
  }

  /**
   * Run full migration for all workflows
   */
  async runFullMigration(
    workflowIds: string[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    for (let i = 0; i < workflowIds.length; i++) {
      const workflowId = workflowIds[i]
      
      // Load legacy data
      const legacyData = await this.readLegacy(workflowId)
      if (!legacyData) continue
      
      // Migrate to CRDT
      const doc = await this.migrateSnapshot(legacyData)
      
      // Save CRDT version
      await this.persistence.initializeDoc(workflowId, doc)
      
      if (onProgress) {
        onProgress(i + 1, workflowIds.length)
      }
    }
    
    // Update phase to CRDT_ONLY after successful migration
    await this.setPhase(MigrationPhase.CRDT_ONLY)
  }

  /**
   * Validate migration integrity
   */
  async validateMigration(workflowId: string): Promise<{
    isValid: boolean
    errors: string[]
  }> {
    const errors: string[] = []
    
    try {
      const legacy = await this.readLegacy(workflowId)
      const crdt = await this.readCRDT(workflowId)
      
      if (!legacy || !crdt) {
        errors.push('Missing data in one or both storage systems')
        return { isValid: false, errors }
      }
      
      // Compare key fields
      if (legacy.id !== crdt.id) {
        errors.push('ID mismatch')
      }
      
      if (legacy.graphs?.length !== crdt.graphs?.length) {
        errors.push('Graph count mismatch')
      }
      
      // Add more validation as needed
      
    } catch (error) {
      errors.push(`Validation error: ${error}`)
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
}