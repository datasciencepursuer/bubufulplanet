'use client'

import React from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Notification, NotificationType } from '@/contexts/NotificationContext'

interface NotificationCardProps {
  notification: Notification
  onRemove: (id: string) => void
}

const notificationStyles: Record<NotificationType, {
  bgColor: string
  borderColor: string
  iconColor: string
  icon: React.ComponentType<{ className?: string }>
}> = {
  success: {
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-200 dark:border-green-800',
    iconColor: 'text-green-600 dark:text-green-400',
    icon: CheckCircle
  },
  error: {
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-600 dark:text-red-400',
    icon: AlertCircle
  },
  warning: {
    bgColor: 'bg-amber-50 dark:bg-amber-950',
    borderColor: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-600 dark:text-amber-400',
    icon: AlertTriangle
  },
  info: {
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-600 dark:text-blue-400',
    icon: Info
  }
}

export function NotificationCard({ notification, onRemove }: NotificationCardProps) {
  const style = notificationStyles[notification.type]
  const Icon = style.icon

  return (
    <Card className={cn(
      'p-4 border-l-4 shadow-lg transition-all duration-300 ease-in-out',
      'animate-in slide-in-from-right-full',
      style.bgColor,
      style.borderColor
    )}>
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', style.iconColor)} />
        
        <div className="flex-1 min-w-0">
          <h4 className={cn(
            'font-semibold text-sm',
            notification.type === 'success' && 'text-green-900 dark:text-green-100',
            notification.type === 'error' && 'text-red-900 dark:text-red-100',
            notification.type === 'warning' && 'text-amber-900 dark:text-amber-100',
            notification.type === 'info' && 'text-blue-900 dark:text-blue-100'
          )}>
            {notification.title}
          </h4>
          
          {notification.message && (
            <p className={cn(
              'text-sm mt-1',
              notification.type === 'success' && 'text-green-700 dark:text-green-200',
              notification.type === 'error' && 'text-red-700 dark:text-red-200',
              notification.type === 'warning' && 'text-amber-700 dark:text-amber-200',
              notification.type === 'info' && 'text-blue-700 dark:text-blue-200'
            )}>
              {notification.message}
            </p>
          )}
          
          {notification.action && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={notification.action.onClick}
            >
              {notification.action.label}
            </Button>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 flex-shrink-0"
          onClick={() => onRemove(notification.id)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close notification</span>
        </Button>
      </div>
    </Card>
  )
}