'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDeviceSession } from '@/hooks/useDeviceSession'

interface AutoLoginButtonProps {
  className?: string
  showDivider?: boolean
}

export function AutoLoginButton({ className = '', showDivider = false }: AutoLoginButtonProps) {
  const router = useRouter()
  const {
    isLoading,
    availableSessions,
    getMostRecentSession,
    attemptAutoLogin
  } = useDeviceSession()

  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mostRecentSession = getMostRecentSession()

  // Don't show button if no sessions available or still loading
  if (isLoading || !mostRecentSession || availableSessions.length === 0) {
    return null
  }

  const handleAutoLogin = async () => {
    if (!mostRecentSession) return

    setIsAutoLoggingIn(true)
    setError(null)

    try {
      const result = await attemptAutoLogin(
        mostRecentSession.groupId,
        mostRecentSession.travelerName
      )

      if (result.success) {
        // Redirect to the main app
        router.push('/app')
      } else {
        setError(result.error || 'Auto-login failed')
      }
    } catch (err) {
      setError('Auto-login failed')
      console.error('Auto-login error:', err)
    } finally {
      setIsAutoLoggingIn(false)
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        onClick={handleAutoLogin}
        disabled={isAutoLoggingIn}
        className={`
          w-full flex items-center justify-center gap-3 px-6 py-3 
          bg-gradient-to-r from-teal-600 to-teal-700 
          hover:from-teal-700 hover:to-teal-800 
          disabled:from-gray-400 disabled:to-gray-500
          text-white font-medium rounded-lg
          transition-all duration-200 shadow-md hover:shadow-lg
          ${isAutoLoggingIn ? 'cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {isAutoLoggingIn ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            Logging in...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Continue as {mostRecentSession.travelerName}
          </>
        )}
      </button>
      
      <div className="text-center text-sm text-white">
        <div className="font-medium">{mostRecentSession.groupName}</div>
        <div className="text-xs text-white/80">
          Last accessed: {new Date(mostRecentSession.lastLogin).toLocaleDateString()}
        </div>
      </div>

      {error && (
        <div className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      
      {showDivider && (
        <div className="relative mt-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-gray-500">or</span>
          </div>
        </div>
      )}
    </div>
  )
}