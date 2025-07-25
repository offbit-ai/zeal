'use client'

import React from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { 
  Clock, 
  Webhook, 
  Mail, 
  Database,
  GitBranch,
  Code,
  MessageSquare,
  Edit3,
  Bot
} from 'lucide-react'

interface WorkflowNodeData {
  label: string
  nodeType: 'trigger' | 'action' | 'condition' | 'ai'
  description?: string
  config?: Record<string, any>
}

const nodeIcons = {
  'schedule trigger': Clock,
  'webhook trigger': Webhook,
  'send email': Mail,
  'database query': Database,
  'get database': Database,
  'update crm': Code,
  'ai agent 1': Bot,
  'claude opus 4.0': Bot,
  'crm database': Database,
  'telegram': MessageSquare,
  'if 1': GitBranch,
  'memory': Edit3,
  'condition': GitBranch,
  'ai': Bot,
}

const nodeStyles = {
  trigger: 'bg-[#1A1A1A] text-white border-[#1A1A1A]',
  action: 'bg-[#374151] text-white border-[#374151]', 
  condition: 'bg-[#6B7280] text-white border-[#6B7280]',
  ai: 'bg-[#1F2937] text-white border-[#1F2937]',
}

export function WorkflowNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData
  const iconKey = nodeData.label?.toLowerCase() as keyof typeof nodeIcons
  const IconComponent = nodeIcons[iconKey] || Code
  const styleClass = nodeStyles[nodeData.nodeType] || nodeStyles.action

  return (
    <div
      className={`relative bg-white rounded-lg shadow-sm border-2 transition-all duration-200 ${
        selected ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
      }`}
      style={{ width: '280px', minHeight: '80px' }}
      data-testid={`workflow-node-${nodeData.nodeType}`}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-gray-300 !border-2 !border-gray-500 hover:!bg-gray-400"
        data-testid="input-handle"
      />
      
      {/* Node Header */}
      <div className={`${styleClass} px-4 py-3 rounded-t-lg flex items-center space-x-3`}>
        <div className="flex-shrink-0 p-2 bg-black bg-opacity-20 rounded-md">
          <IconComponent size={24} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">
            {nodeData.label}
          </h3>
          {nodeData.description && (
            <p className="text-xs text-gray-200 opacity-90 truncate">
              {nodeData.description}
            </p>
          )}
        </div>
      </div>

      {/* Node Body */}
      {nodeData.config && (
        <div className="px-4 py-3 bg-gray-50 rounded-b-lg">
          <div className="space-y-1">
            {Object.entries(nodeData.config).slice(0, 2).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="font-medium text-gray-600 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span className="text-gray-800 truncate ml-2 max-w-[120px]">
                  {typeof value === 'string' ? value : JSON.stringify(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-gray-300 !border-2 !border-gray-500 hover:!bg-gray-400"
        data-testid="output-handle"
      />

      {/* Conditional node multiple outputs */}
      {nodeData.nodeType === 'condition' && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{ top: '35%' }}
            className="w-3 h-3 !bg-green-400 !border-2 !border-green-600"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{ top: '65%' }}
            className="w-3 h-3 !bg-red-400 !border-2 !border-red-600"
          />
        </>
      )}
    </div>
  )
}