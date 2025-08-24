'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { authConfig, getRedirectUrl } from '@/config/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface OAuthSignInProps {
  onError?: (error: string) => void
  redirectTo?: string
}

export function OAuthSignIn({ onError, redirectTo }: OAuthSignInProps) {
  const [loading, setLoading] = useState<'google' | 'github' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const supabase = createClient()

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setLoading(provider)
    setError(null)
    
    try {
      const providerConfig = authConfig.providers[provider]
      const options: any = {
        provider,
        options: {
          redirectTo: redirectTo || getRedirectUrl('callback')
        }
      }

      // Add provider-specific options
      if (provider === 'google' && 'queryParams' in providerConfig && providerConfig.queryParams) {
        options.options.queryParams = providerConfig.queryParams
      }

      const { error } = await supabase.auth.signInWithOAuth(options)
      
      if (error) throw error
    } catch (err: any) {
      const errorMessage = err.message || authConfig.messages.loginError
      setError(errorMessage)
      onError?.(errorMessage)
      setLoading(null)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading('email')
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
      
      // For consistency with OAuth flow, redirect to setup check first
      // This ensures first-time email users get proper group setup
      window.location.href = redirectTo || '/auth/setup-check'
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign in with email and password'
      setError(errorMessage)
      onError?.(errorMessage)
      setLoading(null)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-gradient-to-br from-teal-400/20 to-cyan-500/20 rounded-2xl mb-4">
            <svg className="w-12 h-12 text-teal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-300 via-cyan-300 to-teal-200 bg-clip-text text-transparent">
            Bubuful Planet
          </h1>
          <p className="text-teal-200 mt-2">Sign in to start planning your adventure</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
            {error}
          </div>
        )}

        {/* Email/Password Form */}
        {showEmailForm ? (
          <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
            <div>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/10 border-white/20 text-white placeholder:text-gray-300 focus:border-teal-400"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/10 border-white/20 text-white placeholder:text-gray-300 focus:border-teal-400"
              />
            </div>
            <Button
              type="submit"
              disabled={loading === 'email'}
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 font-semibold rounded-xl"
            >
              {loading === 'email' ? 'Signing in...' : 'Sign In'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowEmailForm(false)}
              className="w-full text-teal-200 hover:text-white"
            >
              Back to other options
            </Button>
          </form>
        ) : (
          <>
            {/* Email/Password Button */}
            <div className="mb-4">
              <button
                onClick={() => setShowEmailForm(true)}
                disabled={loading !== null}
                className="w-full py-4 px-6 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
                Sign in with Email
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-transparent px-4 text-teal-200">or continue with</span>
              </div>
            </div>

            {/* OAuth Buttons */}
            <div className="space-y-4">
              <button
                onClick={() => handleOAuthLogin('google')}
                disabled={loading !== null}
                className="w-full py-4 px-6 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading === 'google' ? 'Connecting...' : 'Continue with Google'}
              </button>
              
              <button
                onClick={() => handleOAuthLogin('github')}
                disabled={loading !== null}
                className="w-full py-4 px-6 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                {loading === 'github' ? 'Connecting...' : 'Continue with GitHub'}
              </button>
            </div>
          </>
        )}

        {/* Security Note */}
        <div className="mt-8 pt-8 border-t border-white/20">
          <p className="text-center text-sm text-teal-200">
            Secure authentication powered by Supabase
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="mt-8 grid grid-cols-3 gap-4 text-center">
        <FeatureCard icon="🌍" text="Plan Trips" />
        <FeatureCard icon="👥" text="Collaborate" />
        <FeatureCard icon="💰" text="Track Expenses" />
      </div>
    </div>
  )
}

function FeatureCard({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-xs text-teal-200">{text}</p>
    </div>
  )
}