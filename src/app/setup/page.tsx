'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import TravelerNameSetup from '@/components/auth/TravelerNameSetup'
import BearGlobeLoader from '@/components/BearGlobeLoader'

export default function SetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [defaultName, setDefaultName] = useState('')

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push('/login')
          return
        }

        // Check if user actually needs setup and get current traveler name
        const response = await fetch('/api/groups/current')
        if (response.ok) {
          const data = await response.json()
          if (data.travelerName) {
            // Set the current traveler name as default (editable)
            setDefaultName(data.travelerName)
          } else {
            // Fallback to OAuth metadata if no traveler name exists
            const name = user.user_metadata?.full_name || 
                        user.user_metadata?.name || 
                        user.email?.split('@')[0] || 
                        'Traveler'
            setDefaultName(name)
          }
        } else {
          // Fallback to OAuth metadata if API fails
          const name = user.user_metadata?.full_name || 
                      user.user_metadata?.name || 
                      user.email?.split('@')[0] || 
                      'Traveler'
          setDefaultName(name)
        }
        
      } catch (error) {
        console.error('Error checking user:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkUser()
  }, [router, supabase.auth])

  const handleComplete = async (travelerName: string) => {
    try {
      // Update the traveler name via API
      const response = await fetch('/api/groups/current', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ travelerName }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to update traveler name')
      }

      // Redirect to app
      router.push('/app')
    } catch (error) {
      console.error('Error updating traveler name:', error)
      throw error
    }
  }

  const handleSkip = () => {
    // Skip setup and go to app with default name
    router.push('/app')
  }

  if (loading) {
    return <BearGlobeLoader />
  }

  return (
    <TravelerNameSetup
      defaultName={defaultName}
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  )
}