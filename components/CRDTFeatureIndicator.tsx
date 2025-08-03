'use client'

import React, { useState } from 'react'
import { Info, Check, X, AlertCircle } from 'lucide-react'

interface CRDTFeatureIndicatorProps {
  isCollaborative: boolean
}

export function CRDTFeatureIndicator({ isCollaborative }: CRDTFeatureIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (!isCollaborative) return null
  
  const features = [
    { name: 'Nodes', status: 'enabled', items: [
      { name: 'Add/Delete nodes', enabled: true },
      { name: 'Move nodes', enabled: true },
      { name: 'Update properties', enabled: true },
      { name: 'Node metadata sync', enabled: true },
    ]},
    { name: 'Connections', status: 'enabled', items: [
      { name: 'Add/Delete connections', enabled: true },
      { name: 'Connection metadata', enabled: true },
      { name: 'Connection states', enabled: true },
    ]},
    { name: 'Groups', status: 'enabled', items: [
      { name: 'Create/Delete groups', enabled: true },
      { name: 'Move/Resize groups', enabled: true },
      { name: 'Group membership', enabled: true },
      { name: 'Group properties', enabled: true },
      { name: 'Collapse state (local)', enabled: false },
    ]},
    { name: 'Canvas', status: 'partial', items: [
      { name: 'Canvas state', enabled: true },
      { name: 'Zoom/Pan position', enabled: true },
      { name: 'Selection state', enabled: false },
    ]},
    { name: 'Graphs', status: 'enabled', items: [
      { name: 'Multiple graphs', enabled: true },
      { name: 'Graph switching', enabled: true },
      { name: 'Subgraph sync', enabled: true },
    ]},
    { name: 'Presence', status: 'enabled', items: [
      { name: 'User cursors', enabled: true },
      { name: 'Active user list', enabled: true },
      { name: 'User colors', enabled: true },
      { name: 'Last seen status', enabled: true },
    ]},
    { name: 'Advanced', status: 'partial', items: [
      { name: 'Conflict resolution', enabled: true },
      { name: 'Offline support', enabled: true },
      { name: 'History/Undo', enabled: false },
      { name: 'Branching/Merging', enabled: false },
    ]},
  ]
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 p-2 bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow"
        title="CRDT Feature Status"
      >
        <Info className="w-5 h-5 text-blue-600" />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-50"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed bottom-16 left-4 w-80 max-h-[70vh] bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">CRDT Feature Status</h3>
              <p className="text-sm text-gray-600 mt-1">Real-time sync capabilities</p>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[calc(70vh-100px)]">
              <div className="space-y-4">
                {features.map((feature) => (
                  <div key={feature.name} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{feature.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        feature.status === 'enabled' 
                          ? 'bg-green-100 text-green-700'
                          : feature.status === 'partial'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {feature.status}
                      </span>
                    </div>
                    <div className="ml-4 space-y-1">
                      {feature.items.map((item) => (
                        <div key={item.name} className="flex items-center gap-2 text-sm">
                          {item.enabled ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <X className="w-4 h-4 text-gray-400" />
                          )}
                          <span className={item.enabled ? 'text-gray-700' : 'text-gray-500'}>
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">How to test:</p>
                    <ul className="mt-1 space-y-1 list-disc list-inside">
                      <li>Open this workflow in two windows</li>
                      <li>Enable collaborative mode in both</li>
                      <li>Try features marked with ✓</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}