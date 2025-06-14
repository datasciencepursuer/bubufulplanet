'use client'

import { useState } from 'react'
import { useDeviceSession } from '@/hooks/useDeviceSession'

export function DeviceSessionDemo() {
  const {
    deviceInfo,
    availableSessions,
    recentGroups,
    isLoading,
    error,
    attemptAutoLogin,
    getMostRecentSession
  } = useDeviceSession()

  const [autoLoginResult, setAutoLoginResult] = useState<string>('')

  const handleAutoLogin = async (groupId: string, travelerName: string) => {
    const result = await attemptAutoLogin(groupId, travelerName)
    if (result.success) {
      setAutoLoginResult(`Auto-login successful! Logged in as ${result.currentMember?.name} in ${result.group?.name}`)
    } else {
      setAutoLoginResult(`Auto-login failed: ${result.error}`)
    }
  }

  const handleQuickAutoLogin = async () => {
    const mostRecent = getMostRecentSession()
    if (mostRecent) {
      await handleAutoLogin(mostRecent.groupId, mostRecent.travelerName)
    }
  }

  if (isLoading) return <div className="p-4">Loading device session...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Device Session Demo</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Device Info */}
      <div className="bg-gray-50 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Device Information</h2>
        {deviceInfo ? (
          <div className="space-y-1 text-sm">
            <div><strong>Fingerprint:</strong> {deviceInfo.fingerprint}</div>
            <div><strong>Platform:</strong> {deviceInfo.platform}</div>
            <div><strong>Screen:</strong> {deviceInfo.screen}</div>
            <div><strong>Timezone:</strong> {deviceInfo.timezone}</div>
            <div><strong>Language:</strong> {deviceInfo.language}</div>
          </div>
        ) : (
          <div>No device info available</div>
        )}
      </div>

      {/* Available Sessions */}
      <div className="bg-blue-50 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Available Auto-Login Sessions</h2>
        {availableSessions.length > 0 ? (
          <div className="space-y-2">
            {availableSessions.map((session, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                <div>
                  <div className="font-medium">{session.groupName}</div>
                  <div className="text-sm text-gray-600">
                    {session.travelerName} ({session.role})
                  </div>
                  <div className="text-xs text-gray-500">
                    Last login: {new Date(session.lastLogin).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleAutoLogin(session.groupId, session.travelerName)}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Auto Login
                </button>
              </div>
            ))}
            
            {availableSessions.length > 0 && (
              <button
                onClick={handleQuickAutoLogin}
                className="w-full mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Quick Login (Most Recent)
              </button>
            )}
          </div>
        ) : (
          <div className="text-gray-600">No saved sessions available. Login to a group first.</div>
        )}
      </div>

      {/* Recent Groups (from localStorage) */}
      <div className="bg-yellow-50 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Recent Groups (Local Storage)</h2>
        {recentGroups.length > 0 ? (
          <div className="space-y-2">
            {recentGroups.map((group, index) => (
              <div key={index} className="p-2 bg-white rounded border">
                <div className="font-medium">{group.groupName}</div>
                <div className="text-sm text-gray-600">
                  {group.travelerName} ({group.role}) - Code: {group.accessCode}
                </div>
                <div className="text-xs text-gray-500">
                  Last accessed: {new Date(group.lastAccessed).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-600">No recent groups</div>
        )}
      </div>

      {/* Auto-login Result */}
      {autoLoginResult && (
        <div className="bg-green-50 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Auto-Login Result</h2>
          <div className="text-sm">{autoLoginResult}</div>
        </div>
      )}

      {/* Manual Test Buttons */}
      <div className="bg-gray-50 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Manual Testing</h2>
        <div className="space-y-2">
          <div className="text-sm text-gray-600 mb-2">
            Create or join a group first, then refresh this page to see auto-login options.
          </div>
          <div className="space-x-2">
            <a 
              href="/api/groups/create" 
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Test Group Creation API
            </a>
            <a 
              href="/api/groups/join" 
              className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Test Group Join API
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}