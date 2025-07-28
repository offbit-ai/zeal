'use client'

import { Save } from 'lucide-react'

interface SaveGraphButtonProps {
  isVisible: boolean
  graphName: string
  onSave: () => void
  isSaving?: boolean
}

export function SaveGraphButton({ isVisible, graphName, onSave, isSaving = false }: SaveGraphButtonProps) {
  if (!isVisible) return null

  return (
    <div className={`fixed left-6 bottom-6 z-50 transition-all duration-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
      <button
        onClick={onSave}
        disabled={isSaving}
        className="group flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
      >
        <Save className={`w-4 h-4 ${isSaving ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
        <span className="font-medium text-sm">
          {isSaving ? 'Saving...' : `Save "${graphName}"`}
        </span>
      </button>
      
      {/* Subtle glow effect */}
      <div className="absolute inset-0 -z-10 bg-green-600/20 blur-xl rounded-lg" />
    </div>
  )
}