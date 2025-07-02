import { useCallback } from 'react'
import { useNotifications, NotificationType } from '@/contexts/NotificationContext'

export function useNotify() {
  const { addNotification } = useNotifications()

  const notify = useCallback((
    type: NotificationType,
    title: string,
    message?: string,
    options?: {
      duration?: number
      action?: {
        label: string
        onClick: () => void
      }
    }
  ) => {
    addNotification({
      type,
      title,
      message,
      duration: options?.duration,
      action: options?.action
    })
  }, [addNotification])

  // Convenience methods for common notification types
  const success = useCallback((title: string, message?: string, options?: { duration?: number }) => {
    notify('success', title, message, options)
  }, [notify])

  const error = useCallback((title: string, message?: string, options?: { duration?: number }) => {
    notify('error', title, message, options)
  }, [notify])

  const warning = useCallback((title: string, message?: string, options?: { duration?: number }) => {
    notify('warning', title, message, options)
  }, [notify])

  const info = useCallback((title: string, message?: string, options?: { duration?: number }) => {
    notify('info', title, message, options)
  }, [notify])

  return {
    notify,
    success,
    error,
    warning,
    info
  }
}