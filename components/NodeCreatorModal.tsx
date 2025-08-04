'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Code,
  FileCode,
  Network,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Upload,
  FileUp,
} from 'lucide-react'
import { NodeMetadata, PropertyType } from '@/types/workflow'
import { CodeEditor } from './CodeEditor'
import { Icon, useIconLibrary } from '@/lib/icons'
import { BrandIcons } from '@/lib/icons/brand-icons'
import { ModalPortal } from './ModalPortal'
import apiVerbsSchemaData from '@/schema/api_tool_verbs_schema.json'

interface NodeCreatorModalProps {
  isOpen: boolean
  onClose: () => void
  onNodeCreated: (nodeTemplate: NodeMetadata) => void
  editingNode?: NodeMetadata
}

type CreationType = 'script' | 'api' | 'wasm'
type ScriptLanguage = 'python' | 'javascript'
type PortDefinition = {
  id: string
  label: string
  type: 'input' | 'output'
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'
}

// Type for the API verbs schema
interface VerbSchema {
  description: string
  typical_methods: string[]
  examples: string[]
  parameters: string[]
}

interface VerbCategory {
  description: string
  verbs: Record<string, VerbSchema>
}

interface ApiVerbsSchema {
  verb_categories: Record<string, VerbCategory>
}

const apiVerbsSchema = apiVerbsSchemaData as ApiVerbsSchema

