export interface FlowTrace {
  id: string
  graphId: string | undefined
  graphName: string | undefined
  parentTraceId?: string
  depth?: number
  timestamp: string
  duration: number // milliseconds
  status: 'success' | 'error' | 'warning'
  source: TraceNode
  target: TraceNode
  data: TraceData
  error?: TraceError
}

export interface TraceNode {
  nodeId: string
  nodeName: string
  nodeType: string
  portId: string
  portName: string
  portType: 'input' | 'output'
}

export interface TraceData {
  payload: any
  size: number // bytes
  type: string // data type
  preview?: string // truncated preview for large data
}

export interface TraceError {
  message: string
  code?: string
  stack?: string
}

export interface FlowTraceSession {
  id: string
  workflowId: string
  workflowName: string
  startTime: string
  endTime?: string
  traces: FlowTrace[]
  status: 'running' | 'completed' | 'failed'
  summary: {
    totalTraces: number
    successCount: number
    errorCount: number
    warningCount: number
    totalDataSize: number
    averageDuration: number
  }
}

export interface TraceReplay {
  sessionId: string
  currentTraceIndex: number
  isPlaying: boolean
  playbackSpeed: number // 1x, 2x, 0.5x etc
  startTime: number
  elapsedTime: number
}
