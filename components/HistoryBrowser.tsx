'use client'

import { useState, useEffect } from 'react'
import { Clock, FileText, GitBranch, ChevronRight, Trash2, Download, Upload, Calendar, Save, RotateCcw, ArrowLeft, ListRestart } from 'lucide-react'
import { WorkflowStorageService } from '@/services/workflowStorage'
import type { WorkflowSnapshot } from '@/types/snapshot'
import { formatDistanceToNow } from '@/utils/dateUtils'
import { useWorkflowStore } from '@/store/workflowStore'

interface HistoryBrowserProps {
  isOpen: boolean
  onClose: () => void
  onSelectWorkflow: (workflowId: string) => void
  onViewFlowTrace?: (workflowId: string) => void
  currentWorkflowId?: string | null
}

export function HistoryBrowser({ isOpen, onClose, onSelectWorkflow, onViewFlowTrace, currentWorkflowId }: HistoryBrowserProps) {
  const [workflows, setWorkflows] = useState<WorkflowSnapshot[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDraft, setFilterDraft] = useState(true)
  const [filterPublished, setFilterPublished] = useState(true)
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowSnapshot | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versionHistory, setVersionHistory] = useState<WorkflowSnapshot[]>([])
  
  const { rollbackToVersion } = useWorkflowStore()

  useEffect(() => {
    if (isOpen) {
      loadWorkflows()
    }
  }, [isOpen])

  const loadWorkflows = () => {
    const allWorkflows = WorkflowStorageService.getAllWorkflows()
    
    // Group workflows by ID to show only the latest version of each
    const workflowMap = new Map<string, WorkflowSnapshot>()
    
    allWorkflows.forEach(workflow => {
      const existing = workflowMap.get(workflow.id)
      if (!existing || new Date(workflow.updatedAt) > new Date(existing.updatedAt)) {
        workflowMap.set(workflow.id, workflow)
      }
    })
    
    const uniqueWorkflows = Array.from(workflowMap.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    
    setWorkflows(uniqueWorkflows)
  }
  
  const loadVersionHistory = (workflowId: string) => {
    const versions = WorkflowStorageService.getWorkflowVersions(workflowId)
    setVersionHistory(versions)
    setShowVersionHistory(true)
  }
  
  const handleRollback = (version: WorkflowSnapshot) => {
    if (confirm(`Rollback to version published on ${new Date(version.publishedAt!).toLocaleString()}?`)) {
      rollbackToVersion(version.updatedAt)
      onClose()
    }
  }

  const filteredWorkflows = workflows.filter(workflow => {
    // Filter by search query
    if (searchQuery && !workflow.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    
    // Filter by draft/published status
    if (!filterDraft && workflow.isDraft && !workflow.isPublished) return false
    if (!filterPublished && workflow.isPublished) return false
    
    return true
  })

  const handleDelete = (workflowId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this workflow?')) {
      WorkflowStorageService.deleteWorkflow(workflowId)
      loadWorkflows()
      if (selectedWorkflow?.id === workflowId) {
        setSelectedWorkflow(null)
      }
    }
  }

  const handleExport = (workflowId: string, workflowName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const json = WorkflowStorageService.exportWorkflow(workflowId)
    if (json) {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${workflowName.replace(/[^a-z0-9]/gi, '_')}_workflow.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 top-[60px] z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl w-[900px] h-[600px] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-medium text-gray-900">Workflow History</h2>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Workflow
            </button>
          </div>
          
          {/* Search and filters */}
          <div className="mt-4 flex items-center gap-4">
            <input
              type="text"
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={filterDraft}
                  onChange={(e) => setFilterDraft(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Drafts
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={filterPublished}
                  onChange={(e) => setFilterPublished(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Published
              </label>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Workflow list */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
            {filteredWorkflows.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No workflows found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredWorkflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedWorkflow?.id === workflow.id ? 'bg-gray-50' : ''
                    } ${workflow.id === currentWorkflowId ? 'border-l-4 border-black' : ''}`}
                    onClick={() => setSelectedWorkflow(workflow)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {workflow.name}
                          </h3>
                          {workflow.id === currentWorkflowId && (
                            <span className="text-xs bg-black text-white px-2 py-0.5 rounded">Current</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            workflow.isPublished 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {workflow.isPublished ? 'Published' : 'Draft'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {workflow.metadata?.nodeCount || 0} nodes • {workflow.metadata?.connectionCount || 0} connections
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Save className="w-3 h-3" />
                          <span>Saved {formatTimestamp(workflow.lastSavedAt)}</span>
                          <span className="text-gray-400">•</span>
                          <span>{workflow.saveCount} saves</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={(e) => handleExport(workflow.id, workflow.name, e)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                          title="Export"
                        >
                          <Download className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(workflow.id, e)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                          title="Delete"
                          disabled={workflow.id === currentWorkflowId}
                        >
                          <Trash2 className={`w-4 h-4 ${
                            workflow.id === currentWorkflowId ? 'text-gray-300' : 'text-red-500'
                          }`} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Workflow details */}
          <div className="w-1/2 p-6 overflow-y-auto">
            {selectedWorkflow ? (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">{selectedWorkflow.name}</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Details</h4>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Status</dt>
                        <dd className={`font-medium ${
                          selectedWorkflow.isPublished ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {selectedWorkflow.isPublished ? 'Published' : 'Draft'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Created</dt>
                        <dd className="text-gray-900">{new Date(selectedWorkflow.createdAt).toLocaleString()}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Last saved</dt>
                        <dd className="text-gray-900">{new Date(selectedWorkflow.lastSavedAt).toLocaleString()}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Save count</dt>
                        <dd className="text-gray-900">{selectedWorkflow.saveCount}</dd>
                      </div>
                      {selectedWorkflow.publishedAt && (
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Published</dt>
                          <dd className="text-gray-900">{new Date(selectedWorkflow.publishedAt).toLocaleString()}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Statistics</h4>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Nodes</dt>
                        <dd className="text-gray-900">{selectedWorkflow.metadata?.nodeCount || 0}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Connections</dt>
                        <dd className="text-gray-900">{selectedWorkflow.metadata?.connectionCount || 0}</dd>
                      </div>
                    </dl>
                  </div>

                  {selectedWorkflow.description && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                      <p className="text-sm text-gray-600">{selectedWorkflow.description}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200 space-y-3">
                    {/* Flow Trace Button */}
                    {onViewFlowTrace && (
                      <button
                        onClick={() => {
                          onViewFlowTrace(selectedWorkflow.id)
                          onClose()
                        }}
                        className="w-full px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <ListRestart className="w-4 h-4" />
                        View Flow Traces
                      </button>
                    )}
                    
                    {/* Version History Button */}
                    {selectedWorkflow.id === currentWorkflowId && (
                      <button
                        onClick={() => loadVersionHistory(selectedWorkflow.id)}
                        className="w-full px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <GitBranch className="w-4 h-4" />
                        View Version History
                      </button>
                    )}
                    
                    {selectedWorkflow.id === currentWorkflowId ? (
                      <p className="text-sm text-gray-500 italic">This is the current workflow</p>
                    ) : (
                      <button
                        onClick={() => {
                          onSelectWorkflow(selectedWorkflow.id)
                          onClose()
                        }}
                        className="w-full px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                      >
                        Load Workflow
                      </button>
                    )}
                  </div>
                  
                  {/* Version History Panel */}
                  {showVersionHistory && versionHistory.length > 0 && selectedWorkflow.id === versionHistory[0].id && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium text-gray-700">Version History</h4>
                        <button
                          onClick={() => setShowVersionHistory(false)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Close
                        </button>
                      </div>
                      
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {versionHistory.map((version, index) => {
                          // A version is current if it's the latest draft
                          const isCurrentVersion = !version.isPublished && version.isDraft && index === 0
                          
                          return (
                            <div
                              key={`${version.id}-${version.updatedAt}`}
                              className={`p-3 rounded-md border ${
                                isCurrentVersion ? 'border-black bg-gray-50' : 'border-gray-200'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      version.isPublished 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {version.isPublished ? 'Published' : 'Draft'}
                                    </span>
                                    {isCurrentVersion && (
                                      <span className="text-xs text-gray-500">(Current)</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">
                                    {new Date(version.updatedAt).toLocaleString()}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {version.saveCount} saves • {version.metadata?.nodeCount || 0} nodes
                                  </p>
                                </div>
                                
                                {version.isPublished && (
                                  <button
                                    onClick={() => handleRollback(version)}
                                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                    title="Rollback to this version"
                                  >
                                    <RotateCcw className="w-4 h-4 text-gray-600" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-sm">Select a workflow to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}