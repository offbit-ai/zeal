import { create } from 'zustand'
import { toast } from '@/lib/toast'

export interface Notification {
  id: string
  type: 'node-added' | 'node-deleted' | 'connection-added' | 'connection-deleted' | 
        'subgraph-added' | 'proxy-added' | 'group-created' | 'group-deleted' |
        'workflow-renamed' | 'graph-renamed' | 'graph-added' | 'graph-deleted'
  message: string
  userName: string
  userId: string
  timestamp: number
  data?: any
  isImportant?: boolean
}

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  isOpen: boolean
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  markAllAsRead: () => void
  clearNotifications: () => void
  togglePanel: () => void
  setOpen: (isOpen: boolean) => void
}

// Important operations that should show toasts
const IMPORTANT_OPERATIONS = ['workflow-renamed', 'graph-renamed', 'graph-added', 'graph-deleted']

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  
  addNotification: (notification) => {
    // [Notification] log removed
    
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }
    
    // Show toast for important operations
    if (IMPORTANT_OPERATIONS.includes(notification.type) || notification.isImportant) {
      // [Notification] log removed
      toast.info(`${notification.userName} ${notification.message}`)
    } else {
      // [Notification] log removed
    }
    
    set(state => ({
      notifications: [newNotification, ...state.notifications].slice(0, 100), // Keep last 100
      unreadCount: state.unreadCount + 1
    }))
    
    // [Notification] log removed.notifications.length);
  },
  
  markAllAsRead: () => {
    set({ unreadCount: 0 })
  },
  
  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0 })
  },
  
  togglePanel: () => {
    set(state => {
      const newIsOpen = !state.isOpen
      // Mark as read when opening
      if (newIsOpen) {
        return { isOpen: newIsOpen, unreadCount: 0 }
      }
      return { isOpen: newIsOpen }
    })
  },
  
  setOpen: (isOpen: boolean) => {
    set(state => {
      // Mark as read when opening
      if (isOpen && state.unreadCount > 0) {
        return { isOpen, unreadCount: 0 }
      }
      return { isOpen }
    })
  }
}))