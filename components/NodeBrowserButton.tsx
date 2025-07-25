'use client'

import { LayoutGrid } from 'lucide-react'
import { Tooltip } from './Tooltip'

interface NodeBrowserButtonProps {
  onClick: () => void
  isActive?: boolean
}

export function NodeBrowserButton({ onClick, isActive = false }: NodeBrowserButtonProps) {
  return (
    <Tooltip content="Browse Nodes" position="left">
      <button
        onClick={onClick}
        className={`absolute left-4 top-24 w-10 h-10 rounded-lg shadow-sm border border-gray-200 flex items-center justify-center transition-colors z-20 ${
          isActive ? 'bg-black text-white' : 'bg-white hover:bg-gray-50 text-gray-600'
        }`}
      >
        <LayoutGrid className="w-4 h-4" strokeWidth={1.5} />
      </button>
    </Tooltip>
  )
}