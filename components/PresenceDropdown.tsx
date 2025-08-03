'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Share2, Settings, Users, LogOut, ChevronDown } from 'lucide-react'
import { PresenceIndicator } from './PresenceIndicator'
import type { CRDTPresence } from '@/lib/crdt/types'

interface PresenceDropdownProps {
  presence: Map<number, CRDTPresence>
  isCollaborative: boolean
  isSyncing: boolean
  isOptimized?: boolean
  localClientId?: number
  workflowId: string | null
  onShare: () => void
  onUserSettings: () => void
  className?: string
}

export function PresenceDropdown({
  presence,
  isCollaborative,
  isSyncing,
  isOptimized = false,
  localClientId,
  workflowId,
  onShare,
  onUserSettings,
  className = ''
}: PresenceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get local user info
  const localUser = presence.get(localClientId || 0)
  const localUserName = localUser?.userName || 'Anonymous'

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Clickable Presence Indicator */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 hover:bg-gray-50 rounded-lg transition-colors bg-white  border border-gray-200 px-3 ${className}`}
      >
        <PresenceIndicator
          presence={presence}
          isCollaborative={isCollaborative}
          isSyncing={isSyncing}
          isOptimized={isOptimized}
          localClientId={localClientId}
        />
        <ChevronDown className={` w-3 h-3 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-900">{localUserName}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {(() => {
                // Count unique users (not sessions)
                const uniqueUsers = new Set(Array.from(presence.values()).map(p => p.userId));
                const otherUsersCount = uniqueUsers.size - 1; // Exclude local user
                return otherUsersCount === 0 ? 'Working alone' : `Collaborating with ${otherUsersCount} other${otherUsersCount === 1 ? '' : 's'}`;
              })()}
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {/* Share */}
            {workflowId && (
              <button
                onClick={() => {
                  onShare()
                  setIsOpen(false)
                }}
                className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
              >
                <Share2 className="w-4 h-4" />
                Copy share link
              </button>
            )}

            {/* User Settings */}
            <button
              onClick={() => {
                onUserSettings()
                setIsOpen(false)
              }}
              className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
            >
              <Settings className="w-4 h-4" />
              User settings
            </button>

            {/* Active Users (if any) */}
            {(() => {
              const uniqueUsers = new Set(Array.from(presence.values()).map(p => p.userId));
              return uniqueUsers.size > 1;
            })() && (
              <>
                <div className="border-t border-gray-100 my-1" />
                <div className="px-4 py-2">
                  <div className="text-xs font-medium text-gray-500 mb-2">Active users</div>
                  {Array.from(
                    // Deduplicate users by userId
                    Array.from(presence.values())
                      .filter(user => user.userId !== localUser?.userId)
                      .reduce((unique, user) => {
                        if (!unique.has(user.userId)) {
                          unique.set(user.userId, user);
                        }
                        return unique;
                      }, new Map<string, CRDTPresence>())
                      .values()
                  ).map(user => (
                    <div key={user.userId} className="flex items-center gap-2 py-1">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                        style={{ backgroundColor: user.userColor }}
                      >
                        {user.userName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-700">{user.userName}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}