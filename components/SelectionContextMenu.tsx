'use client'

import React, { useEffect, useRef } from 'react'
import { Users, Trash2, Copy, Scissors, Package } from 'lucide-react'

interface SelectionContextMenuProps {
  isVisible: boolean
  position: { x: number; y: number }
  selectedNodeCount: number
  onCreateGroup: () => void
  onCopy?: () => void
  onCut?: () => void
  onDelete?: () => void
  onClose: () => void
}

export function SelectionContextMenu({
  isVisible,
  position,
  selectedNodeCount,
  onCreateGroup,
  onCopy,
  onCut,
  onDelete,
  onClose,
}: SelectionContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  // Detect platform for showing correct keyboard shortcut
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const groupShortcut = isMac ? '⌘G' : 'Ctrl+G'

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-48 animate-in fade-in duration-150"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            {selectedNodeCount} node{selectedNodeCount !== 1 ? 's' : ''} selected
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="py-1">
        <button
          onClick={() => {
            onCreateGroup()
            onClose()
          }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Users className="w-4 h-4 text-blue-600" />
          <span>Create Group</span>
          <span className="ml-auto text-xs text-gray-400">{groupShortcut}</span>
        </button>

        <div className="border-t border-gray-100 my-1" />

        {onCopy && (
          <button
            onClick={() => {
              onCopy()
              onClose()
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Copy className="w-4 h-4 text-gray-600" />
            <span>Copy</span>
            <span className="ml-auto text-xs text-gray-400">{isMac ? '⌘C' : 'Ctrl+C'}</span>
          </button>
        )}

        {onCut && (
          <button
            onClick={() => {
              onCut()
              onClose()
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Scissors className="w-4 h-4 text-gray-600" />
            <span>Cut</span>
            <span className="ml-auto text-xs text-gray-400">{isMac ? '⌘X' : 'Ctrl+X'}</span>
          </button>
        )}

        {onDelete && (
          <>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => {
                onDelete()
                onClose()
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
              <span className="ml-auto text-xs text-gray-400">Del</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
