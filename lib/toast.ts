import { ToastManager } from '@/components/Toast'

// Toast service wrapper for consistent error/success messaging
export const toast = {
  success: (message: string) => {
    ToastManager.success(message)
  },

  error: (error: unknown) => {
    let message = 'An unexpected error occurred'

    if (error instanceof Error) {
      // Check if it's an API error with a specific message
      if ('code' in error) {
        // API errors typically have more user-friendly messages
        message = error.message
      } else {
        // Generic errors - use message but make it more user-friendly
        message = error.message || message
      }
    } else if (typeof error === 'string') {
      message = error
    }

    ToastManager.error(message)
  },

  info: (message: string) => {
    ToastManager.info(message)
  },

  warning: (message: string) => {
    ToastManager.warning(message)
  },
}
