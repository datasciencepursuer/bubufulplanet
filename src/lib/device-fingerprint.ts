// Device fingerprinting utility for automatic login caching
// Creates a unique identifier for devices based on browser characteristics

export interface DeviceInfo {
  fingerprint: string
  userAgent: string
  screen: string
  timezone: string
  language: string
  platform: string
}

export function generateDeviceFingerprint(): DeviceInfo {
  if (typeof window === 'undefined') {
    // Server-side fallback
    return {
      fingerprint: 'server-side',
      userAgent: 'unknown',
      screen: 'unknown',
      timezone: 'unknown',
      language: 'unknown',
      platform: 'unknown'
    }
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let canvasFingerprint = 'no-canvas'
  
  if (ctx) {
    canvas.width = 200
    canvas.height = 50
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillText('Device fingerprint test 123', 2, 2)
    canvasFingerprint = canvas.toDataURL().slice(-50) // Last 50 chars for brevity
  }

  // Collect device characteristics
  const characteristics = [
    navigator.userAgent,
    navigator.language || navigator.languages?.[0] || 'unknown',
    navigator.platform,
    screen.width + 'x' + screen.height + 'x' + screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency?.toString() || 'unknown',
    navigator.maxTouchPoints?.toString() || '0',
    canvasFingerprint,
    // Add some stable browser features
    'cookieEnabled:' + navigator.cookieEnabled,
    'doNotTrack:' + (navigator.doNotTrack || 'unknown'),
  ].join('|')

  // Generate hash of characteristics
  const fingerprint = simpleHash(characteristics)

  return {
    fingerprint,
    userAgent: navigator.userAgent,
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language || navigator.languages?.[0] || 'unknown',
    platform: navigator.platform
  }
}

// Simple hash function for device fingerprinting
function simpleHash(str: string): string {
  let hash = 0
  if (str.length === 0) return hash.toString()
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36) // Base 36 for shorter string
}

// Store device fingerprint in localStorage
export function storeDeviceFingerprint(deviceInfo: DeviceInfo): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('vacation-planner-device-info', JSON.stringify(deviceInfo))
  }
}

// Retrieve device fingerprint from localStorage
export function getStoredDeviceFingerprint(): DeviceInfo | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem('vacation-planner-device-info')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return null
      }
    }
  }
  return null
}

// Store recent group access for quick switching
export interface RecentGroupAccess {
  groupId: string
  groupName: string
  travelerName: string
  role: string
  accessCode: string
  lastAccessed: string
}

export function storeRecentGroupAccess(access: RecentGroupAccess): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    const key = 'vacation-planner-recent-groups'
    const existing = localStorage.getItem(key)
    let groups: RecentGroupAccess[] = []
    
    if (existing) {
      try {
        groups = JSON.parse(existing)
      } catch {
        groups = []
      }
    }
    
    // Remove existing entry for this group/traveler combination
    groups = groups.filter(g => !(g.groupId === access.groupId && g.travelerName === access.travelerName))
    
    // Add new entry at the beginning
    groups.unshift(access)
    
    // Keep only the 5 most recent
    groups = groups.slice(0, 5)
    
    localStorage.setItem(key, JSON.stringify(groups))
  }
}

export function getRecentGroupAccesses(): RecentGroupAccess[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem('vacation-planner-recent-groups')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return []
      }
    }
  }
  return []
}

export function clearDeviceData(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('vacation-planner-device-info')
    localStorage.removeItem('vacation-planner-recent-groups')
  }
}