'use client'

import React from 'react'
import { AlertTriangle, X, Settings } from 'lucide-react'

interface MissingEnvVarWarningProps {
  missingVars: string[]
  onDismiss: () => void
  onOpenConfig: () => void
}

export function MissingEnvVarWarning({
  missingVars,
  onDismiss,
  onOpenConfig,
}: MissingEnvVarWarningProps) {
  if (missingVars.length === 0) return null

  return (
    <div className="fixed top-[60px] left-0 right-0 z-50 bg-yellow-50/90 border-b border-yellow-200 px-6 py-3">
      <div className="flex items-center gap-8 justify-center min-w-fit  mx-auto">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-800">
              Missing environment variables detected
            </p>
            <p className="text-sm text-yellow-700 mt-0.5">
              {missingVars.length === 1 ? (
                <>
                  The variable{' '}
                  <span className="font-mono bg-yellow-100 px-1 rounded">{missingVars[0]}</span> is
                  required but not configured.
                </>
              ) : (
                <>
                  {missingVars.length} variables are required but not configured:{' '}
                  <span className="font-mono bg-yellow-100 px-1 rounded">
                    {missingVars.slice(0, 3).join(', ')}
                    {missingVars.length > 3 && ` +${missingVars.length - 3} more`}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onOpenConfig}
            className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configure Variables
          </button>
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-yellow-200 rounded transition-colors"
            title="Dismiss warning"
          >
            <X className="w-4 h-4 text-yellow-600" />
          </button>
        </div>
      </div>
    </div>
  )
}
