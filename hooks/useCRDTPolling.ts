import { useEffect, useRef } from 'react'
import { useWorkflowStore } from '../store/workflow-store'

interface CRDTUpdate {
  type:
    | 'node-added'
    | 'node-updated'
    | 'node-removed'
    | 'connection-added'
    | 'connection-removed'
    | 'group-created'
  workflowId: string
  graphId: string
  data: any
  timestamp: number
}

/**
 * Hook that polls for CRDT updates from the server and applies them to the workflow store
 * This enables real-time synchronization in embed mode
 */
export function useCRDTPolling(
  workflowId: string | null,
  enabled: boolean = true,
  pollingInterval: number = 2000 // Default 2 seconds
) {
  const lastTimestampRef = useRef<number>(Date.now())
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPollingRef = useRef<boolean>(false)
  const noActivityCountRef = useRef<number>(0)
  const currentIntervalRef = useRef<number>(pollingInterval)

  useEffect(() => {
    if (!workflowId || !enabled) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      return
    }

    const pollForUpdates = async () => {
      // Prevent overlapping polls
      if (isPollingRef.current) {
        return
      }

      isPollingRef.current = true

      try {
        console.log(
          `[CRDTPolling] Polling for updates: workflowId=${workflowId}, since=${lastTimestampRef.current}`
        )
        const response = await fetch(
          `/api/orchestrator/crdt-updates?workflowId=${workflowId}&since=${lastTimestampRef.current}`
        )

        if (!response.ok) {
          console.error('Failed to fetch CRDT updates:', response.statusText)
          return
        }

        const data = await response.json()
        const { updates, timestamp } = data

        if (updates && updates.length > 0) {
          console.log(`[CRDTPolling] Received ${updates.length} updates for workflow ${workflowId}`)

          // Apply updates to the workflow store
          const store = useWorkflowStore.getState()

          for (const update of updates) {
            console.log(
              `[CRDTPolling] Applying update: ${update.type} for ${update.data.id || update.data.nodeId}`
            )
            await applyUpdate(store, update)
          }

          // Update last timestamp
          lastTimestampRef.current = timestamp

          // Reset no activity count and restore normal polling interval
          noActivityCountRef.current = 0
          if (currentIntervalRef.current !== pollingInterval) {
            currentIntervalRef.current = pollingInterval
            // Restart with normal interval
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = setInterval(pollForUpdates, pollingInterval)
            }
          }
        } else {
          // No updates, increment no activity count
          noActivityCountRef.current++

          // After 10 polls with no activity (20 seconds), slow down to 5 seconds
          if (noActivityCountRef.current > 10 && currentIntervalRef.current < 5000) {
            currentIntervalRef.current = 5000
            console.log('[CRDTPolling] No activity detected, slowing down polling to 5s')
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = setInterval(pollForUpdates, 5000)
            }
          }

          // After 30 polls with no activity (60 seconds at normal rate), slow down to 10 seconds
          if (noActivityCountRef.current > 30 && currentIntervalRef.current < 10000) {
            currentIntervalRef.current = 10000
            console.log('[CRDTPolling] Extended inactivity, slowing down polling to 10s')
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = setInterval(pollForUpdates, 10000)
            }
          }
        }
      } catch (error) {
        console.error('Error polling for CRDT updates:', error)
      } finally {
        isPollingRef.current = false
      }
    }

    // Listen for force sync events
    const handleForceSync = (event: CustomEvent) => {
      if (event.detail?.workflowId === workflowId) {
        console.log('[CRDTPolling] Force sync requested for workflow:', workflowId)
        pollForUpdates()
      }
    }
    window.addEventListener('force-crdt-sync', handleForceSync as EventListener)

    // Start polling immediately
    pollForUpdates()

    // Set up polling interval with configurable delay
    // Default 2000ms is a good balance between responsiveness and server load
    pollingIntervalRef.current = setInterval(pollForUpdates, pollingInterval)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      window.removeEventListener('force-crdt-sync', handleForceSync as EventListener)
    }
  }, [workflowId, enabled, pollingInterval])
}

