'use client'

import { useState } from 'react'
import { Plus, X, GripVertical, Code, Filter, ArrowUpDown, Shuffle, Users, Calculator, Merge, Split, Info } from 'lucide-react'
import { DataOperationSet, DataOperation, DataOperationType, SortDirection, AggregateFunction } from '@/types/workflow'

interface DataOperationBuilderProps {
  value: DataOperationSet[]
  onChange: (value: DataOperationSet[]) => void
}

// Operation type configurations
const OPERATION_CONFIGS = {
  map: {
    icon: Code,
    label: 'Map Fields',
    color: 'bg-blue-500',
    description: 'Transform field names and values'
  },
  filter: {
    icon: Filter,
    label: 'Filter Data',
    color: 'bg-green-500',
    description: 'Remove items based on conditions'
  },
  sort: {
    icon: ArrowUpDown,
    label: 'Sort',
    color: 'bg-purple-500',
    description: 'Order data by field values'
  },
  transform: {
    icon: Shuffle,
    label: 'Transform',
    color: 'bg-orange-500',
    description: 'Apply custom transformations'
  },
  group: {
    icon: Users,
    label: 'Group By',
    color: 'bg-indigo-500',
    description: 'Group items by field values'
  },
  aggregate: {
    icon: Calculator,
    label: 'Aggregate',
    color: 'bg-red-500',
    description: 'Calculate summary values'
  },
  merge: {
    icon: Merge,
    label: 'Merge',
    color: 'bg-teal-500',
    description: 'Combine multiple data sources'
  },
  split: {
    icon: Split,
    label: 'Split',
    color: 'bg-pink-500',
    description: 'Split data into multiple outputs'
  }
} as const

const AGGREGATE_FUNCTIONS: AggregateFunction[] = ['sum', 'avg', 'count', 'min', 'max', 'first', 'last']

