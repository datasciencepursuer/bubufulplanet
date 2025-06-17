'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface GroupMember {
  id: string
  traveler_name: string
  role: 'adventurer' | 'party member'
  permissions: {
    read: boolean
    create: boolean
    modify: boolean
  }
  joined_at: string
}

export default function GroupSettings() {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newMemberName, setNewMemberName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [currentTravelerName, setCurrentTravelerName] = useState('')
  const router = useRouter()

  useEffect(() => {
    // Get current traveler name from cookies
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
    }
    
    const travelerName = getCookie('vacation-planner-traveler-name')
    if (travelerName) {
      setCurrentTravelerName(travelerName)
    }
    
    fetchMembers()
  }, [])

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/groups/members')
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members)
      } else {
        setError('Failed to load group members')
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const updatePermissions = async (memberId: string, permissions: { read: boolean; create: boolean; modify: boolean }) => {
    try {
      const response = await fetch('/api/groups/members', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId, permissions }),
      })

      if (response.ok) {
        // Update local state
        setMembers(members.map(member => 
          member.id === memberId ? { ...member, permissions } : member
        ))
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update permissions')
      }
    } catch (err) {
      setError('An error occurred')
    }
  }

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberName.trim()) return

    setIsAdding(true)
    setError('')

    try {
      const response = await fetch('/api/groups/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ travelerName: newMemberName.trim() }),
      })

      if (response.ok) {
        setNewMemberName('')
        fetchMembers() // Refresh the list
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to add member')
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setIsAdding(false)
    }
  }

  const currentUserRole = members.find(m => m.traveler_name === currentTravelerName)?.role || 'party member'
  const isLeader = currentUserRole === 'adventurer'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button 
            onClick={() => router.push('/app')}
            variant="outline"
            className="mb-4"
          >
            ← Back to Dashboard
          </Button>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-teal-800">Group Settings</CardTitle>
              <CardDescription>
                Manage group members and their permissions
                {!isLeader && " (View Only - Leaders can modify permissions)"}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {isLeader && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Add New Member</CardTitle>
              <CardDescription>
                Add a new traveler to your group
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={addMember} className="flex gap-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Enter traveler name"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                  disabled={isAdding}
                />
                <Button 
                  type="submit" 
                  disabled={isAdding || !newMemberName.trim()}
                >
                  {isAdding ? 'Adding...' : 'Add Member'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Group Members</CardTitle>
            <CardDescription>
              Manage permissions for each group member
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {members.map((member) => (
                <div key={member.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{member.traveler_name}</h3>
                      <p className="text-sm text-gray-500">
                        {member.role === 'adventurer' ? 'Leader' : 'Follower'} • 
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                    {member.role === 'adventurer' && (
                      <span className="px-2 py-1 bg-teal-100 text-teal-800 text-xs rounded-full">
                        Leader
                      </span>
                    )}
                  </div>

                  {member.role !== 'adventurer' && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Permissions:</p>
                      <div className="flex gap-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={member.permissions.read}
                            onChange={(e) => updatePermissions(member.id, {
                              ...member.permissions,
                              read: e.target.checked
                            })}
                            disabled={!isLeader}
                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-700">Read</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={member.permissions.create}
                            onChange={(e) => updatePermissions(member.id, {
                              ...member.permissions,
                              create: e.target.checked
                            })}
                            disabled={!isLeader}
                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-700">Create</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={member.permissions.modify}
                            onChange={(e) => updatePermissions(member.id, {
                              ...member.permissions,
                              modify: e.target.checked
                            })}
                            disabled={!isLeader}
                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-700">Modify</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}