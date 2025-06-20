'use client'

import { useState, useEffect } from 'react'
import { 
  generateDeviceFingerprint, 
  storeDeviceFingerprint, 
  getStoredDeviceFingerprint,
  storeRecentGroupAccess,
  getRecentGroupAccesses,
  clearDeviceData,
  type DeviceInfo,
  type RecentGroupAccess 
} from '@/lib/device-fingerprint'
import { attemptAutoLoginFromDevice } from '@/lib/unified-session-client'

interface AvailableSession {
  groupId: string
  groupName: string
  accessCode: string
  travelerName: string
  role: string
  permissions: {
    read: boolean
    create: boolean
    modify: boolean
  }
  lastLogin: string
}

interface AutoLoginResult {
  success: boolean
  group?: {
    id: string
    name: string
    accessCode: string
  }
  currentMember?: {
    name: string
    role: string
    permissions: {
      read: boolean
      create: boolean
      modify: boolean
    }
  }
  error?: string
}

export function useDeviceSession() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [availableSessions, setAvailableSessions] = useState<AvailableSession[]>([])
  const [recentGroups, setRecentGroups] = useState<RecentGroupAccess[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize device fingerprint and check for available sessions
  useEffect(() => {
    const initializeDevice = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Get or generate device fingerprint
        let storedDevice = getStoredDeviceFingerprint()
        if (!storedDevice) {
          storedDevice = generateDeviceFingerprint()
          storeDeviceFingerprint(storedDevice)
        }
        console.log('[DeviceSession] Using fingerprint:', storedDevice.fingerprint)
        setDeviceInfo(storedDevice)

        // Get recent group accesses from localStorage
        const recent = getRecentGroupAccesses()
        setRecentGroups(recent)

        // Check for available device sessions on the server
        const response = await fetch('/api/device-sessions/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceFingerprint: storedDevice.fingerprint })
        })

        if (response.ok) {
          const data = await response.json()
          console.log('[DeviceSession] Server response:', data)
          setAvailableSessions(data.sessions || [])
        } else {
          console.warn('Failed to check device sessions:', await response.text())
        }
      } catch (err) {
        console.error('Error initializing device session:', err)
        setError('Failed to initialize device session')
      } finally {
        setIsLoading(false)
      }
    }

    initializeDevice()
  }, [])

  // Save device session after successful login
  const saveDeviceSession = async (groupId: string, travelerName: string) => {
    if (!deviceInfo) return

    try {
      await fetch('/api/device-sessions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceFingerprint: deviceInfo.fingerprint,
          groupId,
          travelerName,
          userAgent: deviceInfo.userAgent
        })
      })
    } catch (error) {
      console.error('Failed to save device session:', error)
    }
  }

  // Store recent group access in localStorage
  const storeGroupAccess = (access: RecentGroupAccess) => {
    storeRecentGroupAccess(access)
    setRecentGroups(getRecentGroupAccesses())
  }

  // Attempt automatic login with unified session system
  const attemptAutoLogin = async (
    groupId: string, 
    travelerName: string
  ): Promise<AutoLoginResult> => {
    if (!deviceInfo) {
      return { success: false, error: 'Device not initialized' }
    }

    try {
      // Use unified session auto-login
      const result = await attemptAutoLoginFromDevice(
        deviceInfo.fingerprint,
        groupId,
        travelerName
      )

      if (result.success) {
        // Get group and member info for backward compatibility
        const response = await fetch('/api/groups/current')
        if (response.ok) {
          const data = await response.json()
          
          // Update recent groups
          if (data.group && data.currentMember) {
            storeGroupAccess({
              groupId: data.group.id,
              groupName: data.group.name,
              travelerName: data.currentMember.name,
              role: data.currentMember.role,
              accessCode: data.group.accessCode,
              lastAccessed: new Date().toISOString()
            })
          }

          return {
            success: true,
            group: data.group,
            currentMember: data.currentMember
          }
        }
      }

      return { success: false, error: result.error }
    } catch (error) {
      console.error('Auto-login error:', error)
      return { success: false, error: 'Auto-login failed' }
    }
  }

  // Check if auto-login is available for a specific group/traveler
  const hasAutoLogin = (groupId: string, travelerName: string): boolean => {
    return availableSessions.some(
      session => session.groupId === groupId && session.travelerName === travelerName
    )
  }

  // Get most recent session for quick access (should only be one now)
  const getMostRecentSession = (): AvailableSession | null => {
    if (availableSessions.length === 0) return null
    
    // Since we now only keep one active session per device, just return the first one
    return availableSessions[0]
  }

  // Logout and clear device session
  const logout = async (clearLocalData: boolean = false): Promise<boolean> => {
    if (!deviceInfo) return false

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceFingerprint: deviceInfo.fingerprint
        })
      })

      if (response.ok) {
        // Clear available sessions immediately
        setAvailableSessions([])
        
        // Optionally clear local device data (recent groups, etc.)
        if (clearLocalData) {
          clearDeviceData()
          setRecentGroups([])
          console.log('🧹 Cleared local device data for privacy')
        }
        
        // Force a fresh check to make sure sessions are cleared
        try {
          const checkResponse = await fetch('/api/device-sessions/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceFingerprint: deviceInfo.fingerprint })
          })
          
          if (checkResponse.ok) {
            const data = await checkResponse.json()
            setAvailableSessions(data.sessions || [])
          }
        } catch (checkError) {
          console.error('Error refreshing sessions after logout:', checkError)
        }
        
        return true
      }
      return false
    } catch (error) {
      console.error('Logout error:', error)
      return false
    }
  }

  return {
    deviceInfo,
    availableSessions,
    recentGroups,
    isLoading,
    error,
    saveDeviceSession,
    storeGroupAccess,
    attemptAutoLogin,
    hasAutoLogin,
    getMostRecentSession,
    logout
  }
}