'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { optimizedGroupSwitcher } from '@/lib/optimizedGroupSwitch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, MapPin, Calendar, ArrowLeft } from 'lucide-react'
import BearGlobeLoader from '@/components/BearGlobeLoader'

interface TravelGroup {
  id: string
  name: string
  accessCode: string
  memberCount?: number
  role: 'leader' | 'member'
}

export default function GroupSelectionPage() {
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<TravelGroup[]>([])
  const [userName, setUserName] = useState('')
  const [selecting, setSelecting] = useState<string | null>(null)
  const [validationData, setValidationData] = useState<any>(null)

  useEffect(() => {
    const clearAllCacheAndLoadGroups = async () => {
      try {
        console.log('Groups page: Clearing ALL cache (like logout)')
        
        // COMPLETE CACHE CLEARING - as if user logged out
        
        // 1. Clear React Query cache
        await queryClient.clear()
        
        // 2. Clear localStorage data except auth (but preserve any fresh group selection)
        const authKeys = ['supabase.auth.token', 'sb-', 'auth-token']
        const allKeys = Object.keys(localStorage)
        allKeys.forEach(key => {
          const shouldKeepAuth = authKeys.some(authKey => key.includes(authKey))
          // Don't clear fresh optimized group data that might exist from a recent selection
          const isOptimizedGroupData = key === 'optimizedGroupData' || key === 'selectedGroupId'
          const isFreshOptimizedData = isOptimizedGroupData && localStorage.getItem('optimizedSwitchComplete') === 'true'
          
          if (!shouldKeepAuth && !isFreshOptimizedData) {
            localStorage.removeItem(key)
          }
        })
        
        // If we don't have fresh optimized data, clear all group-related data for a clean start
        if (localStorage.getItem('optimizedSwitchComplete') !== 'true') {
          localStorage.removeItem('selectedGroupId')
          localStorage.removeItem('optimizedGroupData')
          localStorage.removeItem('groupSelectionInProgress')
          localStorage.removeItem('groupValidationData')
          console.log('Groups page: Cleared all group data for fresh start')
        } else {
          console.log('Groups page: Preserved fresh optimized group data')
        }
        
        // 3. Clear ALL sessionStorage
        sessionStorage.clear()
        
        // 4. Force browser cache invalidation for API calls
        const cacheBuster = Date.now()
        
        // 5. Dispatch cache clear event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('completeCache Clear', { 
            detail: { timestamp: cacheBuster } 
          }))
        }

        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push('/login')
          return
        }

        // Set user name for display
        const name = user.user_metadata?.full_name || 
                    user.user_metadata?.name || 
                    user.email?.split('@')[0] || 
                    'Adventurer'
        setUserName(name)

        // Fetch user's groups with strong cache busting
        const response = await fetch(`/api/user/groups?t=${cacheBuster}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log('Groups page: Loaded fresh groups:', data.groups?.length || 0)
          setGroups(data.groups || [])
          
          // If user only has one group, redirect to app
          if (data.groups?.length === 1) {
            await selectGroup(data.groups[0].id)
            return
          }
        } else {
          console.error('Failed to fetch groups')
          router.push('/app')
        }
      } catch (error) {
        console.error('Error loading groups:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    clearAllCacheAndLoadGroups()
  }, [router, supabase.auth, queryClient])

  const selectGroup = async (groupId: string) => {
    try {
      console.log('Groups page: Starting OPTIMIZED group selection:', groupId)
      setSelecting(groupId)
      
      // Use the new optimized group switcher - single API call gets ALL data
      const groupData = await optimizedGroupSwitcher.switchToGroup(groupId, false)
      
      console.log(`Groups page: Optimized switch completed in ${groupData.performance.queryTimeMs}ms`)
      console.log('Groups page: Loaded data:', {
        trips: groupData.trips.length,
        members: groupData.allMembers.length,
        pointsOfInterest: groupData.pointsOfInterest.length,
        expenses: groupData.expensesSummary.totalExpenses
      })
      
      // Store validation data to display to user
      setValidationData({
        group: groupData.group,
        currentMember: groupData.currentMember,
        role: groupData.currentMember.role
      })

      // Store flags for GroupContext to use pre-loaded data
      localStorage.setItem('groupSelectionInProgress', 'true')
      localStorage.setItem('optimizedSwitchComplete', 'true')
      
      console.log('Groups page: Optimized data loaded, navigating to app...')
      
      // Small delay to show success feedback to user
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Navigate to app
      router.push('/app')
    } catch (error) {
      console.error('Error during optimized group selection:', error)
      setSelecting(null)
      setValidationData(null)
    }
  }

  if (loading) {
    return <BearGlobeLoader />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-cyan-900 to-teal-800 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-4xl mx-auto">
        {/* Back button */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/app')}
            className="text-teal-200 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to App
          </Button>
        </div>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-300 via-cyan-300 to-teal-200 bg-clip-text text-transparent mb-2">
            Welcome back, {userName}!
          </h1>
          <p className="text-teal-200">
            Choose which travel group you'd like to explore
          </p>
        </div>

        {/* Show validation data if selecting */}
        {selecting && validationData && (
          <div className="mb-6 bg-white/20 backdrop-blur-lg border-white/30 rounded-lg p-4">
            <div className="text-center text-white">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-white mb-2"></div>
              <p className="text-lg font-semibold">Preparing {validationData.group.name}...</p>
              <p className="text-teal-200 text-sm">Loading your trips and data</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Card 
              key={group.id}
              className={`bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl hover:bg-white/15 transition-all duration-200 cursor-pointer ${
                selecting === group.id ? 'ring-2 ring-teal-400' : ''
              }`}
              onClick={() => selecting ? null : selectGroup(group.id)}
            >
              <CardHeader className="text-center space-y-4">
                <div className="inline-block p-3 bg-gradient-to-br from-teal-400/20 to-cyan-500/20 rounded-2xl mx-auto">
                  <Users className="w-8 h-8 text-teal-300" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-white">
                    {group.name}
                  </CardTitle>
                  <CardDescription className="text-teal-200">
                    {group.role === 'leader' ? 'Group Leader' : 'Group Member'}
                  </CardDescription>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-teal-200">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">Code: {group.accessCode}</span>
                </div>
                
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!selecting) selectGroup(group.id)
                  }}
                  disabled={selecting === group.id}
                  className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-semibold disabled:opacity-50"
                >
                  {selecting === group.id ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Validating...
                    </div>
                  ) : (
                    'Enter Group'
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8">
          <p className="text-teal-300/70 text-sm">
            Need to join a new group? Contact your group leader for an invitation.
          </p>
        </div>
      </div>
    </div>
  )
}