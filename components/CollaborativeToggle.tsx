'use client'

import React, { useState } from 'react'
import { Users, UserX, Loader2 } from 'lucide-react'

interface CollaborativeToggleProps {
  isCollaborative: boolean
  isLoading?: boolean
  workflowId: string | null
  onToggle: (enabled: boolean) => Promise<void>
}

export function CollaborativeToggle({ 
  isCollaborative, 
  isLoading = false,
  workflowId,
  onToggle 
}: CollaborativeToggleProps) {
  const [isToggling, setIsToggling] = useState(false)
  
  const handleToggle = async () => {
    if (!workflowId || isToggling || isLoading) return
    
    setIsToggling(true)
    try {
      await onToggle(!isCollaborative)
    } catch (error) {
      console.error('Failed to toggle collaborative mode:', error)
    } finally {
      setIsToggling(false)
    }
  }
  
  return (
    <button
      onClick={handleToggle}
      disabled={!workflowId || isToggling || isLoading}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
        transition-all duration-200
        ${isCollaborative 
          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }
        ${(!workflowId || isToggling || isLoading) 
          ? 'opacity-50 cursor-not-allowed' 
          : 'cursor-pointer'
        }
      `}
      title={
        !workflowId 
          ? 'Save workflow first to enable collaboration' 
          : isCollaborative 
          ? 'Disable collaborative mode' 
          : 'Enable collaborative mode'
      }
    >
      {isToggling || isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isCollaborative ? (
        <Users className="w-3.5 h-3.5" />
      ) : (
        <UserX className="w-3.5 h-3.5" />
      )}
      <span>
        {isToggling || isLoading 
          ? 'Loading...' 
          : isCollaborative 
          ? 'Collaborative' 
          : 'Local Only'
        }
      </span>
    </button>
  )
}