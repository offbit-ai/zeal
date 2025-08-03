'use client'

import React, { useEffect } from 'react'
import { Users, Circle } from 'lucide-react'
import type { CRDTPresence } from '@/lib/crdt/types'

interface PresenceIndicatorProps {
  presence: Map<number, CRDTPresence>
  isCollaborative: boolean
  isSyncing: boolean
  isOptimized?: boolean
  localClientId?: number
  className?: string
}

export function PresenceIndicator({ 
  presence, 
  isCollaborative, 
  isSyncing,
  isOptimized = false,
  localClientId,
  className = '' 
}: PresenceIndicatorProps) {
  // Add pulsate animation styles
  useEffect(() => {
    const styleId = 'presence-pulsate-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        @keyframes status-pulsate {
          0% {
            opacity: 1;
            transform: scale(1);
            box-shadow: 0 0 0 0 currentColor;
          }
          50% {
            opacity: 0.3;
            transform: scale(1.5);
            box-shadow: 0 0 0 6px rgba(currentColor, 0.2);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            box-shadow: 0 0 0 0 currentColor;
          }
        }
        
        .status-pulsate {
          animation: status-pulsate 1.5s ease-in-out infinite;
          transform-origin: center;
        }
        
        .status-pulsate-wrapper {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        
        .status-pulsate-wrapper::before {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          animation: status-pulsate-ring 1.5s ease-in-out infinite;
        }
        
        @keyframes status-pulsate-ring {
          0% {
            transform: scale(1);
            opacity: 1;
            box-shadow: 0 0 0 0 currentColor;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
            box-shadow: 0 0 0 2px currentColor;
          }
        }
      `
      document.head.appendChild(style)
    }
    
    return () => {
      const style = document.getElementById(styleId)
      if (style && document.querySelectorAll('.status-pulsate').length === 0) {
        style.remove()
      }
    }
  }, [])
  
  if (!isCollaborative) return null
  
  // Get local user ID to properly filter out all instances of current user
  const localUserId = presence.get(localClientId || 0)?.userId
  
  // Filter out our own presence (all instances) and group by userId
  const userMap = new Map<string, CRDTPresence>()
  
  Array.from(presence.entries()).forEach(([clientId, user]) => {
    // Skip if it's the current user (any tab/window)
    if (user.userId === localUserId) return
    
    // Keep only the most recent entry for each userId
    const existing = userMap.get(user.userId)
    if (!existing || user.lastSeen > (existing.lastSeen || 0)) {
      userMap.set(user.userId, user)
    }
  })
  
  const otherUsers = Array.from(userMap.values())
  
  return (
    <div className={`flex items-center gap-2 py-2  ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        <div className={`status-pulsate-wrapper ${
          isSyncing
            ? 'text-yellow-500'
            : isOptimized
            ? 'text-blue-500'
            : 'text-green-500'
        }`}>
          <Circle
            className="w-2.5 h-2.5 status-pulsate"
            fill="currentColor"
          />
        </div>
        <span className="text-xs font-medium text-gray-600">
          {isSyncing ? 'Syncing' : isOptimized ? '' : ''}
        </span>
      </div>
      
      {/* User Count */}
      <div className="flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-medium text-gray-700">
          {otherUsers.length === 0 
            ? 'Just you' 
            : `${otherUsers.length + 1} user${otherUsers.length === 0 ? '' : 's'}`
          }
        </span>
      </div>
      
      {/* User Avatars */}
      {otherUsers.length > 0 && (
        <div className="flex -space-x-2">
          {otherUsers.slice(0, 3).map((user, index) => (
            <div
              key={user.userId}
              className="w-4 h-4 rounded-full  flex items-center justify-center text-xs font-medium text-white"
              style={{ 
                backgroundColor: user.userColor
              }}
              title={user.userName}
            >
              {user.userName.charAt(0).toUpperCase()}
            </div>
          ))}
          {otherUsers.length > 3 && (
            <div
              className="w-4 h-4 rounded-full  bg-gray-400 flex items-center justify-center text-xs font-medium text-white"
              title={`+${otherUsers.length - 3} more`}
            >
              +{otherUsers.length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  )
}