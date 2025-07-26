'use client'

import React, { useState, useEffect } from 'react'
import { X, Users, FileText, Plus } from 'lucide-react'

interface EmptyGroupCreationModalProps {
  isOpen: boolean
  position: { x: number; y: number }
  onConfirm: (title: string, description: string, position: { x: number; y: number }) => void
  onCancel: () => void
}

export function EmptyGroupCreationModal({ 
  isOpen, 
  position,
  onConfirm, 
  onCancel 
}: EmptyGroupCreationModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  
  // Detect platform for showing correct keyboard shortcut
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const shortcutKey = isMac ? '⌘E' : 'Ctrl+E'

  useEffect(() => {
    if (isOpen) {
      // Auto-generate default values when modal opens
      setTitle('New Group')
      setDescription('Empty group ready for nodes')
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim()) {
      onConfirm(title.trim(), description.trim(), position)
      setTitle('')
      setDescription('')
    }
  }

  const handleCancel = () => {
    onCancel()
    setTitle('')
    setDescription('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Create Empty Group</h2>
              <p className="text-sm text-gray-500">
                Create a new group container
                <span className="ml-2 text-xs text-gray-400">({shortcutKey})</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Title Input */}
            <div>
              <label htmlFor="group-title" className="block text-sm font-medium text-gray-700 mb-2">
                Group Title *
              </label>
              <input
                id="group-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter group title..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                autoFocus
                required
              />
            </div>

            {/* Description Input */}
            <div>
              <label htmlFor="group-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <textarea
                  id="group-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose of this group..."
                  rows={3}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Info about drag and drop */}
            <div className="bg-green-50 rounded-lg p-3">
              <h4 className="text-xs font-medium text-green-800 mb-1">💡 Tip:</h4>
              <p className="text-xs text-green-700">
                After creating this group, you can drag nodes into it to add them to the group.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create Empty Group
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}