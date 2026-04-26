'use client'

import { AlertTriangle } from 'lucide-react'
import { ModalPortal } from './ModalPortal'

interface UnsavedChangesDialogProps {
  isOpen: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
  graphName?: string
}

export function UnsavedChangesDialog({
  isOpen,
  onSave,
  onDiscard,
  onCancel,
  graphName,
}: UnsavedChangesDialogProps) {
  if (!isOpen) return null

  return (
    <ModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Icon and Title */}
          <div className="flex items-start gap-4 mb-4">
            <div className="p-2 bg-yellow-50 rounded-full">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Unsaved Changes</h3>
              <p className="mt-1 text-sm text-gray-600">
                {graphName
                  ? `You have unsaved changes in "${graphName}". What would you like to do?`
                  : 'You have unsaved changes. What would you like to do?'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onDiscard}
              className="flex-1 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              Discard Changes
            </button>
            <button
              onClick={onSave}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
