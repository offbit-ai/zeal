'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  ListRestart, ArrowLeft, Play, Pause, SkipForward, RotateCcw, 
  ChevronRight, AlertCircle, CheckCircle, AlertTriangle,
  Database, Code, Bot, GitBranch, Shuffle, ArrowRight,
  Clock, Activity, Zap, Search, Filter, Calendar, FileText
} from 'lucide-react'
import { FlowTraceService } from '@/services/flowTraceService'
import type { FlowTrace, FlowTraceSession, TraceReplay } from '@/types/flowTrace'
import { formatDistanceToNow } from '@/utils/dateUtils'
import { useWorkflowStore } from '@/store/workflowStore'

interface FlowTracerProps {
  isOpen: boolean
  onClose: () => void
}

const iconMap: Record<string, any> = {
  database: Database,
  code: Code,
  service: Bot,
  condition: GitBranch,
  transformer: Shuffle
}

export function FlowTracer({ isOpen, onClose }: FlowTracerProps) {
  const [sessions, setSessions] = useState<FlowTraceSession[]>([])
  const [selectedSession, setSelectedSession] = useState<FlowTraceSession | null>(null)
  const [selectedTrace, setSelectedTrace] = useState<FlowTrace | null>(null)
  const [subgraphTraces, setSubgraphTraces] = useState<FlowTrace[]>([])
  const [showSubgraphTraces, setShowSubgraphTraces] = useState(false)
  const [replay, setReplay] = useState<TraceReplay | null>(null)
  const [currentReplayTrace, setCurrentReplayTrace] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [timeFilter, setTimeFilter] = useState<'all' | '1h' | '6h' | '24h' | '7d'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error' | 'warning'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const animationFrameRef = useRef<number>()
  const replayStartTimeRef = useRef<number>(0)
  
  const { nodes, connections } = useWorkflowStore()

  useEffect(() => {
    if (isOpen) {
      loadSessions()
    }
  }, [isOpen])

  // Reload sessions when filters change
  useEffect(() => {
    if (isOpen) {
      loadSessions()
    }
  }, [timeFilter, statusFilter, searchQuery])

  const loadSessions = async () => {
    try {
      const { sessions: allSessions } = await FlowTraceService.getAllSessions({
        timeFilter: timeFilter !== 'all' ? timeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined
      })
      setSessions(allSessions)
    } catch (error) {
      console.error('Error loading sessions:', error)
    }
  }

  // Filter sessions by time
  const filterSessionsByTime = (sessions: FlowTraceSession[]) => {
    if (timeFilter === 'all') return sessions
    
    const now = Date.now()
    const filterMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    }[timeFilter]
    
    return sessions.filter(session => 
      new Date(session.startTime).getTime() > now - filterMs
    )
  }

  // Filter traces by search query and status
  const filterTraces = (traces: FlowTrace[]) => {
    let filtered = traces
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(trace => trace.status === statusFilter)
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(trace => 
        trace.source.nodeName.toLowerCase().includes(query) ||
        trace.target.nodeName.toLowerCase().includes(query) ||
        trace.source.portName.toLowerCase().includes(query) ||
        trace.target.portName.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }

  const filteredSessions = filterSessionsByTime(sessions)

  const handleGenerateSimulation = async () => {
    try {
      const session = await FlowTraceService.generateSimulatedTraces(nodes, connections)
      await loadSessions()
      setSelectedSession(session)
    } catch (error) {
      console.error('Error generating simulation:', error)
    }
  }

  const generateReport = async () => {
    if (!selectedSession) return

    try {
      // Get text report from API
      const textReport = await FlowTraceService.generateReport(selectedSession.id, {
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        format: 'text'
      })

      // Download text report
      const blob = new Blob([textReport], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `flow-trace-report-${selectedSession.workflowName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Also get JSON report
      const jsonReport = await FlowTraceService.generateReport(selectedSession.id, {
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        format: 'json'
      })

      // Download JSON report
      const jsonBlob = new Blob([JSON.stringify(jsonReport, null, 2)], { type: 'application/json' })
      const jsonUrl = URL.createObjectURL(jsonBlob)
      const jsonA = document.createElement('a')
      jsonA.href = jsonUrl
      jsonA.download = `flow-trace-report-${selectedSession.workflowName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(jsonA)
      jsonA.click()
      document.body.removeChild(jsonA)
      URL.revokeObjectURL(jsonUrl)
    } catch (error) {
      console.error('Error generating report:', error)
    }
  }

  const startReplay = async () => {
    if (!selectedSession) return
    
    try {
      // Get replay data from API with current filters
      const replayData = await FlowTraceService.getReplayData(selectedSession.id, {
        search: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      })
      
      // Update selected session with filtered traces
      setSelectedSession({
        ...selectedSession,
        traces: replayData.traces
      })
      
      setReplay({
        sessionId: selectedSession.id,
        currentTraceIndex: 0,
        isPlaying: true,
        playbackSpeed: 1,
        startTime: Date.now(),
        elapsedTime: 0
      })
      
      replayStartTimeRef.current = Date.now()
      setCurrentReplayTrace(0)
      animateReplay()
    } catch (error) {
      console.error('Error starting replay:', error)
    }
  }

  const animateReplay = () => {
    if (!replay || !selectedSession) return
    
    const elapsed = Date.now() - replayStartTimeRef.current
    const traces = selectedSession.traces
    
    // Find which trace should be shown based on elapsed time
    let currentIndex = 0
    let accumulatedTime = 0
    
    for (let i = 0; i < traces.length; i++) {
      const traceTime = new Date(traces[i].timestamp).getTime() - new Date(traces[0].timestamp).getTime()
      if (elapsed >= traceTime * replay.playbackSpeed) {
        currentIndex = i
      }
    }
    
    setCurrentReplayTrace(currentIndex)
    
    // Continue animation if not at the end
    if (currentIndex < traces.length - 1 && replay.isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animateReplay)
    } else {
      // Replay finished
      setReplay(prev => prev ? { ...prev, isPlaying: false } : null)
    }
  }

  const pauseReplay = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    setReplay(prev => prev ? { ...prev, isPlaying: false } : null)
  }

  const resetReplay = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    setReplay(null)
    setCurrentReplayTrace(0)
  }

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const getStatusIcon = (status: FlowTrace['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
    }
  }

  const getStatusColor = (status: FlowTrace['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50'
      case 'error':
        return 'text-red-600 bg-red-50'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 top-[60px] z-50 flex bg-black/50" onClick={onClose}>
      <div 
        className="absolute top-0 left-0 right-0 bottom-0 bg-white shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ListRestart className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-medium text-gray-900">Flow Trace Debugger</h2>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Workflow
            </button>
          </div>
          
          {/* Query and Filters */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search traces by node or port name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              
              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  showFilters ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {(timeFilter !== 'all' || statusFilter !== 'all') && (
                  <span className="ml-1 px-1.5 py-0.5 bg-black text-white text-xs rounded-full">
                    {[timeFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length}
                  </span>
                )}
              </button>
              
              {/* Generate Simulation */}
              <button
                onClick={handleGenerateSimulation}
                className="px-3 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
              >
                Generate Simulation
              </button>
              
              {/* Generate Report */}
              {selectedSession && (
                <button
                  onClick={generateReport}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Generate Report
                </button>
              )}
            </div>
            
            {/* Filter Options */}
            {showFilters && (
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-md">
                {/* Time Filter */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <select
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value as any)}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="all">All time</option>
                    <option value="1h">Last hour</option>
                    <option value="6h">Last 6 hours</option>
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                  </select>
                </div>
                
                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-500" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="all">All statuses</option>
                    <option value="success">Success only</option>
                    <option value="error">Errors only</option>
                    <option value="warning">Warnings only</option>
                  </select>
                </div>
                
                {/* Clear Filters */}
                {(timeFilter !== 'all' || statusFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setTimeFilter('all')
                      setStatusFilter('all')
                    }}
                    className="ml-auto text-sm text-gray-600 hover:text-gray-900"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Replay Controls */}
          {selectedSession && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={replay?.isPlaying ? pauseReplay : startReplay}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title={replay?.isPlaying ? 'Pause' : 'Play'}
              >
                {replay?.isPlaying ? (
                  <Pause className="w-4 h-4 text-gray-600" />
                ) : (
                  <Play className="w-4 h-4 text-gray-600" />
                )}
              </button>
              <button
                onClick={resetReplay}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-sm text-gray-500 ml-2">Replay Controls</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sessions List */}
          <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Trace Sessions</h3>
              
              {filteredSessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No trace sessions yet</p>
                  <p className="text-xs mt-1">Generate a simulation to start</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      className={`p-3 rounded-md border cursor-pointer transition-colors ${
                        selectedSession?.id === session.id 
                          ? 'border-black bg-gray-50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedSession(session)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {session.workflowName}
                          </h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatDistanceToNow(new Date(session.startTime))}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          session.status === 'completed' 
                            ? 'bg-green-100 text-green-700'
                            : session.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {session.status}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                        <span>{session.summary.totalTraces} traces</span>
                        <span className="text-green-600">{session.summary.successCount} ✓</span>
                        {session.summary.errorCount > 0 && (
                          <span className="text-red-600">{session.summary.errorCount} ✗</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Traces List */}
          <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
            {selectedSession ? (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Flow Traces
                  {replay && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Replaying {currentReplayTrace + 1}/{selectedSession.traces.length})
                    </span>
                  )}
                </h3>
                
                {filterTraces(selectedSession.traces).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No traces match your filters</p>
                    <p className="text-xs mt-1">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filterTraces(selectedSession.traces).map((trace, index) => {
                    const isReplaying = replay && index <= currentReplayTrace
                    const SourceIcon = iconMap[trace.source.nodeType] || Zap
                    const TargetIcon = iconMap[trace.target.nodeType] || Zap
                    
                    return (
                      <div
                        key={trace.id}
                        className={`p-3 rounded-md border cursor-pointer transition-all ${
                          selectedTrace?.id === trace.id 
                            ? 'border-black bg-gray-50' 
                            : 'border-gray-200 hover:bg-gray-50'
                        } ${isReplaying ? 'animate-pulse bg-blue-50' : ''}`}
                        onClick={async () => {
                          setSelectedTrace(trace)
                          // Check if this trace involves a subgraph node
                          if (trace.source.nodeType === 'subgraph' || trace.target.nodeType === 'subgraph') {
                            try {
                              const subTraces = await FlowTraceService.getSubgraphTraces(trace.id)
                              setSubgraphTraces(subTraces)
                              setShowSubgraphTraces(true)
                            } catch (error) {
                              console.error('Error loading subgraph traces:', error)
                            }
                          } else {
                            setSubgraphTraces([])
                            setShowSubgraphTraces(false)
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {getStatusIcon(trace.status)}
                          
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <SourceIcon className="w-3 h-3 text-gray-600" />
                              <span className="text-xs font-medium text-gray-900 truncate">
                                {trace.source.nodeName}
                              </span>
                            </div>
                            
                            <ArrowRight className="w-3 h-3 text-gray-400 mx-1" />
                            
                            <div className="flex items-center gap-1">
                              <TargetIcon className="w-3 h-3 text-gray-600" />
                              <span className="text-xs font-medium text-gray-900 truncate">
                                {trace.target.nodeName}
                              </span>
                            </div>
                          </div>
                          
                          <span className="text-xs text-gray-500">
                            {trace.duration}ms
                          </span>
                        </div>
                        
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <span>{trace.source.portName} → {trace.target.portName}</span>
                          <span>•</span>
                          <span>{(trace.data.size / 1024).toFixed(1)}KB</span>
                        </div>
                      </div>
                    )
                  })}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Zap className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-sm">Select a session to view traces</p>
                </div>
              </div>
            )}
          </div>

          {/* Trace Details */}
          <div className="flex-1 overflow-y-auto">
            {selectedTrace ? (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  {getStatusIcon(selectedTrace.status)}
                  <h3 className="text-lg font-medium text-gray-900">Trace Details</h3>
                </div>
                
                <div className="space-y-6">
                  {/* Status and Timing */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Status & Performance</h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Status</span>
                        <span className={`font-medium px-2 py-0.5 rounded ${getStatusColor(selectedTrace.status)}`}>
                          {selectedTrace.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Duration</span>
                        <span className="text-gray-900">{selectedTrace.duration}ms</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Timestamp</span>
                        <span className="text-gray-900">
                          {new Date(selectedTrace.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Error Details */}
                  {selectedTrace.error && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 text-red-600">Error Details</h4>
                      <div className="bg-red-50 rounded-lg p-4 space-y-2">
                        <div className="text-sm">
                          <span className="text-red-600 font-medium">Message:</span>
                          <p className="text-red-800 mt-1">{selectedTrace.error.message}</p>
                        </div>
                        {selectedTrace.error.code && (
                          <div className="text-sm">
                            <span className="text-red-600 font-medium">Code:</span>
                            <p className="text-red-800 mt-1 font-mono">{selectedTrace.error.code}</p>
                          </div>
                        )}
                        {selectedTrace.error.stack && (
                          <div className="text-sm">
                            <span className="text-red-600 font-medium">Stack Trace:</span>
                            <pre className="text-red-800 mt-1 text-xs font-mono overflow-x-auto">
                              {selectedTrace.error.stack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Connection Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Connection</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1 bg-gray-700 rounded">
                            {React.createElement(iconMap[selectedTrace.source.nodeType] || Zap, {
                              className: "w-3 h-3 text-white"
                            })}
                          </div>
                          <span className="text-sm font-medium text-gray-900">Source</span>
                        </div>
                        <dl className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Node</dt>
                            <dd className="text-gray-900">{selectedTrace.source.nodeName}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Port</dt>
                            <dd className="text-gray-900">{selectedTrace.source.portName}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Type</dt>
                            <dd className="text-gray-900">{selectedTrace.source.portType}</dd>
                          </div>
                        </dl>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1 bg-gray-700 rounded">
                            {React.createElement(iconMap[selectedTrace.target.nodeType] || Zap, {
                              className: "w-3 h-3 text-white"
                            })}
                          </div>
                          <span className="text-sm font-medium text-gray-900">Target</span>
                        </div>
                        <dl className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Node</dt>
                            <dd className="text-gray-900">{selectedTrace.target.nodeName}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Port</dt>
                            <dd className="text-gray-900">{selectedTrace.target.portName}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Type</dt>
                            <dd className="text-gray-900">{selectedTrace.target.portType}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>

                  {/* Data Payload */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Data Payload</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">
                          Type: <span className="font-medium text-gray-700">{selectedTrace.data.type}</span>
                        </span>
                        <span className="text-sm text-gray-500">
                          Size: <span className="font-medium text-gray-700">
                            {(selectedTrace.data.size / 1024).toFixed(2)}KB
                          </span>
                        </span>
                      </div>
                      <pre className="text-xs font-mono bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                        {JSON.stringify(selectedTrace.data.payload, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Subgraph Traces */}
                  {showSubgraphTraces && subgraphTraces.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Subgraph Execution Traces</h4>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-blue-700 mb-3">
                          This trace executed a subgraph. Below are the traces from inside the subgraph:
                        </p>
                        <div className="space-y-2">
                          {subgraphTraces.map((subTrace) => {
                            const SubSourceIcon = iconMap[subTrace.source.nodeType] || Zap
                            const SubTargetIcon = iconMap[subTrace.target.nodeType] || Zap
                            
                            return (
                              <div
                                key={subTrace.id}
                                className="bg-white p-3 rounded border border-blue-200"
                              >
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(subTrace.status)}
                                  
                                  <div className="flex items-center gap-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                      <SubSourceIcon className="w-3 h-3 text-gray-600" />
                                      <span className="text-xs font-medium text-gray-900 truncate">
                                        {subTrace.source.nodeName}
                                      </span>
                                    </div>
                                    
                                    <ArrowRight className="w-3 h-3 text-gray-400 mx-1" />
                                    
                                    <div className="flex items-center gap-1">
                                      <SubTargetIcon className="w-3 h-3 text-gray-600" />
                                      <span className="text-xs font-medium text-gray-900 truncate">
                                        {subTrace.target.nodeName}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <span className="text-xs text-gray-500">
                                    {subTrace.duration}ms
                                  </span>
                                </div>
                                
                                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                  <span>{subTrace.source.portName} → {subTrace.target.portName}</span>
                                  <span>•</span>
                                  <span>{(subTrace.data.size / 1024).toFixed(1)}KB</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Clock className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-sm">Select a trace to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}