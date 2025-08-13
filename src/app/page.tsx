'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function Home() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // User is authenticated, redirect to app
        router.push('/app')
      } else {
        // User is not authenticated, redirect to login
        router.push('/login')
      }
    }
    
    checkAuth()
  }, [router, supabase.auth])

  // Loading state while checking auth
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-cyan-900 to-teal-800 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-300 border-t-transparent"></div>
        <p className="mt-4 text-teal-200">Loading...</p>
      </div>
    </div>
  )
}