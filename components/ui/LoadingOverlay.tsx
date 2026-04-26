'use client'

import { Loader2 } from 'lucide-react'

interface LoadingOverlayProps {
  message?: string
}

export function LoadingOverlay({ message = 'Loading workflow...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-gray-600 animate-spin" />
        <p className="text-lg font-medium text-gray-700">{message}</p>
      </div>
    </div>
  )
}