export function DataOperationBuilder({ 
  value = [], 
  onChange
}: DataOperationBuilderProps) {
  
  const generateId = () => Math.random().toString(36).substr(2, 9)

  // Create a new operation
  const createOperation = (type: DataOperationType): DataOperation => ({
    id: generateId(),
    type,
    enabled: true,
    description: ''
  })

  // Create a new operation set
  const createOperationSet = (): DataOperationSet => ({
    id: generateId(),
    name: 'Data Pipeline',
    operations: []
  })

  // Add new operation set
  const addOperationSet = () => {
    onChange([...value, createOperationSet()])
  }

  // Remove operation set
  const removeOperationSet = (setIndex: number) => {
    onChange(value.filter((_, index) => index !== setIndex))
  }

  // Update operation set
  const updateOperationSet = (setIndex: number, updates: Partial<DataOperationSet>) => {
    const newValue = [...value]
    newValue[setIndex] = { ...newValue[setIndex], ...updates }
    onChange(newValue)
  }

  // Add operation to set
  const addOperation = (setIndex: number, type: DataOperationType) => {
    const newValue = [...value]
    newValue[setIndex].operations.push(createOperation(type))
    onChange(newValue)
  }

  // Remove operation
  const removeOperation = (setIndex: number, opIndex: number) => {
    const newValue = [...value]
    newValue[setIndex].operations = newValue[setIndex].operations.filter((_, index) => index !== opIndex)
    onChange(newValue)
  }

  // Update operation
  const updateOperation = (setIndex: number, opIndex: number, updates: Partial<DataOperation>) => {
    const newValue = [...value]
    newValue[setIndex].operations[opIndex] = { ...newValue[setIndex].operations[opIndex], ...updates }
    onChange(newValue)
  }

  // Add mapping field
  const addMappingField = (setIndex: number, opIndex: number) => {
    const operation = value[setIndex].operations[opIndex]
    const newMapping = [...(operation.mapping || []), { sourceField: '', targetField: '', transform: '' }]
    updateOperation(setIndex, opIndex, { mapping: newMapping })
  }

  // Remove mapping field
  const removeMappingField = (setIndex: number, opIndex: number, mappingIndex: number) => {
    const operation = value[setIndex].operations[opIndex]
    const newMapping = operation.mapping?.filter((_, index) => index !== mappingIndex) || []
    updateOperation(setIndex, opIndex, { mapping: newMapping })
  }

  // Update mapping field
  const updateMappingField = (setIndex: number, opIndex: number, mappingIndex: number, field: string, fieldValue: string) => {
    const operation = value[setIndex].operations[opIndex]
    const newMapping = [...(operation.mapping || [])]
    newMapping[mappingIndex] = { ...newMapping[mappingIndex], [field]: fieldValue }
    updateOperation(setIndex, opIndex, { mapping: newMapping })
  }

  // Render operation-specific fields
  const renderOperationFields = (operation: DataOperation, setIndex: number, opIndex: number) => {
    switch (operation.type) {
      case 'map':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Field Mappings</label>
              <button
                onClick={() => addMappingField(setIndex, opIndex)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                + Add Mapping
              </button>
            </div>
            {(operation.mapping || []).map((mapping, mappingIndex) => (
              <div key={mappingIndex} className="grid grid-cols-3 gap-2 p-2 bg-gray-50 rounded">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Source</label>
                  <input
                    type="text"
                    value={mapping.sourceField}
                    onChange={(e) => updateMappingField(setIndex, opIndex, mappingIndex, 'sourceField', e.target.value)}
                    placeholder="e.g., ${input.get('data').data.fieldName}"
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target</label>
                  <input
                    type="text"
                    value={mapping.targetField}
                    onChange={(e) => updateMappingField(setIndex, opIndex, mappingIndex, 'targetField', e.target.value)}
                    placeholder="New field name"
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => removeMappingField(setIndex, opIndex, mappingIndex)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Transform (optional)</label>
                  <input
                    type="text"
                    value={mapping.transform || ''}
                    onChange={(e) => updateMappingField(setIndex, opIndex, mappingIndex, 'transform', e.target.value)}
                    placeholder="e.g., ${input.get('data').data.value}.toUpperCase(), ${input.get('data').data.price} * 2"
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        )

      case 'filter':
        return (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter Expression</label>
            <textarea
              value={operation.filterExpression || ''}
              onChange={(e) => updateOperation(setIndex, opIndex, { filterExpression: e.target.value })}
              placeholder="e.g., ${input.get('data').data.age} > 18 && ${input.get('data').data.status} === 'active'"
              rows={2}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 font-mono"
            />
          </div>
        )

      case 'sort':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sort Field</label>
              <input
                type="text"
                value={operation.sortField || ''}
                onChange={(e) => updateOperation(setIndex, opIndex, { sortField: e.target.value })}
                placeholder="e.g., ${input.get('data').data.timestamp}"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Direction</label>
              <select
                value={operation.sortDirection || 'asc'}
                onChange={(e) => updateOperation(setIndex, opIndex, { sortDirection: e.target.value as SortDirection })}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        )

      case 'transform':
        return (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Transform Expression</label>
            <textarea
              value={operation.transformExpression || ''}
              onChange={(e) => updateOperation(setIndex, opIndex, { transformExpression: e.target.value })}
              placeholder="e.g., { ...${input.get('data').data}, fullName: ${input.get('data').data.firstName} + ' ' + ${input.get('data').data.lastName} }"
              rows={3}
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 font-mono"
            />
          </div>
        )

      case 'group':
        return (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Group By Field</label>
            <input
              type="text"
              value={operation.groupByField || ''}
              onChange={(e) => updateOperation(setIndex, opIndex, { groupByField: e.target.value })}
              placeholder="e.g., ${input.get('data').data.category}"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 font-mono"
            />
          </div>
        )

      case 'aggregate':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Field</label>
              <input
                type="text"
                value={operation.aggregateField || ''}
                onChange={(e) => updateOperation(setIndex, opIndex, { aggregateField: e.target.value })}
                placeholder="e.g., ${input.get('data').data.amount}"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Function</label>
              <select
                value={operation.aggregateFunction || 'sum'}
                onChange={(e) => updateOperation(setIndex, opIndex, { aggregateFunction: e.target.value as AggregateFunction })}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1"
              >
                {AGGREGATE_FUNCTIONS.map(func => (
                  <option key={func} value={func}>{func.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-xs text-gray-500 italic">
            Configuration for {operation.type} operation coming soon...
          </div>
        )
    }
  }

  return (
    <div className="space-y-4">
      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-800">
            <div className="font-semibold mb-1">Dynamic Input Syntax</div>
            <div className="space-y-1">
              <div>• Access data from specific input port: <code className="bg-blue-100 px-1 rounded">${'{input.get("portName").data}'}</code></div>
              <div>• Access nested fields: <code className="bg-blue-100 px-1 rounded">${'{input.get("portName").data.fieldName}'}</code></div>
              <div>• Array access: <code className="bg-blue-100 px-1 rounded">${'{input.get("portName").data[0]}'}</code></div>
              <div>• Multiple ports: <code className="bg-blue-100 px-1 rounded">${'{input.get("port1").data.value + input.get("port2").data.value}'}</code></div>
              <div>• Supports JavaScript expressions within template literals</div>
            </div>
          </div>
        </div>
      </div>
      {value.map((operationSet, setIndex) => (
        <div key={operationSet.id} className="border border-gray-200 rounded-lg bg-gray-50 p-4">
          {/* Operation Set Header */}
          <div className="flex items-center justify-between mb-4">
            <input
              type="text"
              value={operationSet.name}
              onChange={(e) => updateOperationSet(setIndex, { name: e.target.value })}
              className="text-sm font-medium bg-transparent border-none outline-none"
            />
            <button
              onClick={() => removeOperationSet(setIndex)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Operations */}
          <div className="space-y-3">
            {operationSet.operations.map((operation, opIndex) => {
              const config = OPERATION_CONFIGS[operation.type]
              const Icon = config.icon

              return (
                <div key={operation.id} className="bg-white border border-gray-200 rounded-md p-3">
                  {/* Operation Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <div className={`p-1 rounded ${config.color} text-white`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{config.label}</span>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={operation.enabled}
                          onChange={(e) => updateOperation(setIndex, opIndex, { enabled: e.target.checked })}
                          className="w-3 h-3"
                        />
                        <span className="text-xs text-gray-500">Enabled</span>
                      </label>
                    </div>
                    <button
                      onClick={() => removeOperation(setIndex, opIndex)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Operation Description */}
                  <div className="mb-3">
                    <input
                      type="text"
                      value={operation.description || ''}
                      onChange={(e) => updateOperation(setIndex, opIndex, { description: e.target.value })}
                      placeholder={config.description}
                      className="w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1"
                    />
                  </div>

                  {/* Operation-specific Fields */}
                  {renderOperationFields(operation, setIndex, opIndex)}
                </div>
              )
            })}

            {/* Add Operation Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(OPERATION_CONFIGS).map(([type, config]) => {
                const Icon = config.icon
                return (
                  <button
                    key={type}
                    onClick={() => addOperation(setIndex, type as DataOperationType)}
                    className="flex items-center gap-2 p-2 text-xs text-gray-600 border border-dashed border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    <div className={`p-1 rounded ${config.color} text-white`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    {config.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ))}

      {/* Add Operation Set Button */}
      <button
        onClick={addOperationSet}
        className="w-full py-3 text-sm text-gray-600 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Data Pipeline
      </button>

      {value.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-sm">No data operations configured</div>
          <div className="text-xs mt-1">Click "Add Data Pipeline" to create your first data transformation</div>
        </div>
      )}
    </div>
  )
}