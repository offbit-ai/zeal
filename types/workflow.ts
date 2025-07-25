import { LucideIcon } from 'lucide-react'

export type NodeShape = 'rectangle' | 'circle' | 'diamond'

export type NodeVariant = 'black' | 'gray-700' | 'gray-600' | 'gray-800' | 'gray-900' | 'blue-600'

export interface Port {
  id: string
  label: string
  type: 'input' | 'output'
  position: 'top' | 'right' | 'bottom' | 'left'
}

export interface NodeMetadata {
  id: string
  type: string
  title: string
  subtitle?: string
  icon: LucideIcon
  variant: NodeVariant
  shape: NodeShape
  size?: 'small' | 'medium' | 'large'
  ports?: Port[]
}

export interface WorkflowNodeData {
  metadata: NodeMetadata
  position: {
    x: number
    y: number
  }
}

export type ConnectionState = 'pending' | 'warning' | 'error' | 'success'

export interface Connection {
  id: string
  source: {
    nodeId: string
    portId: string
  }
  target: {
    nodeId: string
    portId: string
  }
  state?: ConnectionState
}