async function applyUpdate(store: any, update: CRDTUpdate) {
  console.log(`[CRDTPolling] Applying update:`, update)

  // Switch to the correct graph if needed
  if (store.currentGraphId !== update.graphId) {
    store.switchGraph(update.graphId)
  }

  switch (update.type) {
    case 'node-added':
      // Check if node already exists to avoid duplicates
      const existingNode = store.nodes.find((n: any) => (n.id || n.metadata.id) === update.data.id)

      if (!existingNode) {
        console.log('[CRDTPolling] Adding node with data:', JSON.stringify(update.data, null, 2))

        // The update.data contains the full node structure
        // We need to preserve ALL metadata properties from the template
        const nodeMetadata = {
          ...update.data.metadata,
          // Ensure ports are properly structured - combining inputs and outputs into single array
          ports: [
            ...(update.data.metadata.inputs?.map((input: any) => ({
              ...input,
              type: 'input' as const,
              position: input.position || 'left',
            })) || []),
            ...(update.data.metadata.outputs?.map((output: any) => ({
              ...output,
              type: 'output' as const,
              position: output.position || 'right',
            })) || []),
          ],
        }

        // Remove the temporary inputs/outputs arrays since we've combined them into ports
        delete nodeMetadata.inputs
        delete nodeMetadata.outputs

        // Add the node using the store's method
        const nodeId = store.addNode(nodeMetadata, update.data.position)

        // Update property values if provided
        if (update.data.propertyValues) {
          Object.entries(update.data.propertyValues).forEach(([key, value]) => {
            store.updateNodeProperty(nodeId, key, value)
          })
        }
      }
      break

    case 'node-updated':
      // Handle node updates (property changes, position changes, etc.)
      const nodeToUpdate = store.nodes.find((n: any) => (n.id || n.metadata.id) === update.data.nodeId)
      
      if (nodeToUpdate) {
        const nodeId = nodeToUpdate.id || nodeToUpdate.metadata.id
        console.log(`[CRDTPolling] Updating node ${nodeId}:`, JSON.stringify(update.data, null, 2))
        
        // Update property values if provided
        if (update.data.propertyValues) {
          // First update individual properties
          Object.entries(update.data.propertyValues).forEach(([key, value]) => {
            console.log(`[CRDTPolling] Updating property ${key} = ${JSON.stringify(value)}`)
            store.updateNodeProperty(nodeId, key, value)
          })
          
          // Force a re-render by triggering lastUpdate
          store.setGraphDirty(store.currentGraphId, true)
        }
        
        // Update position if provided
        if (update.data.position) {
          store.updateNodePosition(nodeId, update.data.position)
        }
      } else {
        console.warn(`[CRDTPolling] Node not found for update: ${update.data.nodeId}`)
      }
      break

    case 'connection-added':
      // Check if connection already exists
      const existingConnection = store.connections.find((c: any) => c.id === update.data.id)

      if (!existingConnection) {
        console.log('[CRDTPolling] Adding connection:', JSON.stringify(update.data, null, 2))

        // Ensure the connection data has the correct structure
        const connectionData = {
          id: update.data.id,
          source: update.data.source,
          target: update.data.target,
          state: update.data.state || 'pending',
          metadata: update.data.metadata || {},
        }

        store.addConnection(connectionData)
      }
      break

    case 'group-created':
      // Check if group already exists
      const existingGroup = store.groups.find((g: any) => g.id === update.data.id)

      if (!existingGroup) {
        store.createGroup(update.data.title, update.data.nodeIds, update.data.color)
      }
      break

    case 'node-removed':
      store.removeNode(update.data.nodeId)
      break

    case 'connection-removed':
      store.removeConnection(update.data.connectionId)
      break
  }
}
