'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, MapPin, Calendar } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<TravelGroup[]>([])
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const loadGroups = async () => {
      try {
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

        // Fetch user's groups
        const response = await fetch('/api/groups/all')
        if (response.ok) {
          const data = await response.json()
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

    loadGroups()
  }, [router, supabase.auth])

  const selectGroup = async (groupId: string) => {
    try {
      // Set the selected group as current
      const response = await fetch('/api/groups/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupId }),
      })

      if (response.ok) {
        // Redirect to main app
        router.push('/app')
      } else {
        console.error('Failed to select group')
      }
    } catch (error) {
      console.error('Error selecting group:', error)
    }
  }

  if (loading) {
    return <BearGlobeLoader />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-cyan-900 to-teal-800 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-300 via-cyan-300 to-teal-200 bg-clip-text text-transparent mb-2">
            Welcome back, {userName}!
          </h1>
          <p className="text-teal-200">
            Choose which travel group you'd like to explore
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Card 
              key={group.id}
              className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl hover:bg-white/15 transition-all duration-200 cursor-pointer"
              onClick={() => selectGroup(group.id)}
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
                    selectGroup(group.id)
                  }}
                  className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-semibold"
                >
                  Enter Group
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