'use client'

import React, { useEffect, useRef } from 'react'
import { MousePointer2 } from 'lucide-react'
import type { CRDTPresence } from '@/lib/crdt/types'

interface CollaborativeCursorsProps {
  presence: Map<number, CRDTPresence>
  currentGraphId: string
  canvasOffset: { x: number; y: number }
  canvasZoom: number
  currentUserId?: number // The current user's client ID to filter out their own cursor
}

export function CollaborativeCursors({
  presence,
  currentGraphId,
  canvasOffset,
  canvasZoom,
  currentUserId,
}: CollaborativeCursorsProps) {
  const cursorsRef = useRef<Map<string, HTMLDivElement>>(new Map())

  // Simple debug when users change
  useEffect(() => {
    const userCount = Array.from(presence.values()).filter(
      u => u.userId && u.cursor && u.cursor.graphId === currentGraphId
    ).length
    if (userCount > 0) {
      // [CollaborativeCursors] log removed
    }
  }, [presence.size, currentGraphId])

  useEffect(() => {
    // Clean up cursors for users that are no longer present
    const currentUserIds = new Set<string>()

    presence.forEach(user => {
      if (user.cursor && user.cursor.graphId === currentGraphId) {
        currentUserIds.add(user.userId)
      }
    })

    // Remove cursor elements for users that left
    cursorsRef.current.forEach((element, userId) => {
      if (!currentUserIds.has(userId)) {
        element.remove()
        cursorsRef.current.delete(userId)
      }
    })
  }, [presence, currentGraphId])

  // Deduplicate users by userId, keeping the most recent one
  const userMap = new Map<string, { clientId: number; user: CRDTPresence }>()

  Array.from(presence.entries()).forEach(([clientId, user]) => {
    if (user && user.userId) {
      const existing = userMap.get(user.userId)
      if (!existing || user.lastSeen > (existing.user.lastSeen || 0)) {
        userMap.set(user.userId, { clientId, user })
      }
    }
  })

  return (
    <>
      {Array.from(userMap.values()).map(({ clientId, user }) => {
        // Skip if no user data
        if (!user || !user.userId) {
          console.warn('[CollaborativeCursors] Invalid user data:', user)
          return null
        }

        // Skip local user's cursor using the provided currentUserId
        // Convert both to numbers for proper comparison since Y.js clientID is a number
        if (currentUserId !== undefined && Number(clientId) === Number(currentUserId)) {
          // // [CollaborativeCursors] log removed, currentUserIdNum: Number(currentUserId) })
          return null
        }

        // Only show cursor if user is on the same graph
        if (!user.cursor || user.cursor.graphId !== currentGraphId) {
          return null
        }

        // The cursor position is already in world coordinates
        // Since this component is rendered inside the transformed container,
        // we don't need to apply any transformation - just use the world coordinates directly
        const screenX = user.cursor.x
        const screenY = user.cursor.y

        return (
          <div
            key={user.userId}
            className="absolute pointer-events-none z-50 transition-all duration-150"
            style={{
              transform: `translate(${screenX}px, ${screenY}px)`,
            }}
          >
            {/* Cursor */}
            <MousePointer2
              className="w-5 h-5"
              style={{
                color: user.userColor,
                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))',
              }}
              fill={user.userColor}
            />

            {/* User Name Label */}
            <div
              className="absolute top-5 left-2 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap"
              style={{
                backgroundColor: user.userColor,
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              }}
            >
              {user.userName}
            </div>
          </div>
        )
      })}
    </>
  )
}
