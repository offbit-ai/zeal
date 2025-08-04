'use client'

import React, { useState } from 'react'
import { X, Trash2, AlertTriangle } from 'lucide-react'

interface GroupDeleteModalProps {
  isOpen: boolean
  groupId: string
  groupTitle: string
  nodeCount: number
  onConfirm: (groupId: string, preserveNodes: boolean) => void
  onCancel: () => void
}

export function GroupDeleteModal({
  isOpen,
  groupId,
  groupTitle,
  nodeCount,
  onConfirm,
  onCancel,
}: GroupDeleteModalProps) {
  const [preserveNodes, setPreserveNodes] = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConfirm(groupId, preserveNodes)
  }

  const handleCancel = () => {
    onCancel()
    setPreserveNodes(true) // Reset to default
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Delete Group</h2>
              <p className="text-sm text-gray-500">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-700 mb-2">
              You are about to delete the group <strong>"{groupTitle}"</strong> which contains{' '}
              <strong>{nodeCount}</strong> node{nodeCount !== 1 ? 's' : ''}.
            </p>

            {nodeCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  What should happen to the nodes in this group?
                </div>
              </div>
            )}
          </div>

          {nodeCount > 0 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="nodeAction"
                    value="preserve"
                    checked={preserveNodes}
                    onChange={() => setPreserveNodes(true)}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Preserve nodes</div>
                    <div className="text-sm text-gray-500">
                      Keep the nodes but remove them from the group
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="nodeAction"
                    value="delete"
                    checked={!preserveNodes}
                    onChange={() => setPreserveNodes(false)}
                    className="mt-1 w-4 h-4 text-red-600 focus:ring-2 focus:ring-red-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Delete nodes</div>
                    <div className="text-sm text-gray-500">
                      Permanently delete all nodes in the group
                    </div>
                  </div>
                </label>
              </div>
            </form>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Delete Group
          </button>
        </div>
      </div>
    </div>
  )
}
