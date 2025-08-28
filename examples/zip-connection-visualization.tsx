/**
 * Example of integrating ZIP WebSocket events with ConnectionLines
 * Shows real-time visualization of workflow execution
 */

import React, { useCallback, useState } from 'react'
import { ConnectionLines } from '@/components/ConnectionLines'
import { useWorkflowStore } from '@/store/workflow-store'
import { usePortPositions } from '@/hooks/usePortPositions'
import { useZipConnectionState } from '@/hooks/useZipConnectionState'
import { ConnectionState } from '@/types/workflow'

/**
 * Example workflow viewer with real-time connection state updates
 */
export function WorkflowViewerWithZipEvents() {
  const connections = useWorkflowStore(state => state.connections)
  const { getPortPosition } = usePortPositions()
  const [lastStateChange, setLastStateChange] = useState<{
    connectionId: string
    state: ConnectionState
    timestamp: number
  } | null>(null)
  
  // Handle connection state changes
  const handleConnectionStateChange = useCallback((
    connectionId: string,
    state: ConnectionState
  ) => {
    console.log(`Connection ${connectionId} changed to ${state}`)
    setLastStateChange({
      connectionId,
      state,
      timestamp: Date.now(),
    })
  }, [])
  
  return (
    <div className="relative w-full h-full">
      {/* Main canvas with connections */}
      <ConnectionLinesZip
        connections={connections}
        getPortPosition={getPortPosition}
        enableZipEvents={true}
        websocketUrl="ws://localhost:3000/api/zip/events/ws"
        autoClear={true}
        successTimeout={3000}
        onConnectionStateChange={handleConnectionStateChange}
      />
      
      {/* Status panel showing last state change */}
      {lastStateChange && (
        <div className="absolute top-4 left-4 p-4 bg-zinc-900/90 rounded-lg shadow-lg border border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Last State Change</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Connection:</span>
              <span className="text-zinc-300 font-mono">{lastStateChange.connectionId}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">State:</span>
              <StateIndicator state={lastStateChange.state} />
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Time:</span>
              <span className="text-zinc-400">
                {new Date(lastStateChange.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * State indicator component
 */
function StateIndicator({ state }: { state: ConnectionState }) {
  const stateConfig = {
    pending: { color: 'text-gray-400', bg: 'bg-gray-400/10', label: 'Pending' },
    running: { color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Running' },
    success: { color: 'text-green-400', bg: 'bg-green-400/10', label: 'Success' },
    error: { color: 'text-red-400', bg: 'bg-red-400/10', label: 'Error' },
    warning: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Warning' },
  }
  
  const config = stateConfig[state] || stateConfig.pending
  
  return (
    <span className={`px-2 py-0.5 rounded-md ${config.bg} ${config.color} font-medium`}>
      {config.label}
    </span>
  )
}

/**
 * Example control panel for testing connection states
 */
export function ConnectionStateControlPanel() {
  const connections = useWorkflowStore(state => state.connections)
  const {
    simulateExecution,
    simulateError,
    simulateWarning,
    clearAll,
    setState,
  } = useConnectionStateControl()
  
  const [selectedConnection, setSelectedConnection] = useState<string>('')
  
  return (
    <div className="p-4 bg-zinc-900 rounded-lg shadow-lg border border-zinc-700">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">Connection State Control</h3>
      
      {/* Connection selector */}
      <div className="mb-4">
        <label className="block text-xs text-zinc-400 mb-1">Select Connection</label>
        <select
          className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300"
          value={selectedConnection}
          onChange={(e) => setSelectedConnection(e.target.value)}
        >
          <option value="">-- Select a connection --</option>
          {connections.map(conn => (
            <option key={conn.id} value={conn.id}>
              {conn.id} ({conn.source.nodeId} → {conn.target.nodeId})
            </option>
          ))}
        </select>
      </div>
      
      {/* Control buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => selectedConnection && simulateExecution(selectedConnection)}
          disabled={!selectedConnection}
        >
          Simulate Execute
        </button>
        
        <button
          className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => selectedConnection && setState(selectedConnection, 'success')}
          disabled={!selectedConnection}
        >
          Set Success
        </button>
        
        <button
          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => selectedConnection && simulateError(selectedConnection)}
          disabled={!selectedConnection}
        >
          Simulate Error
        </button>
        
        <button
          className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => selectedConnection && simulateWarning(selectedConnection)}
          disabled={!selectedConnection}
        >
          Set Warning
        </button>
        
        <button
          className="px-3 py-1.5 bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => selectedConnection && setState(selectedConnection, 'pending')}
          disabled={!selectedConnection}
        >
          Set Pending
        </button>
        
        <button
          className="px-3 py-1.5 bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-400 rounded text-xs font-medium transition-colors"
          onClick={clearAll}
        >
          Clear All
        </button>
      </div>
    </div>
  )
}

/**
 * Example integration in a workflow page
 */
export function WorkflowPageWithZipEvents() {
  const [showControlPanel, setShowControlPanel] = useState(false)
  
  return (
    <div className="relative w-full h-full bg-zinc-950">
      {/* Main workflow viewer */}
      <WorkflowViewerWithZipEvents />
      
      {/* Toggle control panel button */}
      <button
        className="fixed bottom-4 left-4 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 font-medium transition-colors"
        onClick={() => setShowControlPanel(!showControlPanel)}
      >
        {showControlPanel ? 'Hide' : 'Show'} Control Panel
      </button>
      
      {/* Control panel */}
      {showControlPanel && (
        <div className="fixed bottom-16 left-4 z-50">
          <ConnectionStateControlPanel />
        </div>
      )}
    </div>
  )
}

/**
 * Example of batch execution simulation
 */
export function SimulateWorkflowExecution() {
  const connections = useWorkflowStore(state => state.connections)
  const { setState, clearAll } = useConnectionStateControl()
  const [isRunning, setIsRunning] = useState(false)
  
  const simulateFullExecution = useCallback(async () => {
    setIsRunning(true)
    clearAll()
    
    // Simulate execution flow through connections
    for (const connection of connections) {
      // Set to running
      setState(connection.id, 'running')
      
      // Wait for simulated processing
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Random outcome
      const outcome = Math.random()
      if (outcome > 0.9) {
        setState(connection.id, 'error', { error: 'Random failure' })
      } else if (outcome > 0.8) {
        setState(connection.id, 'warning', { warning: 'High latency detected' })
      } else {
        setState(connection.id, 'success', {
          duration: Math.floor(Math.random() * 1000),
          dataSize: Math.floor(Math.random() * 10000),
        })
      }
      
      // Small delay between connections
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    setIsRunning(false)
  }, [connections, setState, clearAll])
  
  return (
    <div className="p-4 bg-zinc-900 rounded-lg shadow-lg border border-zinc-700">
      <h3 className="text-sm font-medium text-zinc-300 mb-4">Workflow Execution Simulator</h3>
      
      <button
        className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-all ${
          isRunning
            ? 'bg-orange-500/10 text-orange-400 cursor-not-allowed'
            : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400'
        }`}
        onClick={simulateFullExecution}
        disabled={isRunning}
      >
        {isRunning ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
            Executing...
          </span>
        ) : (
          'Simulate Full Execution'
        )}
      </button>
      
      <div className="mt-3 text-xs text-zinc-500">
        This will simulate execution through all {connections.length} connections
      </div>
    </div>
  )
}