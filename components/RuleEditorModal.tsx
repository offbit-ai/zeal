'use client'

import { useState, useEffect } from 'react'
import { X, Settings } from 'lucide-react'
import { RuleSet } from '@/types/workflow'
import { RuleBuilder } from './RuleBuilder'

interface RuleEditorModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  value: RuleSet[]
  onChange: (value: RuleSet[]) => void
  availableFields?: string[]
  availableOperators?: any[]
  description?: string
}

export function RuleEditorModal({
  isOpen,
  onClose,
  title,
  value,
  onChange,
  availableFields = [],
  availableOperators,
  description,
}: RuleEditorModalProps) {
  const [localValue, setLocalValue] = useState<RuleSet[]>(value)

  // Update local state when value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Handle changes and auto-save
  const handleChange = (newValue: RuleSet[]) => {
    setLocalValue(newValue)
    onChange(newValue)
  }

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {availableFields.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Settings className="w-8 h-8 mb-2 text-gray-400" />
              <div className="text-sm">No fields available</div>
              <div className="text-xs mt-1">Configure available fields to start building rules</div>
            </div>
          ) : (
            <RuleBuilder
              value={localValue}
              onChange={handleChange}
              availableFields={availableFields}
              availableOperators={availableOperators}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500">
            {localValue.length} rule set{localValue.length !== 1 ? 's' : ''} configured
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
