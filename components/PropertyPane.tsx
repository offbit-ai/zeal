'use client'

import { useState, useEffect } from 'react'
import {
  NodeMetadata,
  PropertyDefinition,
  PropertyType,
  RuleSet,
  DataOperationSet,
} from '@/types/workflow'
import { X, Settings, Edit3, Database, Trash2, AlertTriangle } from 'lucide-react'
import { useWorkflowStore } from '@/store/workflow-store'
import { RuleEditorModal } from './RuleEditorModal'
import { DataOperationModal } from './DataOperationModal'
import { ModalPortal } from './ModalPortal'
import { CodeEditor } from './CodeEditor'
import { FileUploadField } from './FileUploadField'
import { updateDynamicNodeMetadata, shouldUpdateDynamicMetadata } from '@/utils/dynamicNodeMetadata'

interface PropertyPaneProps {
  selectedNodeId: string | null
  onClose: () => void
  isClosing?: boolean
}

// Component for rendering individual property fields
function PropertyField({
  property,
  value,
  onChange,
  onOpenRuleEditor,
  onOpenDataOpEditor,
  nodeId,
}: {
  property: PropertyDefinition
  value: any
  onChange: (value: any) => void
  onOpenRuleEditor?: (property: PropertyDefinition) => void
  onOpenDataOpEditor?: (property: PropertyDefinition) => void
  nodeId?: string
}) {
  const handleChange = (newValue: any) => {
    onChange(newValue)
  }

  switch (property.type) {
    case 'text':
      return (
        <input
          type="text"
          value={value || ''}
          onChange={e => handleChange(e.target.value)}
          placeholder={property.placeholder}
          required={property.required}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
        />
      )

    case 'number':
      return (
        <input
          type="number"
          value={value || ''}
          onChange={e => handleChange(Number(e.target.value))}
          placeholder={property.placeholder}
          required={property.required}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
        />
      )

    case 'select':
      return (
        <select
          value={value || property.defaultValue || ''}
          onChange={e => handleChange(e.target.value)}
          required={property.required}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
        >
          {property.options?.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value !== undefined ? value : property.defaultValue}
            onChange={e => handleChange(e.target.checked)}
            className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-400 focus:ring-1"
          />
          <span className="text-sm text-gray-700">
            {value !== undefined
              ? value
                ? 'Enabled'
                : 'Disabled'
              : property.defaultValue
                ? 'Enabled'
                : 'Disabled'}
          </span>
        </label>
      )

    case 'textarea':
      return (
        <textarea
          value={value || ''}
          onChange={e => handleChange(e.target.value)}
          placeholder={property.placeholder}
          required={property.required}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 resize-none"
        />
      )

    case 'rules':
      const ruleCount = Array.isArray(value) ? value.length : 0
      return (
        <button
          onClick={() => onOpenRuleEditor?.(property)}
          className="w-full p-3 text-left border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700">
                {ruleCount === 0
                  ? 'No rules configured'
                  : `${ruleCount} rule set${ruleCount !== 1 ? 's' : ''}`}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Click to {ruleCount === 0 ? 'create' : 'edit'} rules
              </div>
            </div>
            <Edit3 className="w-4 h-4 text-gray-400" />
          </div>
        </button>
      )

    case 'dataOperations':
      const operationCount = Array.isArray(value)
        ? value.reduce((total: number, set: any) => total + (set.operations?.length || 0), 0)
        : 0
      return (
        <button
          onClick={() => onOpenDataOpEditor?.(property)}
          className="w-full p-3 text-left border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700">
                {operationCount === 0
                  ? 'No operations configured'
                  : `${operationCount} operation${operationCount !== 1 ? 's' : ''}`}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Click to {operationCount === 0 ? 'create' : 'edit'} data operations
              </div>
            </div>
            <Database className="w-4 h-4 text-gray-400" />
          </div>
        </button>
      )

    case 'code-editor':
      return (
        <CodeEditor
          value={value || ''}
          onChange={handleChange}
          language={property.language || 'javascript'}
          placeholder={property.placeholder}
          height={property.height || 200}
          lineNumbers={property.lineNumbers !== false}
          wordWrap={property.wordWrap !== false}
          minimap={property.minimap || false}
          theme="light"
        />
      )

    case 'file':
      return (
        <FileUploadField
          value={value}
          onChange={(fileUrl, metadata) => {
            handleChange(fileUrl)
          }}
          acceptedFormats={property.acceptedFormats}
          maxFileSize={property.maxFileSize}
          fileType={property.fileType}
          label={property.label}
          description={property.description}
          nodeId={nodeId}
        />
      )

    default:
      return <div className="text-sm text-gray-500">Unsupported property type: {property.type}</div>
  }
}

