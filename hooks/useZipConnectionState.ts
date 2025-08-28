/**
 * Hook for subscribing to ZIP WebSocket events and updating connection states
 * This allows real-time visualization of workflow execution in the UI
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { ConnectionState } from '@/types/workflow'
import { useWorkflowStore } from '@/store/workflow-store'
import { 
  ZipWebSocketEvent, 
  isExecutionEvent,
  NodeExecutingEvent,
  NodeCompletedEvent,
  NodeFailedEvent,
  NodeWarningEvent,
  ExecutionStartedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent
} from '@/types/zip-events'

export interface ConnectionExecutionEvent {
  connectionId: string
  state: ConnectionState
  workflowId: string
  graphId?: string
  nodeId?: string
  portId?: string
  timestamp: number
  metadata?: {
    duration?: number
    dataSize?: number
    error?: any
  }
}

export interface ConnectionStateMap {
  [connectionId: string]: {
    state: ConnectionState
    lastUpdate: number
    metadata?: any
  }
}

interface UseZipConnectionStateOptions {
  /**
   * Whether to automatically connect
   */
  autoConnect?: boolean
  
  /**
   * Callback when connection state changes
   */
  onStateChange?: (connectionId: string, state: ConnectionState) => void
  
  /**
   * Whether to clear states on execution completion
   */
  autoClear?: boolean
  
  /**
   * Timeout for clearing success states (ms)
   */
  successTimeout?: number
}

/**
 * Hook to subscribe to ZIP WebSocket events and track connection states
 */
