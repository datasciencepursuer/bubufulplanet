/**
 * Unified Session Management - CLIENT SIDE
 * Client-side functions for session management
 * Safe to import in client components
 */

/**
 * Client-side auto-login with device session
 */
export async function attemptAutoLoginFromDevice(
  deviceFingerprint: string,
  groupId: string,
  travelerName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/device-sessions/auto-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceFingerprint,
        groupId,
        travelerName
      })
    })

    if (response.ok) {
      return { success: true }
    } else {
      const errorData = await response.json()
      return { success: false, error: errorData.error }
    }
  } catch (error) {
    console.error('Auto-login error:', error)
    return { success: false, error: 'Auto-login failed' }
  }
}

/**
 * Client-side logout
 */
export async function clientLogout(deviceFingerprint?: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceFingerprint })
    })

    return response.ok
  } catch (error) {
    console.error('Client logout error:', error)
    return false
  }
}