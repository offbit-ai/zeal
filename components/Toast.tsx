'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose?: () => void
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info
}

const styles = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200'
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isExiting, setIsExiting] = useState(false)
  
  const Icon = icons[type]
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, 300)
    }, duration)
    
    return () => clearTimeout(timer)
  }, [duration, onClose])
  
  if (!isVisible) return null
  
  return (
    <div className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg transition-all duration-300 z-50 ${
      isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
    } ${styles[type]}`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}

// Toast manager for showing toasts imperatively
class ToastManager {
  private static listeners: ((toast: ToastProps) => void)[] = []
  
  static subscribe(listener: (toast: ToastProps) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }
  
  static show(message: string, type: ToastType = 'info', duration?: number) {
    this.listeners.forEach(listener => listener({ message, type, duration }))
  }
  
  static success(message: string, duration?: number) {
    this.show(message, 'success', duration)
  }
  
  static error(message: string, duration?: number) {
    this.show(message, 'error', duration)
  }
  
  static warning(message: string, duration?: number) {
    this.show(message, 'warning', duration)
  }
  
  static info(message: string, duration?: number) {
    this.show(message, 'info', duration)
  }
}

export { ToastManager }

// Toast provider component
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<(ToastProps & { id: string })[]>([])
  
  useEffect(() => {
    const unsubscribe = ToastManager.subscribe((toast) => {
      const id = Math.random().toString(36).substr(2, 9)
      setToasts(prev => [...prev, { ...toast, id }])
    })
    
    return unsubscribe
  }, [])
  
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }
  
  return (
    <>
      {children}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  )
}