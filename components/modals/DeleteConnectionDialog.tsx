'use client'

import { useEffect } from 'react'

interface DeleteConnectionDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConnectionDialog({
  isOpen,
  onConfirm,
  onCancel,
}: DeleteConnectionDialogProps) {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Delete Connection</h3>
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete this connection? This action cannot be undone.
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  )
}
