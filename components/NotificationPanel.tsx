'use client'

import React from 'react'
import { X, Bell, GitBranch, Plus, Trash2, Link, Users, Edit3, FileText } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { formatDistanceToNow } from 'date-fns'

const NotificationIcon = ({ type }: { type: string }) => {
  const iconClass = 'w-4 h-4'

  switch (type) {
    case 'node-added':
      return <Plus className={iconClass} />
    case 'node-deleted':
      return <Trash2 className={iconClass} />
    case 'connection-added':
    case 'connection-deleted':
      return <Link className={iconClass} />
    case 'subgraph-added':
    case 'proxy-added':
      return <GitBranch className={iconClass} />
    case 'group-created':
    case 'group-deleted':
      return <Users className={iconClass} />
    case 'workflow-renamed':
      return <FileText className={iconClass} />
    case 'graph-renamed':
    case 'graph-added':
    case 'graph-deleted':
      return <Edit3 className={iconClass} />
    default:
      return <Bell className={iconClass} />
  }
}

const NotificationTypeColor = (type: string): string => {
  switch (type) {
    case 'node-added':
    case 'connection-added':
    case 'subgraph-added':
    case 'proxy-added':
    case 'group-created':
    case 'graph-added':
      return 'text-green-600 bg-green-50'
    case 'node-deleted':
    case 'connection-deleted':
    case 'group-deleted':
    case 'graph-deleted':
      return 'text-red-600 bg-red-50'
    case 'workflow-renamed':
    case 'graph-renamed':
      return 'text-blue-600 bg-blue-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export function NotificationPanel() {
  const { notifications, isOpen, setOpen, clearNotifications } = useNotificationStore()

  console.log('[NotificationPanel] Render - isOpen:', isOpen, 'notifications:', notifications.length)

  if (!isOpen) return null

  return (
    <div className="absolute top-16 right-4 w-96 max-h-[600px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Activity</h3>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={clearNotifications}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No activity yet</p>
            <p className="text-xs text-gray-400 mt-1">Collaborative actions will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map(notification => (
              <div key={notification.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex gap-3">
                  <div className={`p-2 rounded-lg ${NotificationTypeColor(notification.type)}`}>
                    <NotificationIcon type={notification.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{notification.userName}</span>{' '}
                          <span className="text-gray-600">{notification.message}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
