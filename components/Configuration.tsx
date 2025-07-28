'use client'

import React, { useState, useEffect } from 'react'
import { Settings, ArrowLeft, Plus, Eye, EyeOff, Trash2, Edit3, Key, Globe, AlertTriangle } from 'lucide-react'
import { EnvVarService, type EnvironmentVariable, type ConfigSection } from '@/services/envVarService'

interface ConfigurationProps {
  isOpen: boolean
  onClose: () => void
  onVariableConfigured?: () => void
}

export function Configuration({ isOpen, onClose, onVariableConfigured }: ConfigurationProps) {
  const [activeSection, setActiveSection] = useState<string>('environment')
  const [editingVar, setEditingVar] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [newVar, setNewVar] = useState({ key: '', value: '', isSecret: false })
  const [configSections, setConfigSections] = useState<ConfigSection[]>([])

  // Load config sections from service
  useEffect(() => {
    if (isOpen) {
      EnvVarService.getConfigSections()
        .then(sections => setConfigSections(sections))
        .catch(error => {
          console.error('Failed to load configuration sections:', error)
          setConfigSections([]) // Set empty array on error
        })
    }
  }, [isOpen])


  const addVariable = async (sectionId: string) => {
    if (!newVar.key.trim()) return
    
    // Validate environment variable key format
    if (!/^[A-Z][A-Z0-9_]*$/.test(newVar.key)) {
      alert('Environment variable key must start with uppercase letter and contain only uppercase letters, numbers, and underscores')
      return
    }
    
    // If we're in the secrets section, force isSecret to true
    const isSecret = sectionId === 'secrets' || newVar.isSecret
    
    // Create the new variable
    const newVariable: EnvironmentVariable = {
      id: Date.now().toString(),
      key: newVar.key,
      value: isSecret ? '••••••••' : newVar.value, // Mask secrets immediately
      isSecret: isSecret
    }
    
    // Add to the appropriate section
    const updatedSections = configSections.map(section => {
      // For secrets, always add to the secrets section
      if (isSecret && section.id === 'secrets') {
        return { ...section, variables: [...section.variables, newVariable] }
      }
      // For non-secrets, add to the specified section (usually environment)
      if (!isSecret && section.id === sectionId) {
        return { ...section, variables: [...section.variables, newVariable] }
      }
      return section
    })
    
    setConfigSections(updatedSections)
    
    // If we added a secret, switch to the secrets section
    if (isSecret && activeSection !== 'secrets') {
      setActiveSection('secrets')
    }
    
    try {
      // Send to API (even though backend doesn't persist yet, we follow the pattern)
      if (isSecret) {
        // For secrets, send the actual value to API
        await EnvVarService.saveSecret({
          key: newVar.key,
          value: newVar.value, // Send actual value to API
          isSecret: true
        })
      } else {
        // For non-secrets, save normally
        await EnvVarService.saveConfigSections(updatedSections)
      }
      
      setNewVar({ key: '', value: '', isSecret: false })
      
      // Notify parent that a variable was configured
      if (onVariableConfigured) {
        onVariableConfigured()
      }
    } catch (error) {
      console.error('Failed to save variable:', error)
      // Don't revert on error since backend doesn't persist anyway
      // Just log the error
    }
  }

  const deleteVariable = async (sectionId: string, varId: string) => {
    const updatedSections = configSections.map(section => 
      section.id === sectionId 
        ? { ...section, variables: section.variables.filter(v => v.id !== varId) }
        : section
    )
    
    const originalSections = configSections
    setConfigSections(updatedSections)
    
    try {
      await EnvVarService.saveConfigSections(updatedSections)
      
      // Notify parent that a variable was configured (removed)
      if (onVariableConfigured) {
        onVariableConfigured()
      }
    } catch (error) {
      console.error('Failed to delete variable:', error)
      // Revert the optimistic update
      setConfigSections(originalSections)
    }
  }

  const updateVariable = async (sectionId: string, varId: string, updates: Partial<EnvironmentVariable>) => {
    const updatedSections = configSections.map(section => 
      section.id === sectionId 
        ? { 
            ...section, 
            variables: section.variables.map(v => 
              v.id === varId ? { ...v, ...updates, needsAttention: false } : v
            ) 
          }
        : section
    )
    
    const originalSections = configSections
    setConfigSections(updatedSections)
    
    try {
      await EnvVarService.saveConfigSections(updatedSections)
      
      // Notify parent that a variable was configured
      if (onVariableConfigured) {
        onVariableConfigured()
      }
    } catch (error) {
      console.error('Failed to update variable:', error)
      // Revert the optimistic update
      setConfigSections(originalSections)
    }
  }

  const renderVariable = (variable: EnvironmentVariable, sectionId: string) => {
    // Secrets are always masked
    const displayValue = variable.isSecret 
      ? '••••••••' 
      : variable.value
    const needsAttention = variable.needsAttention || (!variable.value && variable.addedAutomatically)

    return (
      <div key={variable.id} className={`flex items-center gap-3 p-3 rounded-md ${
        needsAttention ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
      }`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {needsAttention && <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />}
          {variable.isSecret && <Key className="w-4 h-4 text-gray-500 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-medium text-sm text-gray-900">{variable.key}</div>
              {variable.addedAutomatically && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Auto-added</span>
              )}
              {needsAttention && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Needs value</span>
              )}
            </div>
            <div className={`text-sm font-mono truncate ${
              !variable.value ? 'text-gray-400 italic' : 'text-gray-600'
            }`}>
              {variable.value ? displayValue : 'No value set'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Only show edit button for non-secrets */}
          {!variable.isSecret && editingVar === variable.id ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                className="w-24 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateVariable(sectionId, variable.id, { value: editingValue })
                    setEditingVar(null)
                    setEditingValue('')
                  } else if (e.key === 'Escape') {
                    setEditingVar(null)
                    setEditingValue('')
                  }
                }}
              />
              <button
                onClick={() => {
                  updateVariable(sectionId, variable.id, { value: editingValue })
                  setEditingVar(null)
                  setEditingValue('')
                }}
                className="p-1 hover:bg-green-100 rounded transition-colors"
                title="Save"
              >
                <Edit3 className="w-4 h-4 text-green-600" />
              </button>
            </div>
          ) : !variable.isSecret ? (
            <button
              onClick={() => {
                setEditingVar(variable.id)
                setEditingValue(variable.value)
              }}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="Edit"
            >
              <Edit3 className="w-4 h-4 text-gray-500" />
            </button>
          ) : (
            // Secrets show a disabled edit button
            <button
              disabled
              className="p-1 opacity-30 cursor-not-allowed"
              title="Secrets cannot be edited"
            >
              <Edit3 className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <button
            onClick={() => deleteVariable(sectionId, variable.id)}
            className="p-1 hover:bg-red-100 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  const currentSection = configSections.find(s => s.id === activeSection)

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
              <Settings className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-medium text-gray-900">Configuration</h2>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Workflow
            </button>
          </div>
          
          <p className="mt-2 text-sm text-gray-600">
            Manage environment variables, secrets, and configuration settings for your workflows
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-200 bg-gray-50">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Settings</h3>
              <nav className="space-y-1">
                {configSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                      activeSection === section.id
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:bg-white hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {section.id === 'environment' ? (
                        <Globe className="w-4 h-4" />
                      ) : (
                        <Key className="w-4 h-4" />
                      )}
                      {section.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {section.variables.length} variables
                    </div>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            {currentSection && (
              <div className="p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900">{currentSection.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{currentSection.description}</p>
                </div>

                {/* Add New Variable */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Add New Variable</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Variable name (e.g., API_KEY)"
                      value={newVar.key}
                      onChange={(e) => setNewVar(prev => ({ ...prev, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                      className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <input
                      type={(activeSection === 'secrets' || newVar.isSecret) ? "password" : "text"}
                      placeholder="Variable value"
                      value={newVar.value}
                      onChange={(e) => setNewVar(prev => ({ ...prev, value: e.target.value }))}
                      className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={activeSection === 'secrets' || newVar.isSecret}
                        onChange={(e) => setNewVar(prev => ({ ...prev, isSecret: e.target.checked }))}
                        className="rounded border-gray-300"
                        disabled={activeSection === 'secrets'}
                      />
                      Mark as secret
                      {activeSection === 'secrets' && <span className="text-xs text-gray-500">(auto-enabled in Secrets section)</span>}
                    </label>
                    <button
                      onClick={() => addVariable(currentSection.id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Variable
                    </button>
                  </div>
                </div>

                {/* Variables List */}
                <div className="space-y-3">
                  {currentSection.variables.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm">No variables configured</p>
                      <p className="text-xs mt-1">Add your first variable above</p>
                    </div>
                  ) : (
                    currentSection.variables.map((variable) => 
                      renderVariable(variable, currentSection.id)
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}