export function useZipConnectionState(options: UseZipConnectionStateOptions = {}) {
  const {
    autoConnect = true,
    onStateChange,
    autoClear = true,
    successTimeout = 3000,
  } = options
  
  // Get current workflow and graph from store - these are the defaults
  const workflowId = useWorkflowStore(state => state.workflowId)
  const currentGraphId = useWorkflowStore(state => state.currentGraphId)
  
  // Construct WebSocket URL relative to current host
  const websocketUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/zip/events/ws`
    : 'ws://localhost:3000/api/zip/events/ws' // Fallback for SSR
  
  const [connectionStates, setConnectionStates] = useState<ConnectionStateMap>({})
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  
  /**
   * Clear a connection state after timeout
   */
  const scheduleClear = useCallback((connectionId: string, timeout: number) => {
    // Clear any existing timeout
    const existingTimeout = clearTimeoutsRef.current.get(connectionId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }
    
    // Schedule new timeout
    const timeoutId = setTimeout(() => {
      setConnectionStates(prev => {
        const newStates = { ...prev }
        delete newStates[connectionId]
        return newStates
      })
      clearTimeoutsRef.current.delete(connectionId)
    }, timeout)
    
    clearTimeoutsRef.current.set(connectionId, timeoutId)
  }, [])
  
  /**
   * Update connection state
   */
  const updateConnectionState = useCallback((
    connectionId: string,
    state: ConnectionState,
    metadata?: any
  ) => {
    setConnectionStates(prev => ({
      ...prev,
      [connectionId]: {
        state,
        lastUpdate: Date.now(),
        metadata,
      }
    }))
    
    // Notify listener
    onStateChange?.(connectionId, state)
    
    // Schedule auto-clear for success states
    if (autoClear && state === 'success' && successTimeout > 0) {
      scheduleClear(connectionId, successTimeout)
    }
  }, [onStateChange, autoClear, successTimeout, scheduleClear])
  
  /**
   * Handle WebSocket messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      
      // Handle visual state update events
      if (data.type === 'visual.state.update') {
        const visualUpdate = data as {
          type: 'visual.state.update'
          elements: Array<{
            id: string
            elementType: 'node' | 'connection'
            state: 'idle' | 'pending' | 'running' | 'success' | 'error' | 'warning'
            progress?: number
            message?: string
            highlight?: boolean
            color?: string
          }>
        }
        
        // Process connection state updates from visual state events
        visualUpdate.elements.forEach(element => {
          if (element.elementType === 'connection') {
            // Map visual states to ConnectionState
            let connectionState: ConnectionState = 'pending'
            switch (element.state) {
              case 'running':
              case 'pending':
                connectionState = 'running'
                break
              case 'success':
                connectionState = 'success'
                break
              case 'error':
                connectionState = 'error'
                break
              case 'warning':
                connectionState = 'warning'
                break
              default:
                connectionState = 'pending'
            }
            
            updateConnectionState(element.id, connectionState, {
              progress: element.progress,
              message: element.message,
              highlight: element.highlight,
              color: element.color,
            })
          }
        })
        return
      }
      
      // Handle execution events
      const execData = data as ZipWebSocketEvent
      
      // Only process execution events
      if (!isExecutionEvent(execData)) return
      
      // Filter by workflow and graph from store
      if (workflowId && execData.workflowId !== workflowId) return
      if (currentGraphId && execData.graphId && execData.graphId !== currentGraphId) return
      
      // Handle different event types with proper typing
      switch (execData.type) {
        case 'node.executing': {
          const nodeEvent = execData as NodeExecutingEvent
          // When a node starts executing, its input connections show data flowing in
          nodeEvent.inputConnections.forEach((connId) => {
            updateConnectionState(connId, 'running')
          })
          break
        }
          
        case 'node.completed': {
          const nodeEvent = execData as NodeCompletedEvent
          // Output connections turn green (successful data output from source ports)
          nodeEvent.outputConnections.forEach((connId) => {
            updateConnectionState(connId, 'success', {
              duration: nodeEvent.duration,
              outputSize: nodeEvent.outputSize,
            })
          })
          break
        }
          
        case 'node.failed': {
          const nodeEvent = execData as NodeFailedEvent
          // All output connections show error (no data could be produced)
          nodeEvent.outputConnections.forEach((connId) => {
            updateConnectionState(connId, 'error', {
              error: nodeEvent.error,
            })
          })
          break
        }
          
        case 'node.warning': {
          const nodeEvent = execData as NodeWarningEvent
          // Output connections show warning state
          nodeEvent.outputConnections.forEach((connId) => {
            updateConnectionState(connId, 'warning', {
              warning: nodeEvent.warning,
            })
          })
          break
        }
          
        case 'execution.started': {
          const execEvent = execData as ExecutionStartedEvent
          // Clear all states when new execution starts
          if (autoClear) {
            setConnectionStates({})
            clearTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
            clearTimeoutsRef.current.clear()
          }
          console.log(`Execution started: ${execEvent.sessionId}`)
          break
        }
          
        case 'execution.completed': {
          const execEvent = execData as ExecutionCompletedEvent
          // Optionally clear all states after execution completes
          if (autoClear) {
            setTimeout(() => {
              setConnectionStates({})
              clearTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
              clearTimeoutsRef.current.clear()
            }, 5000)
          }
          console.log(`Execution completed: ${execEvent.sessionId}, duration: ${execEvent.duration}ms`)
          break
        }
          
        case 'execution.failed': {
          const execEvent = execData as ExecutionFailedEvent
          // Optionally clear all states after execution fails
          if (autoClear) {
            setTimeout(() => {
              setConnectionStates({})
              clearTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
              clearTimeoutsRef.current.clear()
            }, 10000)
          }
          console.error(`Execution failed: ${execEvent.sessionId}`, execEvent.error)
          break
        }
      }
    } catch (error) {
      console.error('Error handling ZIP WebSocket message:', error)
    }
  }, [workflowId, currentGraphId, updateConnectionState, autoClear])
  
  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return // Already connected
    }
    
    try {
      const ws = new WebSocket(websocketUrl)
      
      ws.onopen = () => {
        console.log('Connected to ZIP WebSocket')
        setIsConnected(true)
        setIsReconnecting(false)
        
        // Send authentication/subscription message if needed
        if (workflowId) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            workflowId: workflowId,
            graphId: currentGraphId,
          }))
        }
      }
      
      ws.onmessage = handleMessage
      
      ws.onerror = (error) => {
        console.error('ZIP WebSocket error:', error)
      }
      
      ws.onclose = () => {
        console.log('Disconnected from ZIP WebSocket')
        setIsConnected(false)
        wsRef.current = null
        
        // Attempt to reconnect after delay
        if (!reconnectTimeoutRef.current) {
          setIsReconnecting(true)
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null
            connect()
          }, 3000)
        }
      }
      
      wsRef.current = ws
    } catch (error) {
      console.error('Failed to connect to ZIP WebSocket:', error)
      setIsConnected(false)
      
      // Retry connection
      if (!reconnectTimeoutRef.current) {
        setIsReconnecting(true)
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null
          connect()
        }, 3000)
      }
    }
  }, [websocketUrl, workflowId, currentGraphId, handleMessage])
  
  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    setIsConnected(false)
    setIsReconnecting(false)
  }, [])
  
  /**
   * Send a custom event
   */
  const sendEvent = useCallback((eventData: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(eventData))
    } else {
      console.warn('WebSocket not connected')
    }
  }, [])
  
  /**
   * Clear all connection states
   */
  const clearStates = useCallback(() => {
    setConnectionStates({})
    clearTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
    clearTimeoutsRef.current.clear()
  }, [])
  
  /**
   * Manually set connection state
   */
  const setConnectionState = useCallback((
    connectionId: string,
    state: ConnectionState,
    metadata?: any
  ) => {
    updateConnectionState(connectionId, state, metadata)
  }, [updateConnectionState])
  
  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect()
    }
    
    return () => {
      disconnect()
      clearTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      clearTimeoutsRef.current.clear()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Reconnect when workflow or graph changes
  useEffect(() => {
    if (isConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      // Update subscription
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        workflowId: workflowId,
        graphId: currentGraphId,
      }))
    }
  }, [workflowId, currentGraphId, isConnected])
  
  return {
    connectionStates,
    isConnected,
    isReconnecting,
    connect,
    disconnect,
    sendEvent,
    clearStates,
    setConnectionState,
  }
}