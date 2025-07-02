'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { useNotifications } from '@/contexts/NotificationContext'
import { NotificationCard } from './NotificationCard'

export function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications()

  if (notifications.length === 0) {
    return null
  }

  // Use portal to render notifications at the top level
  return createPortal(
    <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onRemove={removeNotification}
        />
      ))}
    </div>,
    document.body
  )
}