export function PropertyPane({ selectedNodeId, onClose, isClosing = false }: PropertyPaneProps) {
  const { nodes, updateNodeProperty, updateNodeMetadata, removeNode, currentGraphId } =
    useWorkflowStore()
  const setGraphDirty = (graphId: string, isDirty: boolean) => {
    // TODO: Track dirty state locally if needed
  }
  const selectedNode = nodes.find(node => node.metadata.id === selectedNodeId)

  const [localPropertyValues, setLocalPropertyValues] = useState<Record<string, any>>({})
  const [ruleEditorOpen, setRuleEditorOpen] = useState(false)
  const [currentRuleProperty, setCurrentRuleProperty] = useState<PropertyDefinition | null>(null)
  const [dataOpEditorOpen, setDataOpEditorOpen] = useState(false)
  const [currentDataOpProperty, setCurrentDataOpProperty] = useState<PropertyDefinition | null>(
    null
  )
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null)

  // Initialize local state when node selection changes
  useEffect(() => {
    if (selectedNode && selectedNodeId !== lastSelectedNodeId) {
      // New node selected - initialize from stored values
      setLocalPropertyValues({ ...(selectedNode.metadata.propertyValues || {}) })
      setLastSelectedNodeId(selectedNodeId)
    } else if (!selectedNode) {
      // No node selected
      setLocalPropertyValues({})
      setLastSelectedNodeId(null)
    }
    // Don't update local values when the same node's metadata changes
  }, [selectedNodeId, selectedNode, lastSelectedNodeId])

  // Handle initial render animation
  useEffect(() => {
    if (isInitialRender) {
      // Small delay to ensure the component is mounted before starting animation
      const timer = setTimeout(() => {
        setIsInitialRender(false)
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [isInitialRender])

  // Convert properties from object format to array format for rendering
  const properties = selectedNode?.metadata.properties
    ? Object.entries(selectedNode.metadata.properties).map(([id, prop]: [string, any]) => ({
        id,
        ...prop,
      }))
    : []

  // Handle property value changes (local only, no auto-save)
  const handlePropertyChange = async (propertyId: string, value: any) => {
    if (!selectedNode) return

    const updatedValues = { ...localPropertyValues, [propertyId]: value }

    // Handle linked properties (e.g., imageFile -> imageData)
    const property = properties.find(p => p.id === propertyId)
    if (property?.linkedProperty) {
      updatedValues[property.linkedProperty] = value
    }

    setLocalPropertyValues(updatedValues)

    // Apply dynamic metadata updates in real-time for visual feedback
    if (shouldUpdateDynamicMetadata(selectedNode.metadata.propertyRules, propertyId)) {
      try {
        const updatedMetadata = await updateDynamicNodeMetadata(
          selectedNode.metadata,
          updatedValues,
          selectedNode.metadata.propertyRules
        )
        Object.keys(updatedMetadata.propertyValues ?? {}).forEach(key => {
          if (updatedMetadata.propertyValues && updatedMetadata.propertyValues[key] === undefined) {
            delete updatedMetadata.propertyValues[key]
          }
          // Update the node metadata immediately for visual feedback
          updateNodeProperty(
            selectedNodeId!,
            key,
            updatedMetadata.propertyValues ? updatedMetadata.propertyValues[key] : null
          ) // saveSnapshot = false for real-time updates
        })

        // Don't mark as dirty for real-time preview updates
      } catch (error) {
        console.error('Failed to apply dynamic metadata updates:', error)
      }
    }
  }

  // Handle save and close
  const handleDeleteNode = () => {
    if (!selectedNode) return
    removeNode(selectedNode.metadata.id)
    setGraphDirty(currentGraphId, true)
    setShowDeleteConfirmation(false)
    onClose()
  }

  const handleSaveAndClose = async () => {
    if (!selectedNode) return

    // Update the node metadata with new property values and create undo snapshot
    let updatedMetadata: NodeMetadata = {
      ...selectedNode.metadata,
      propertyValues: localPropertyValues,
    }

    try {
      // Apply any final dynamic metadata updates before saving
      const finalMetadata = await updateDynamicNodeMetadata(
        updatedMetadata,
        localPropertyValues,
        selectedNode.metadata.propertyRules
      )
      updatedMetadata = finalMetadata
    } catch (error) {
      console.error('Failed to apply final dynamic metadata updates:', error)
      // Continue with basic metadata if dynamic updates fail
    }

    updateNodeMetadata(selectedNodeId!, updatedMetadata, true) // saveSnapshot = true
    setGraphDirty(currentGraphId, true)
    onClose()
  }

  // Handle opening rule editor
  const handleOpenRuleEditor = (property: PropertyDefinition) => {
    setCurrentRuleProperty(property)
    setRuleEditorOpen(true)
  }

  // Handle rule editor close
  const handleRuleEditorClose = () => {
    setRuleEditorOpen(false)
    setCurrentRuleProperty(null)
  }

  // Handle rule changes from modal (updates local state only)
  const handleRuleChange = (rules: RuleSet[]) => {
    if (currentRuleProperty) {
      handlePropertyChange(currentRuleProperty.id, rules)
    }
  }

  // Handle opening data operation editor
  const handleOpenDataOpEditor = (property: PropertyDefinition) => {
    setCurrentDataOpProperty(property)
    setDataOpEditorOpen(true)
  }

  // Handle data operation editor close
  const handleDataOpEditorClose = () => {
    setDataOpEditorOpen(false)
    setCurrentDataOpProperty(null)
  }

  // Handle data operation changes from modal (updates local state only)
  const handleDataOpChange = (operations: DataOperationSet[]) => {
    if (currentDataOpProperty) {
      handlePropertyChange(currentDataOpProperty.id, operations)
    }
  }

  if (!selectedNodeId || !selectedNode) {
    return (
      <div className="w-80 h-full bg-white border-l border-gray-200 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Settings className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <div className="text-sm font-medium">No node selected</div>
          <div className="text-xs mt-1">Select a node to edit its properties</div>
        </div>
      </div>
    )
  }

  const { metadata } = selectedNode

  return (
    <div
      className={`w-80 h-full bg-white border-l border-gray-200 flex flex-col transform transition-all duration-300 ease-out ${
        isClosing || isInitialRender ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-sm font-medium text-gray-900">Properties</h2>
          <div className="text-xs text-gray-500 mt-0.5">{metadata.title}</div>
          {metadata.type === 'subgraph' && metadata.graphId && (
            <div className="text-xs text-gray-400 mt-0.5">Graph ID: {metadata.graphId}</div>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition-colors">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Subgraph Information Section */}
        {metadata.type === 'subgraph' && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-xs font-medium text-gray-600 mb-2">Subgraph Information</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Name:</span>
                <span className="text-gray-700">{metadata.graphName || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Namespace:</span>
                <span className="text-gray-700">
                  {metadata.workflowName
                    ? `${metadata.workflowName}/${metadata.graphId}`
                    : metadata.graphNamespace || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ID:</span>
                <span className="text-gray-700 font-mono">{metadata.graphId || 'Unknown'}</span>
              </div>
            </div>
          </div>
        )}

        {properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Settings className="w-6 h-6 mb-2 text-gray-400" />
            <div className="text-sm">No properties configured</div>
            <div className="text-xs">This node type has no editable properties</div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {properties.map(property => {
              const currentValue = localPropertyValues[property.id]

              // Check visibility condition using current local values
              if (property.visibleWhen) {
                try {
                  // Create a safe evaluation context with all properties
                  const evalContext = { ...localPropertyValues }

                  // Extract all variable names from the condition
                  const variableNames = property.visibleWhen.match(/\b\w+\b/g) || []

                  // Ensure all referenced variables exist in context
                  variableNames.forEach((varName: string) => {
                    if (!(varName in evalContext) && properties.find(p => p.id === varName)) {
                      evalContext[varName] = undefined
                    }
                  })

                  // Create function body that declares all variables
                  const varDeclarations = Object.entries(evalContext)
                    .map(([key, value]) => `const ${key} = ${JSON.stringify(value)};`)
                    .join('\n')

                  const functionBody = `
                    ${varDeclarations}
                    return ${property.visibleWhen};
                  `

                  const condition = new Function(functionBody)
                  const isVisible = condition()
                  if (!isVisible) return null
                } catch (error) {
                  console.error(`Error evaluating visibility condition for ${property.id}:`, error)
                  // Default to showing the property if evaluation fails
                  return null
                }
              }

              return (
                <div key={property.id}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-600">
                      {property.id}
                      {property.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  </div>

                  <PropertyField
                    property={property}
                    value={currentValue}
                    onChange={value => handlePropertyChange(property.id, value)}
                    onOpenRuleEditor={handleOpenRuleEditor}
                    onOpenDataOpEditor={handleOpenDataOpEditor}
                    nodeId={selectedNodeId || undefined}
                  />

                  {property.description && (
                    <div className="text-xs text-gray-500 mt-1">{property.description}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer with save button and node info */}
      <div className="border-t border-gray-200 bg-gray-50">
        {/* Action Buttons */}
        <div className="p-4 border-b border-gray-200 space-y-2">
          <button
            onClick={handleSaveAndClose}
            className="w-full px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
          >
            Save & Close
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-200 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>

          {/* Divider */}
          <div className="my-4">
            <div className="w-full border-t-2 border-gray-300"></div>
          </div>

          <button
            onClick={() => setShowDeleteConfirmation(true)}
            className="w-full px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Node
          </button>
        </div>

        {/* Node Info */}
        <div className="p-4">
          <div className="text-xs text-gray-500 space-y-1">
            <div>
              <span className="font-medium">Type:</span> {metadata.type}
            </div>
            <div>
              <span className="font-medium">ID:</span> {metadata.id}
            </div>
            {metadata.ports && (
              <div>
                <span className="font-medium">Ports:</span> {metadata.ports.length} configured
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rule Editor Modal */}
      <ModalPortal isOpen={ruleEditorOpen}>
        <RuleEditorModal
          isOpen={ruleEditorOpen}
          onClose={handleRuleEditorClose}
          title={currentRuleProperty ? currentRuleProperty.label : 'Rule Editor'}
          description={currentRuleProperty?.description}
          value={currentRuleProperty ? localPropertyValues[currentRuleProperty.id] || [] : []}
          onChange={handleRuleChange}
          availableFields={currentRuleProperty?.availableFields || []}
          availableOperators={currentRuleProperty?.availableOperators}
        />
      </ModalPortal>

      {/* Data Operation Modal */}
      <ModalPortal isOpen={dataOpEditorOpen}>
        <DataOperationModal
          isOpen={dataOpEditorOpen}
          onClose={handleDataOpEditorClose}
          title={currentDataOpProperty ? currentDataOpProperty.label : 'Data Operations'}
          description={currentDataOpProperty?.description}
          value={currentDataOpProperty ? localPropertyValues[currentDataOpProperty.id] || [] : []}
          onChange={handleDataOpChange}
          availableFields={currentDataOpProperty?.availableFields || []}
        />
      </ModalPortal>

      {/* Delete Confirmation Modal */}
      <ModalPortal isOpen={showDeleteConfirmation}>
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowDeleteConfirmation(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Node</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete the node "{selectedNode?.metadata.title}"? All
              connections to this node will also be removed.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteNode}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
              >
                Delete Node
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
    </div>
  )
}
