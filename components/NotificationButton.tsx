'use client'

import React from 'react'
import { Bell } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'

export function NotificationButton() {
  const { unreadCount, togglePanel } = useNotificationStore()

  return (
    <button
      onClick={togglePanel}
      className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      title="View activity"
    >
      <Bell className="w-5 h-5 text-gray-600" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
