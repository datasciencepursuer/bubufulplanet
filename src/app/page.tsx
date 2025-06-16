'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AutoLoginButton } from '@/components/AutoLoginButton'
import { AccessCodeConfirmation } from '@/components/AccessCodeConfirmation'
import { generateDeviceFingerprint } from '@/lib/device-fingerprint'

type Mode = 'select' | 'create' | 'join' | 'confirm'

interface GroupMember {
  name: string
  role: 'adventurer' | 'party member'
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('select')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Create Group Form State
  const [groupName, setGroupName] = useState('')
  const [members, setMembers] = useState<GroupMember[]>([{ name: '', role: 'adventurer' }])

  // Join Group Form State
  const [accessCode, setAccessCode] = useState('')
  const [travelerName, setTravelerName] = useState('')

  // Confirmation State
  const [createdGroup, setCreatedGroup] = useState<{
    name: string
    accessCode: string
    adventurerName: string
  } | null>(null)

  const addMember = () => {
    setMembers([...members, { name: '', role: 'party member' }])
  }

  const updateMember = (index: number, field: keyof GroupMember, value: string) => {
    const updated = [...members]
    updated[index] = { ...updated[index], [field]: value }
    setMembers(updated)
  }

  const removeMember = (index: number) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index))
    }
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Generate device fingerprint for session saving
      const deviceInfo = generateDeviceFingerprint()
      
      const response = await fetch('/api/groups/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupName,
          members: members.filter(m => m.name.trim()),
          deviceFingerprint: deviceInfo.fingerprint
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Store the created group data and show confirmation
        setCreatedGroup({
          name: data.group.name,
          accessCode: data.group.accessCode,
          adventurerName: data.currentMember.name
        })
        setMode('confirm')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to create group')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Generate device fingerprint for session saving
      const deviceInfo = generateDeviceFingerprint()
      
      const response = await fetch('/api/groups/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessCode,
          travelerName,
          deviceFingerprint: deviceInfo.fingerprint
        }),
      })

      if (response.ok) {
        router.push('/app')
      } else {
        const data = await response.json()
        setError(data.error || 'Invalid access code or traveler name')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setError('')
    setGroupName('')
    setMembers([{ name: '', role: 'adventurer' }])
    setAccessCode('')
    setTravelerName('')
    setCreatedGroup(null)
  }

  const handleContinueToApp = () => {
    router.push('/app')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 p-4">
      <div className="w-full max-w-lg">
        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-teal-800 to-teal-600 bg-clip-text text-transparent">
              Vacation Planner
            </CardTitle>
            <CardDescription className="text-gray-600">
              {mode === 'select' && 'Choose how to get started'}
              {mode === 'create' && 'Create a new travel group'}
              {mode === 'join' && 'Join an existing travel group'}
              {mode === 'confirm' && 'Save your access code for future use'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'select' && (
              <div className="space-y-4">
                {/* Auto-login button - only shows if previous sessions exist */}
                <AutoLoginButton showDivider={true} />
                
                <Button 
                  onClick={() => setMode('create')}
                  className="w-full"
                  size="lg"
                  variant="default"
                >
                  Create Travel Group
                </Button>
                <Button 
                  onClick={() => setMode('join')}
                  className="w-full"
                  size="lg"
                  variant="outline"
                >
                  Join Existing Group
                </Button>
              </div>
            )}

            {mode === 'create' && (
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="groupName" className="text-sm font-medium text-gray-700">
                    Group Name
                  </label>
                  <input
                    id="groupName"
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Enter group name"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 focus:outline-none transition-all duration-200"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">
                    Group Members
                  </label>
                  {members.map((member, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => updateMember(index, 'name', e.target.value)}
                          placeholder="Traveler name"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 focus:outline-none transition-all duration-200"
                          required
                          disabled={loading}
                        />
                      </div>
                      <div className="w-28">
                        <select
                          value={member.role}
                          onChange={(e) => updateMember(index, 'role', e.target.value as 'adventurer' | 'follower')}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 focus:outline-none transition-all duration-200"
                          disabled={index === 0 || loading}
                        >
                          <option value="adventurer">Leader</option>
                          <option value="follower">Follower</option>
                        </select>
                      </div>
                      {members.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => removeMember(index)}
                          variant="outline"
                          size="sm"
                          className="px-3"
                          disabled={loading}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    onClick={addMember}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={loading}
                  >
                    + Add Member
                  </Button>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => { setMode('select'); resetForm(); }}
                    variant="outline"
                    className="flex-1"
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={loading || !groupName.trim() || !members[0].name.trim()}
                  >
                    {loading ? 'Creating...' : 'Create Group'}
                  </Button>
                </div>
              </form>
            )}

            {mode === 'join' && (
              <form onSubmit={handleJoinGroup} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="accessCode" className="text-sm font-medium text-gray-700">
                    Access Code
                  </label>
                  <input
                    id="accessCode"
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Enter group access code"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 focus:outline-none transition-all duration-200"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="travelerName" className="text-sm font-medium text-gray-700">
                    Your Traveler Name
                  </label>
                  <input
                    id="travelerName"
                    type="text"
                    value={travelerName}
                    onChange={(e) => setTravelerName(e.target.value)}
                    placeholder="Enter your traveler name"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 focus:outline-none transition-all duration-200"
                    required
                    disabled={loading}
                  />
                </div>
                
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => { setMode('select'); resetForm(); }}
                    variant="outline"
                    className="flex-1"
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={loading || !accessCode.trim() || !travelerName.trim()}
                  >
                    {loading ? 'Joining...' : 'Join Group'}
                  </Button>
                </div>
              </form>
            )}

            {mode === 'confirm' && createdGroup && (
              <AccessCodeConfirmation
                groupName={createdGroup.name}
                accessCode={createdGroup.accessCode}
                adventurerName={createdGroup.adventurerName}
                onContinue={handleContinueToApp}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}