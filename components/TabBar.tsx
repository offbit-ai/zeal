'use client'

import { useState } from 'react'
import { X, Plus, Star } from 'lucide-react'
import { Tooltip } from './Tooltip'

interface Tab {
  id: string
  name: string
  isMain?: boolean
  isDirty?: boolean
}

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string | null
  onTabSelect: (tabId: string) => void
  onTabClose?: (tabId: string) => void
  onTabAdd?: () => void
  onTabRename?: (tabId: string, newName: string) => void
  onSetMainTab?: (tabId: string) => void
}

export function TabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabAdd,
  onTabRename,
  onSetMainTab
}: TabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const handleStartEdit = (tab: Tab) => {
    setEditingTabId(tab.id)
    setEditingName(tab.name)
  }

  const handleFinishEdit = () => {
    if (editingTabId && editingName.trim() && onTabRename) {
      onTabRename(editingTabId, editingName.trim())
    }
    setEditingTabId(null)
    setEditingName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEdit()
    } else if (e.key === 'Escape') {
      setEditingTabId(null)
      setEditingName('')
    }
  }

  const handleContextMenu = (e: React.MouseEvent, tab: Tab) => {
    e.preventDefault()
    // TODO: Show context menu with options like "Set as Main", "Rename", "Delete"
  }

  return (
    <div className="flex items-center bg-gray-50/20 border-b border-gray-200 px-2 pt-2 h-12">
      <div className="flex items-center gap-1 flex-1 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`group flex items-center gap-1 px-3 py-1.5 rounded-t-md cursor-pointer transition-colors ${
              activeTabId === tab.id
                ? 'bg-white border-t border-l border-r border-gray-200'
                : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
            }`}
            onClick={() => onTabSelect(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab)}
          >
            {/* Main tab indicator */}
            {tab.isMain && (
              <Tooltip content="Main graph">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              </Tooltip>
            )}

            {/* Tab name */}
            {editingTabId === tab.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleFinishEdit}
                onKeyDown={handleKeyDown}
                className="px-1 py-0 text-sm border-none outline-none bg-transparent"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="text-sm select-none flex items-center gap-1"
                onDoubleClick={() => handleStartEdit(tab)}
              >
                {tab.name}
                {tab.isDirty && (
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full" title="Unsaved changes" />
                )}
              </span>
            )}

            {/* Close button - hide for main graph */}
            {tabs.length > 1 && onTabClose && !tab.isMain && (
              <button
                className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                  activeTabId === tab.id ? 'opacity-100' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.id)
                }}
              >
                <X className="w-3 h-3 text-gray-500 hover:text-gray-700" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add new tab button */}
      {onTabAdd && (
        <button
          onClick={onTabAdd}
          className="ml-2 p-1.5 rounded hover:bg-gray-200 transition-colors"
          title="Add new graph"
        >
          <Plus className="w-4 h-4 text-gray-600" />
        </button>
      )}
    </div>
  )
}