export function NodeCreatorModal({
  isOpen,
  onClose,
  onNodeCreated,
  editingNode,
}: NodeCreatorModalProps) {
  const [creationType, setCreationType] = useState<CreationType | null>(null)

  // Script creation state
  const [scriptLanguage, setScriptLanguage] = useState<ScriptLanguage>('python')
  const [scriptName, setScriptName] = useState('')
  const [scriptDescription, setScriptDescription] = useState('')
  const [scriptIcon, setScriptIcon] = useState('code')
  const [scriptPorts, setScriptPorts] = useState<PortDefinition[]>([
    { id: 'input-1', label: 'Input', type: 'input', dataType: 'any' },
    { id: 'output-1', label: 'Output', type: 'output', dataType: 'any' },
  ])
  const [scriptCode, setScriptCode] = useState('')

  // WASM creation state
  const [wasmFile, setWasmFile] = useState<File | null>(null)
  const [wasmFileName, setWasmFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  // API creation state
  const [apiName, setApiName] = useState('')
  const [apiDescription, setApiDescription] = useState('')
  const [apiIcon, setApiIcon] = useState('globe')
  const [selectedVerb, setSelectedVerb] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [apiSchemaFile, setApiSchemaFile] = useState<File | null>(null)
  const [apiSchemaFileName, setApiSchemaFileName] = useState('')
  const [isApiDragging, setIsApiDragging] = useState(false)
  const [apiSchemaContent, setApiSchemaContent] = useState<any>(null)

  // Icon selector state
  const [showIconSelector, setShowIconSelector] = useState(false)
  const [iconSearchQuery, setIconSearchQuery] = useState('')
  const [iconSelectorFor, setIconSelectorFor] = useState<'script' | 'api'>('script')
  const [activeIconTab, setActiveIconTab] = useState<'lucide' | 'brands'>('lucide')
  const [showDescription, setShowDescription] = useState(false)
  const [showApiDescription, setShowApiDescription] = useState(false)
  const [showPipRequirements, setShowPipRequirements] = useState(false)
  const [pipRequirements, setPipRequirements] = useState('')
  const iconLibrary = useIconLibrary()

  // Initialize form with editing data
  useEffect(() => {
    if (editingNode && isOpen) {
      if (editingNode.type === 'script') {
        setCreationType('script')
        setScriptName(editingNode.title)
        setScriptDescription(editingNode.subtitle || '')
        setScriptIcon(editingNode.icon)

        // Determine language from variant color
        const isJavaScript = editingNode.variant?.includes('yellow')
        setScriptLanguage(isJavaScript ? 'javascript' : 'python')

        // Load script code and pip requirements from propertyValues
        if (editingNode.propertyValues) {
          setScriptCode(editingNode.propertyValues.script || '')
          setPipRequirements(editingNode.propertyValues.pipRequirements || '')
          if (editingNode.propertyValues.pipRequirements) {
            setShowPipRequirements(true)
          }
        }

        // Load ports
        if (editingNode.ports) {
          const ports: PortDefinition[] = editingNode.ports.map(port => ({
            id: port.id,
            label: port.label,
            type: port.type,
            dataType: 'any', // Default since we don't store this in metadata
          }))
          setScriptPorts(ports)
        }

        if (editingNode.subtitle) {
          setShowDescription(true)
        }
      } else if (editingNode.type === 'api') {
        setCreationType('api')
        setApiName(editingNode.title)
        setApiDescription(editingNode.subtitle || '')
        setApiIcon(editingNode.icon)

        // Show description field if it has content
        if (editingNode.subtitle) {
          setShowApiDescription(true)
        }

        // Load API properties from propertyValues
        if (editingNode.propertyValues) {
          setApiBaseUrl(editingNode.propertyValues.baseUrl || '')
        }
      }
    }
  }, [editingNode, isOpen])

  const resetForm = () => {
    setCreationType(null)
    setScriptLanguage('python')
    setScriptName('')
    setScriptDescription('')
    setScriptIcon('code')
    setScriptCode('')
    setScriptPorts([
      { id: 'input-1', label: 'Input', type: 'input', dataType: 'any' },
      { id: 'output-1', label: 'Output', type: 'output', dataType: 'any' },
    ])
    setApiName('')
    setApiDescription('')
    setApiIcon('globe')
    setSelectedVerb('')
    setSelectedCategory('')
    setApiBaseUrl('')
    setExpandedCategories(new Set())
    setApiSchemaFile(null)
    setApiSchemaFileName('')
    setIsApiDragging(false)
    setApiSchemaContent(null)
    setShowIconSelector(false)
    setIconSearchQuery('')
    setShowDescription(false)
    setShowApiDescription(false)
    setShowPipRequirements(false)
    setPipRequirements('')
    setWasmFile(null)
    setWasmFileName('')
    setIsDragging(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const addPort = (type: 'input' | 'output') => {
    const newPort: PortDefinition = {
      id: `${type}-${Date.now()}`,
      label: type === 'input' ? 'Input' : 'Output',
      type,
      dataType: 'any',
    }
    setScriptPorts([...scriptPorts, newPort])
  }

  const updatePort = (portId: string, updates: Partial<PortDefinition>) => {
    setScriptPorts(scriptPorts.map(port => (port.id === portId ? { ...port, ...updates } : port)))
  }

  const removePort = (portId: string) => {
    setScriptPorts(scriptPorts.filter(port => port.id !== portId))
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const handleFileUpload = (file: File) => {
    if (file && file.name.endsWith('.wasm')) {
      setWasmFile(file)
      setWasmFileName(file.name)
    } else {
      alert('Please upload a valid .wasm file')
    }
  }

  const handleApiSchemaUpload = async (file: File) => {
    if (
      file &&
      (file.name.endsWith('.json') || file.name.endsWith('.yaml') || file.name.endsWith('.yml'))
    ) {
      setApiSchemaFile(file)
      setApiSchemaFileName(file.name)

      // Read and parse the file content
      try {
        const text = await file.text()
        let schemaContent

        if (file.name.endsWith('.json')) {
          schemaContent = JSON.parse(text)
        } else {
          // For YAML files, we would need a YAML parser
          // For now, we'll just store the text and show a message
          alert('YAML parsing will be implemented. For now, please use JSON files.')
          return
        }

        setApiSchemaContent(schemaContent)

        // Try to extract API information from the schema
        if (schemaContent.info) {
          if (schemaContent.info.title) {
            setApiName(schemaContent.info.title)
          }
          if (schemaContent.info.description) {
            setApiDescription(schemaContent.info.description)
          }
        }

        // Extract base URL from servers array if available (OpenAPI 3.0)
        if (schemaContent.servers && schemaContent.servers.length > 0) {
          setApiBaseUrl(schemaContent.servers[0].url)
        }
        // Or from host/basePath (Swagger 2.0)
        else if (schemaContent.host) {
          const scheme = schemaContent.schemes ? schemaContent.schemes[0] : 'https'
          const basePath = schemaContent.basePath || ''
          setApiBaseUrl(`${scheme}://${schemaContent.host}${basePath}`)
        }
      } catch (error) {
        console.error('Error parsing schema file:', error)
        alert('Error parsing schema file. Please ensure it is valid JSON.')
      }
    } else {
      alert('Please upload a valid .json or .yaml file')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleApiSchemaDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsApiDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleApiSchemaUpload(file)
    }
  }

  const handleApiSchemaDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsApiDragging(true)
  }

  const handleApiSchemaDragLeave = () => {
    setIsApiDragging(false)
  }

  const createWasmNode = () => {
    const nodeTemplate: NodeMetadata = {
      id: `wasm_${Date.now()}`,
      templateId: `tpl_custom_wasm`,
      type: 'wasm',
      title: scriptName || 'WebAssembly Module',
      subtitle: scriptDescription || 'Custom WebAssembly node',
      icon: scriptIcon,
      variant: 'purple-600' as any, // Purple for WASM
      shape: 'rectangle',
      size: 'medium',
      ports: scriptPorts.map(port => ({
        id: port.id,
        label: port.label,
        type: port.type,
        position: port.type === 'input' ? 'left' : 'right',
      })),
      properties: {
        wasmFile: {
          id: 'wasmFile',
          label: 'WebAssembly File',
          type: 'text' as PropertyType,
          defaultValue: wasmFileName,
        },
      },
      propertyValues: {
        wasmFile: wasmFileName,
        wasmContent: wasmFile ? 'base64_encoded_content_here' : '', // In real app, would encode file content
      },
    }

    onNodeCreated(nodeTemplate)
  }

  const createScriptNode = () => {
    const nodeTemplate: NodeMetadata = {
      id: `script_${Date.now()}`,
      templateId: `tpl_custom_script_${scriptLanguage}`,
      type: 'script',
      title: scriptName || `${scriptLanguage === 'python' ? 'Python' : 'JavaScript'} Script`,
      subtitle: scriptDescription || 'Custom script node',
      icon: scriptIcon,
      variant: scriptLanguage === 'python' ? 'blue-600' : 'yellow-600',
      shape: 'rectangle',
      size: 'medium',
      ports: scriptPorts.map(port => ({
        id: port.id,
        label: port.label,
        type: port.type,
        position: port.type === 'input' ? 'left' : 'right',
      })),
      properties: {
        script: {
          id: 'script',
          label: 'Script Code',
          type: 'code-editor' as PropertyType,
          defaultValue: scriptLanguage === 'python' ? '# Python script\n' : '// JavaScript code\n',
          language: scriptLanguage,
          height: 300,
        },
        ...(scriptLanguage === 'python' && pipRequirements
          ? {
              pipRequirements: {
                id: 'pipRequirements',
                label: 'Pip Requirements',
                type: 'textarea' as PropertyType,
                defaultValue: pipRequirements,
                placeholder: 'numpy\npandas\nrequests',
              },
            }
          : {}),
      },
      propertyValues: {
        script:
          scriptCode ||
          (scriptLanguage === 'python' ? '# Python script\n' : '// JavaScript code\n'),
        ...(scriptLanguage === 'python' && pipRequirements
          ? {
              pipRequirements: pipRequirements,
            }
          : {}),
      },
    }

    onNodeCreated(nodeTemplate)
  }

  const createApiNode = () => {
    // Allow creation with either verb selection or schema upload
    if (!selectedVerb && !selectedCategory && !apiSchemaFile) return

    let inputPorts: any[] = []
    let nodeTitle = apiName || 'API Node'
    let nodeDescription = apiDescription || 'Custom API integration'
    let verbInfo: VerbCategory | undefined
    let verb: VerbSchema | undefined
    let defaultMethod = 'GET'
    let methodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

    if (selectedVerb && selectedCategory) {
      verbInfo =
        apiVerbsSchema.verb_categories[
          selectedCategory as keyof typeof apiVerbsSchema.verb_categories
        ]
      verb = verbInfo.verbs[selectedVerb as keyof typeof verbInfo.verbs]

      // Generate ports based on verb parameters
      inputPorts = verb.parameters.map(param => ({
        id: `input-${param}`,
        label: param.charAt(0).toUpperCase() + param.slice(1).replace(/_/g, ' '),
        type: 'input' as const,
        position: 'left' as const,
      }))

      if (!apiName) {
        nodeTitle = `${selectedVerb.charAt(0).toUpperCase() + selectedVerb.slice(1)} API`
      }
      if (!apiDescription) {
        nodeDescription = verb.description
      }

      defaultMethod = verb.typical_methods[0]
      methodOptions = verb.typical_methods
    } else if (apiSchemaContent) {
      // Generate ports from schema paths if available
      if (apiSchemaContent.paths) {
        // Just create basic input ports for now
        inputPorts = [
          {
            id: 'input-endpoint',
            label: 'Endpoint',
            type: 'input' as const,
            position: 'left' as const,
          },
          {
            id: 'input-params',
            label: 'Parameters',
            type: 'input' as const,
            position: 'left' as const,
          },
          {
            id: 'input-body',
            label: 'Body',
            type: 'input' as const,
            position: 'left' as const,
          },
        ]
      }
    }

    const outputPorts = [
      {
        id: 'response',
        label: 'Response',
        type: 'output' as const,
        position: 'right' as const,
      },
      {
        id: 'error',
        label: 'Error',
        type: 'output' as const,
        position: 'bottom' as const,
      },
    ]

    const nodeTemplate: NodeMetadata = {
      id: `api_${selectedVerb || 'custom'}_${Date.now()}`,
      templateId: `tpl_api_${selectedVerb || 'custom'}`,
      type: 'api',
      title: nodeTitle,
      subtitle: nodeDescription,
      icon: apiIcon,
      variant: 'green-600',
      shape: 'rectangle',
      size: 'medium',
      ports: [...inputPorts, ...outputPorts],
      properties: {
        baseUrl: {
          id: 'baseUrl',
          label: 'Base URL',
          type: 'text' as PropertyType,
          defaultValue: apiBaseUrl,
          required: true,
          placeholder: 'https://api.example.com',
        },
        endpoint: {
          id: 'endpoint',
          label: 'Endpoint',
          type: 'text' as PropertyType,
          defaultValue: '',
          required: true,
          placeholder: '/resource/{id}',
        },
        method: {
          id: 'method',
          label: 'HTTP Method',
          type: 'select' as PropertyType,
          options: methodOptions,
          defaultValue: defaultMethod,
        },
        headers: {
          id: 'headers',
          label: 'Headers',
          type: 'code-editor' as PropertyType,
          language: 'json',
          defaultValue: '{\n  "Content-Type": "application/json"\n}',
          height: 150,
        },
        authentication: {
          id: 'authentication',
          label: 'Authentication',
          type: 'select' as PropertyType,
          options: ['None', 'Bearer Token', 'API Key', 'Basic Auth'],
          defaultValue: 'None',
        },
        ...(apiSchemaFile
          ? {
              schemaFile: {
                id: 'schemaFile',
                label: 'API Schema',
                type: 'text' as PropertyType,
                defaultValue: apiSchemaFileName,
              },
            }
          : {}),
      },
      propertyValues: {
        baseUrl: apiBaseUrl,
        endpoint: '',
        method: defaultMethod,
        headers: '{\n  "Content-Type": "application/json"\n}',
        authentication: 'None',
        ...(apiSchemaFile
          ? {
              schemaFile: apiSchemaFileName,
              schemaContent: apiSchemaContent,
            }
          : {}),
      },
    }

    onNodeCreated(nodeTemplate)
  }

  return (
    <ModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        {/* Backdrop with blur */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm flex justify-center"
          onClick={handleClose}
        >
          <div
            className="relative bg-white rounded-lg shadow-2xl w-full max-w-4xl min-h-fit mt-8 max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingNode ? 'Edit Node' : 'Create New Node'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {editingNode
                    ? 'Modify your custom node configuration'
                    : 'Create custom nodes from scripts or API schemas'}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {!creationType && !editingNode ? (
                // Creation type selection
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setCreationType('script')}
                    className="group p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-all"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                        <FileCode className="w-8 h-8 text-blue-600" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-gray-900">Script Node</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Create from Python or JavaScript code
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setCreationType('api')}
                    className="group p-6 border-2 border-gray-200 rounded-lg hover:border-green-500 transition-all"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-green-100 rounded-full group-hover:bg-green-200 transition-colors">
                        <Network className="w-8 h-8 text-green-600" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-gray-900">API Node</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Create from API schema definitions
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setCreationType('wasm')}
                    className="group p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 transition-all"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-purple-100 rounded-full group-hover:bg-purple-200 transition-colors">
                        <FileUp className="w-8 h-8 text-purple-600" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-gray-900">WebAssembly</h3>
                        <p className="text-sm text-gray-500 mt-1">Deploy a WebAssembly module</p>
                      </div>
                    </div>
                  </button>
                </div>
              ) : creationType === 'script' ? (
                // Script creation form
                <div className="space-y-6">
                  <div className="flex items-center gap-4 mb-6">
                    <button
                      onClick={() => setCreationType(null)}
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      ← Back
                    </button>
                    <h3 className="text-lg font-semibold text-gray-900">Create Script Node</h3>
                  </div>

                  {/* Language Selection and Node Name */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Node Name
                        </label>
                        <input
                          type="text"
                          value={scriptName}
                          onChange={e => setScriptName(e.target.value)}
                          placeholder={`My ${
                            scriptLanguage === 'python' ? 'Python' : 'JavaScript'
                          } Script`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="w-[120px]">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                        <button
                          onClick={() => {
                            setIconSelectorFor('script')
                            setShowIconSelector(true)
                          }}
                          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors w-full h-[42px]"
                        >
                          <Icon
                            name={scriptIcon}
                            source={
                              scriptIcon &&
                              [
                                'python',
                                'javascript',
                                'openai',
                                'aws',
                                'google',
                                'slack',
                                'github',
                                'mongodb',
                                'postgresql',
                                'mysql',
                                'redis',
                              ].includes(scriptIcon)
                                ? 'brand'
                                : 'lucide'
                            }
                            className="w-4 h-4 text-gray-600"
                          />
                          <span className="text-sm">Select</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Script Language
                      </label>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setScriptLanguage('python')
                            setScriptIcon('python')
                            setScriptCode(
                              '# Write your Python code here\n\ndef process(input_data):\n    # Process the input\n    result = input_data\n    return result'
                            )
                          }}
                          className={`px-4 py-2 rounded-md border-2 transition-all ${
                            scriptLanguage === 'python'
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Code className="w-4 h-4 inline mr-2" />
                          Python
                        </button>
                        <button
                          onClick={() => {
                            setScriptLanguage('javascript')
                            setScriptIcon('javascript')
                            setScriptCode(
                              '// Write your JavaScript code here\n\nfunction process(inputData) {\n    // Process the input\n    const result = inputData;\n    return result;\n}'
                            )
                          }}
                          className={`px-4 py-2 rounded-md border-2 transition-all ${
                            scriptLanguage === 'javascript'
                              ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Code className="w-4 h-4 inline mr-2" />
                          JavaScript
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Description - moved above ports */}
                  <div>
                    <button
                      onClick={() => setShowDescription(!showDescription)}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2"
                    >
                      {showDescription ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      Add a description
                    </button>
                    {showDescription && (
                      <textarea
                        value={scriptDescription}
                        onChange={e => setScriptDescription(e.target.value)}
                        placeholder="Describe what this script does..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                      />
                    )}
                  </div>

                  {/* Ports Configuration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Input/Output Ports
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Input Ports */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-blue-700">Input Ports</h4>
                          <button
                            onClick={() => addPort('input')}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <Plus className="w-3 h-3 inline mr-1" />
                            Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {scriptPorts
                            .filter(port => port.type === 'input')
                            .map(port => (
                              <div
                                key={port.id}
                                className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded"
                              >
                                <input
                                  type="text"
                                  value={port.label}
                                  onChange={e => updatePort(port.id, { label: e.target.value })}
                                  placeholder="Port name"
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <select
                                  value={port.dataType}
                                  onChange={e =>
                                    updatePort(port.id, { dataType: e.target.value as any })
                                  }
                                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="any">Any</option>
                                  <option value="string">String</option>
                                  <option value="number">Number</option>
                                  <option value="boolean">Boolean</option>
                                  <option value="object">Object</option>
                                  <option value="array">Array</option>
                                </select>
                                <button
                                  onClick={() => removePort(port.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          {scriptPorts.filter(port => port.type === 'input').length === 0 && (
                            <div className="text-center py-4 text-gray-500 text-xs border-2 border-dashed border-gray-300 rounded">
                              No input ports
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Output Ports */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-green-700">Output Ports</h4>
                          <button
                            onClick={() => addPort('output')}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <Plus className="w-3 h-3 inline mr-1" />
                            Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {scriptPorts
                            .filter(port => port.type === 'output')
                            .map(port => (
                              <div
                                key={port.id}
                                className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded"
                              >
                                <input
                                  type="text"
                                  value={port.label}
                                  onChange={e => updatePort(port.id, { label: e.target.value })}
                                  placeholder="Port name"
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                                <select
                                  value={port.dataType}
                                  onChange={e =>
                                    updatePort(port.id, { dataType: e.target.value as any })
                                  }
                                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                >
                                  <option value="any">Any</option>
                                  <option value="string">String</option>
                                  <option value="number">Number</option>
                                  <option value="boolean">Boolean</option>
                                  <option value="object">Object</option>
                                  <option value="array">Array</option>
                                </select>
                                <button
                                  onClick={() => removePort(port.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          {scriptPorts.filter(port => port.type === 'output').length === 0 && (
                            <div className="text-center py-4 text-gray-500 text-xs border-2 border-dashed border-gray-300 rounded">
                              No output ports
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Pip Requirements - only for Python */}
                  {scriptLanguage === 'python' && (
                    <div>
                      <button
                        onClick={() => setShowPipRequirements(!showPipRequirements)}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2"
                      >
                        {showPipRequirements ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        Add pip requirements
                      </button>
                      {showPipRequirements && (
                        <textarea
                          value={pipRequirements}
                          onChange={e => setPipRequirements(e.target.value)}
                          placeholder="Enter pip requirements, one per line..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 font-mono text-sm"
                        />
                      )}
                    </div>
                  )}

                  {/* Script Code Editor */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Script Code
                    </label>
                    <div className="border border-gray-300 rounded-md overflow-hidden">
                      <CodeEditor
                        key={scriptLanguage} // Force re-mount when language changes
                        value={scriptCode}
                        onChange={setScriptCode}
                        language={scriptLanguage}
                        height={300}
                        placeholder={
                          scriptLanguage === 'python'
                            ? '# Write your Python code here\n\ndef process(input_data):\n    # Process the input\n    result = input_data\n    return result'
                            : '// Write your JavaScript code here\n\nfunction process(inputData) {\n    // Process the input\n    const result = inputData;\n    return result;\n}'
                        }
                        lineNumbers={true}
                        minimap={false}
                      />
                    </div>
                  </div>
                </div>
              ) : creationType === 'api' ? (
                // API creation form
                <div className="space-y-6">
                  <div className="flex items-center gap-4 mb-6">
                    <button
                      onClick={() => setCreationType(null)}
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      ← Back
                    </button>
                    <h3 className="text-lg font-semibold text-gray-900">Create API Node</h3>
                  </div>

                  {/* API Details */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Name
                      </label>
                      <input
                        type="text"
                        value={apiName}
                        onChange={e => setApiName(e.target.value)}
                        placeholder="My API Integration"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="w-[120px]">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                      <button
                        onClick={() => {
                          setIconSelectorFor('api')
                          setShowIconSelector(true)
                        }}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors w-full h-[42px]"
                      >
                        <Icon
                          name={apiIcon}
                          source={
                            apiIcon &&
                            [
                              'python',
                              'javascript',
                              'openai',
                              'aws',
                              'google',
                              'slack',
                              'github',
                              'mongodb',
                              'postgresql',
                              'mysql',
                              'redis',
                            ].includes(apiIcon)
                              ? 'brand'
                              : 'lucide'
                          }
                          className="w-4 h-4 text-gray-600"
                        />
                        <span className="text-sm">Select</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Base URL</label>
                    <input
                      type="text"
                      value={apiBaseUrl}
                      onChange={e => setApiBaseUrl(e.target.value)}
                      placeholder="https://api.example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Collapsible Description */}
                  <div>
                    <button
                      onClick={() => setShowApiDescription(!showApiDescription)}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2"
                    >
                      {showApiDescription ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      Add a description
                    </button>
                    {showApiDescription && (
                      <textarea
                        value={apiDescription}
                        onChange={e => setApiDescription(e.target.value)}
                        placeholder="Describe what this API does..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>

                  {/* API Schema Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Schema (Optional)
                    </label>
                    <div
                      onDrop={handleApiSchemaDrop}
                      onDragOver={handleApiSchemaDragOver}
                      onDragLeave={handleApiSchemaDragLeave}
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                        isApiDragging
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {apiSchemaFile ? (
                        <div className="space-y-2">
                          <FileUp className="w-10 h-10 mx-auto text-green-600" />
                          <p className="text-sm font-medium text-gray-900">{apiSchemaFileName}</p>
                          <button
                            onClick={() => {
                              setApiSchemaFile(null)
                              setApiSchemaFileName('')
                              setApiSchemaContent(null)
                            }}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Remove file
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-10 h-10 mx-auto text-gray-400" />
                          <p className="text-sm font-medium text-gray-900">
                            Drop your OpenAPI/Swagger schema here
                          </p>
                          <p className="text-xs text-gray-500">JSON or YAML format</p>
                          <label className="inline-block">
                            <input
                              type="file"
                              accept=".json,.yaml,.yml"
                              onChange={e => {
                                const file = e.target.files?.[0]
                                if (file) handleApiSchemaUpload(file)
                              }}
                              className="hidden"
                            />
                            <span className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 cursor-pointer transition-colors">
                              Browse Files
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">
                        Or select from predefined operations
                      </span>
                    </div>
                  </div>

                  {/* Verb Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Select API Operation
                    </label>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {Object.entries(apiVerbsSchema.verb_categories).map(
                        ([categoryKey, category]) => (
                          <div key={categoryKey} className="border-b border-gray-200 last:border-0">
                            <button
                              onClick={() => toggleCategory(categoryKey)}
                              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                {expandedCategories.has(categoryKey) ? (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                                <div className="text-left">
                                  <div className="font-medium text-gray-900 capitalize">
                                    {categoryKey.replace(/_/g, ' ')}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {category.description}
                                  </div>
                                </div>
                              </div>
                            </button>

                            {expandedCategories.has(categoryKey) && (
                              <div className="px-4 pb-4">
                                <div className="grid grid-cols-2 gap-2">
                                  {Object.entries(category.verbs).map(([verbKey, verb]) => (
                                    <button
                                      key={verbKey}
                                      onClick={() => {
                                        setSelectedVerb(verbKey)
                                        setSelectedCategory(categoryKey)
                                      }}
                                      className={`p-3 text-left rounded-md border-2 transition-all ${
                                        selectedVerb === verbKey && selectedCategory === categoryKey
                                          ? 'border-green-500 bg-green-50'
                                          : 'border-gray-200 hover:border-gray-300'
                                      }`}
                                    >
                                      <div className="font-medium text-gray-900 capitalize">
                                        {verbKey.replace(/_/g, ' ')}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {verb.description}
                                      </div>
                                      <div className="text-xs text-gray-400 mt-2">
                                        Methods: {verb.typical_methods.join(', ')}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ) : creationType === 'wasm' ? (
                // WASM creation form
                <div className="space-y-6">
                  <div className="flex items-center gap-4 mb-6">
                    <button
                      onClick={() => setCreationType(null)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Deploy WebAssembly Module
                    </h3>
                  </div>

                  {/* Language Selection and Node Name */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Node Name
                        </label>
                        <input
                          type="text"
                          value={scriptName}
                          onChange={e => setScriptName(e.target.value)}
                          placeholder="My WebAssembly Module"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="w-[120px]">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                        <button
                          onClick={() => {
                            setIconSelectorFor('script')
                            setShowIconSelector(true)
                          }}
                          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors w-full h-[42px]"
                        >
                          <Icon
                            name={scriptIcon}
                            source={
                              scriptIcon &&
                              [
                                'python',
                                'javascript',
                                'openai',
                                'aws',
                                'google',
                                'slack',
                                'github',
                                'mongodb',
                                'postgresql',
                                'mysql',
                                'redis',
                              ].includes(scriptIcon)
                                ? 'brand'
                                : 'lucide'
                            }
                            className="w-4 h-4 text-gray-600"
                          />
                          <span className="text-sm">Select</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Description */}
                  <div>
                    <button
                      onClick={() => setShowDescription(!showDescription)}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2"
                    >
                      {showDescription ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      Add a description
                    </button>
                    {showDescription && (
                      <textarea
                        value={scriptDescription}
                        onChange={e => setScriptDescription(e.target.value)}
                        placeholder="Describe what this WebAssembly module does..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                      />
                    )}
                  </div>

                  {/* Ports Configuration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Input/Output Ports
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Input Ports */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-blue-700">Input Ports</h4>
                          <button
                            onClick={() => addPort('input')}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <Plus className="w-3 h-3 inline mr-1" />
                            Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {scriptPorts
                            .filter(port => port.type === 'input')
                            .map(port => (
                              <div
                                key={port.id}
                                className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded"
                              >
                                <input
                                  type="text"
                                  value={port.label}
                                  onChange={e => updatePort(port.id, { label: e.target.value })}
                                  placeholder="Port name"
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <select
                                  value={port.dataType}
                                  onChange={e =>
                                    updatePort(port.id, { dataType: e.target.value as any })
                                  }
                                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="any">Any</option>
                                  <option value="string">String</option>
                                  <option value="number">Number</option>
                                  <option value="boolean">Boolean</option>
                                  <option value="object">Object</option>
                                  <option value="array">Array</option>
                                </select>
                                <button
                                  onClick={() => removePort(port.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          {scriptPorts.filter(port => port.type === 'input').length === 0 && (
                            <div className="text-center py-4 text-gray-500 text-xs border-2 border-dashed border-gray-300 rounded">
                              No input ports
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Output Ports */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-green-700">Output Ports</h4>
                          <button
                            onClick={() => addPort('output')}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <Plus className="w-3 h-3 inline mr-1" />
                            Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {scriptPorts
                            .filter(port => port.type === 'output')
                            .map(port => (
                              <div
                                key={port.id}
                                className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded"
                              >
                                <input
                                  type="text"
                                  value={port.label}
                                  onChange={e => updatePort(port.id, { label: e.target.value })}
                                  placeholder="Port name"
                                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                                <select
                                  value={port.dataType}
                                  onChange={e =>
                                    updatePort(port.id, { dataType: e.target.value as any })
                                  }
                                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                >
                                  <option value="any">Any</option>
                                  <option value="string">String</option>
                                  <option value="number">Number</option>
                                  <option value="boolean">Boolean</option>
                                  <option value="object">Object</option>
                                  <option value="array">Array</option>
                                </select>
                                <button
                                  onClick={() => removePort(port.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          {scriptPorts.filter(port => port.type === 'output').length === 0 && (
                            <div className="text-center py-4 text-gray-500 text-xs border-2 border-dashed border-gray-300 rounded">
                              No output ports
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* WASM File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      WebAssembly File
                    </label>
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        isDragging
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {wasmFile ? (
                        <div className="space-y-2">
                          <FileUp className="w-12 h-12 mx-auto text-purple-600" />
                          <p className="text-sm font-medium text-gray-900">{wasmFileName}</p>
                          <button
                            onClick={() => {
                              setWasmFile(null)
                              setWasmFileName('')
                            }}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Remove file
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-12 h-12 mx-auto text-gray-400" />
                          <p className="text-sm font-medium text-gray-900">
                            Drop your .wasm file here
                          </p>
                          <p className="text-xs text-gray-500">or</p>
                          <label className="inline-block">
                            <input
                              type="file"
                              accept=".wasm"
                              onChange={e => {
                                const file = e.target.files?.[0]
                                if (file) handleFileUpload(file)
                              }}
                              className="hidden"
                            />
                            <span className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 cursor-pointer transition-colors">
                              Browse Files
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            {creationType && (
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={
                    creationType === 'script'
                      ? createScriptNode
                      : creationType === 'api'
                        ? createApiNode
                        : createWasmNode
                  }
                  disabled={
                    creationType === 'script'
                      ? !scriptName.trim()
                      : creationType === 'api'
                        ? !apiName.trim() || (!selectedVerb && !apiSchemaFile)
                        : !scriptName.trim() || !wasmFile
                  }
                  className={`px-6 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                    (
                      creationType === 'script'
                        ? !scriptName.trim()
                        : creationType === 'api'
                          ? !apiName.trim() || (!selectedVerb && !apiSchemaFile)
                          : !scriptName.trim() || !wasmFile
                    )
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {editingNode ? 'Update Node' : 'Create Node'}
                </button>
              </div>
            )}

            {/* Icon Selector Modal */}
            {showIconSelector && (
              <div className="absolute inset-0 z-[70] flex items-center justify-center p-4">
                <div
                  className="absolute inset-0 bg-black/30 flex justify-center items-center"
                  onClick={() => setShowIconSelector(false)}
                >
                  <div
                    className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[60vh] overflow-hidden flex flex-col"
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Select Icon</h3>
                      <button
                        onClick={() => setShowIconSelector(false)}
                        className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>

                    {/* Search */}
                    <div className="p-4 border-b border-gray-200">
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search icons..."
                          value={iconSearchQuery}
                          onChange={e => setIconSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>

                      {/* Quick Suggestions */}
                      {!iconSearchQuery && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Popular choices:</p>
                          <div className="flex flex-wrap gap-2">
                            {(iconSelectorFor === 'script'
                              ? [
                                  'code',
                                  'terminal',
                                  'file-code',
                                  'braces',
                                  'function-square',
                                  'git-branch',
                                  'code-2',
                                  'file-json',
                                ]
                              : [
                                  'globe',
                                  'cloud',
                                  'server',
                                  'database',
                                  'webhook',
                                  'network',
                                  'plug',
                                  'zap',
                                ]
                            ).map(suggestion => (
                              <button
                                key={suggestion}
                                onClick={() => {
                                  if (iconSelectorFor === 'script') {
                                    setScriptIcon(suggestion)
                                  } else {
                                    setApiIcon(suggestion)
                                  }
                                  setShowIconSelector(false)
                                }}
                                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Icon Tabs */}
                    <div className="flex border-b border-gray-200">
                      <button
                        onClick={() => setActiveIconTab('lucide')}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                          activeIconTab === 'lucide'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        General Icons
                      </button>
                      <button
                        onClick={() => setActiveIconTab('brands')}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                          activeIconTab === 'brands'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Brand Icons
                      </button>
                    </div>

                    {/* Icon Grid */}
                    <div className="flex-1 overflow-y-auto">
                      {activeIconTab === 'lucide' ? (
                        <div className="p-4">
                          {(() => {
                            let icons: string[] = []
                            try {
                              icons = iconLibrary.searchIcons(iconSearchQuery, 'lucide', 200)
                            } catch (error) {
                              console.error('Error searching icons:', error)
                            }

                            if (icons.length === 0) {
                              return (
                                <div className="text-center py-8 text-gray-500">
                                  <p>No icons available. Check console for errors.</p>
                                </div>
                              )
                            }

                            return (
                              <div className="grid grid-cols-6 gap-2">
                                {icons.map(iconName => (
                                  <button
                                    key={iconName}
                                    onClick={() => {
                                      if (iconSelectorFor === 'script') {
                                        setScriptIcon(iconName)
                                      } else {
                                        setApiIcon(iconName)
                                      }
                                      setShowIconSelector(false)
                                      setIconSearchQuery('')
                                    }}
                                    className={`p-3 rounded-md border-2 transition-all hover:bg-gray-50 flex items-center justify-center ${
                                      (iconSelectorFor === 'script' ? scriptIcon : apiIcon) ===
                                      iconName
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200'
                                    }`}
                                    title={iconName}
                                  >
                                    <Icon
                                      name={iconName}
                                      source="lucide"
                                      className="w-5 h-5 text-gray-600 mx-auto"
                                    />
                                  </button>
                                ))}
                              </div>
                            )
                          })()}
                        </div>
                      ) : (
                        <div className="flex-1">
                          {/* Brand Categories */}
                          <div className="space-y-4 p-4">
                            {Object.entries(BrandIcons).map(([category, icons]) => {
                              const categoryIcons = Object.keys(icons).filter(
                                name =>
                                  !iconSearchQuery ||
                                  name.toLowerCase().includes(iconSearchQuery.toLowerCase())
                              )

                              if (categoryIcons.length === 0) return null

                              return (
                                <div key={category}>
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                    {category.charAt(0).toUpperCase() + category.slice(1)}
                                  </h4>
                                  <div className="grid grid-cols-6 gap-2">
                                    {categoryIcons.map(iconName => (
                                      <button
                                        key={iconName}
                                        onClick={() => {
                                          if (iconSelectorFor === 'script') {
                                            setScriptIcon(iconName)
                                          } else {
                                            setApiIcon(iconName)
                                          }
                                          setShowIconSelector(false)
                                          setIconSearchQuery('')
                                        }}
                                        className={`p-3 rounded-md border-2 transition-all hover:bg-gray-50 flex items-center justify-center ${
                                          (iconSelectorFor === 'script' ? scriptIcon : apiIcon) ===
                                          iconName
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200'
                                        }`}
                                        title={iconName}
                                      >
                                        <Icon
                                          name={iconName}
                                          source="brand"
                                          className="w-5 h-5 text-gray-600"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
