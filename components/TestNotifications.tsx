'use client'

import React from 'react'
import { useNotificationStore } from '@/store/notificationStore'

export function TestNotifications() {
  const { notifications, unreadCount, addNotification } = useNotificationStore()

  const testAddNotification = () => {
    console.log('[TestNotifications] Adding test notification')
    addNotification({
      type: 'node-added',
      message: 'added a test node',
      userName: 'Test User',
      userId: 'test-user-id',
    })
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white p-4 rounded shadow-lg border">
      <h3 className="font-bold mb-2">Notification Test</h3>
      <p>Notifications: {notifications.length}</p>
      <p>Unread: {unreadCount}</p>
      <button
        onClick={testAddNotification}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Add Test Notification
      </button>
    </div>
  )
}
