'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AutoLoginButton } from '@/components/AutoLoginButton'
import { useDeviceSession } from '@/hooks/useDeviceSession'
import { generateDeviceFingerprint, getStoredDeviceFingerprint, storeDeviceFingerprint } from '@/lib/device-fingerprint'

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
  const { availableSessions, getMostRecentSession } = useDeviceSession()

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
      // Get or generate device fingerprint for session saving
      let deviceInfo = getStoredDeviceFingerprint()
      if (!deviceInfo) {
        deviceInfo = generateDeviceFingerprint()
        storeDeviceFingerprint(deviceInfo)
      }
      
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
      // Get or generate device fingerprint for session saving
      let deviceInfo = getStoredDeviceFingerprint()
      if (!deviceInfo) {
        deviceInfo = generateDeviceFingerprint()
        storeDeviceFingerprint(deviceInfo)
      }
      
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
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-cyan-900 to-teal-800">
      {/* Hero Section with Planet */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">
        {/* Background Stars */}
        <div className="absolute inset-0 opacity-60">
          <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-teal-200 rounded-full animate-pulse"></div>
          <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-cyan-200 rounded-full animate-pulse delay-100"></div>
          <div className="absolute top-2/3 left-1/6 w-0.5 h-0.5 bg-white rounded-full animate-pulse delay-200"></div>
          <div className="absolute bottom-1/4 right-1/4 w-1 h-1 bg-teal-300 rounded-full animate-pulse delay-300"></div>
          <div className="absolute top-1/6 right-1/6 w-0.5 h-0.5 bg-cyan-300 rounded-full animate-pulse delay-500"></div>
          <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-teal-200 rounded-full animate-pulse delay-700"></div>
        </div>
        
        <div className="relative z-10 w-full max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Planet */}
            <div className="flex flex-col items-center text-center lg:text-left">
              <div className="relative mb-8">
                {/* Planet with glow effect */}
                <div className="relative w-64 h-64 lg:w-80 lg:h-80 mx-auto lg:mx-0">
                  {/* Outer glow */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-teal-400/30 via-cyan-500/30 to-teal-500/30 blur-2xl animate-pulse"></div>
                  
                  {/* Planet surface */}
                  <div className="relative w-full h-full rounded-full overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-400 via-cyan-500 to-teal-600 animate-slow-spin"></div>
                    
                    
                    {/* Cloud layers */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-drift"></div>
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/10 to-transparent animate-drift-reverse"></div>
                    
                    {/* Atmospheric glow */}
                    <div className="absolute inset-0 rounded-full border-4 border-white/30 shadow-inner"></div>
                  </div>
                  
                  {/* Orbiting ring */}
                  <div className="absolute inset-0 rounded-full border-4 border-teal-800/90 animate-orbit shadow-lg" style={{transform: 'rotateX(75deg)'}}></div>
                </div>
              </div>
              
              {/* Brand and Tagline */}
              <div className="space-y-4">
                <h1 className="text-4xl lg:text-6xl font-bold bg-gradient-to-r from-teal-300 via-cyan-300 to-teal-200 bg-clip-text text-transparent leading-tight">
                  Bubuful Planet
                </h1>
                <p className="text-lg lg:text-xl text-teal-100 font-light leading-relaxed">
                  Plan it beautifully
                </p>
              </div>
            </div>
            
            {/* Right Side - Action Cards */}
            <div className="space-y-6">
              {mode === 'select' && (
                <div className="space-y-6">
                  {/* Auto-login section - only show if sessions are available */}
                  {getMostRecentSession() && availableSessions.length > 0 && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                      <AutoLoginButton showDivider={false} />
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="space-y-4">
                    <button 
                      onClick={() => setMode('create')}
                      className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 backdrop-blur-sm"
                    >
                      Create Travel Group
                    </button>
                    <button 
                      onClick={() => setMode('join')}
                      className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-4 px-6 rounded-xl border border-white/30 hover:border-white/50 backdrop-blur-sm transition-all duration-300"
                    >
                      Join Existing Group
                    </button>
                  </div>
                </div>
              )}
              
              {(mode === 'create' || mode === 'join' || mode === 'confirm') && (
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <div className="space-y-1 text-center mb-6">
                    <h3 className="text-2xl font-bold text-white">
                      {mode === 'create' && 'Create a new travel group'}
                      {mode === 'join' && 'Join an existing travel group'}
                      {mode === 'confirm' && 'Save your access code for future use'}
                    </h3>
                    <p className="text-teal-200">
                      {mode === 'create' && 'Start planning your adventures together'}
                      {mode === 'join' && 'Enter your group details to get started'}
                      {mode === 'confirm' && 'Keep this information safe for future access'}
                    </p>
                  </div>

                  {mode === 'create' && (
                    <form onSubmit={handleCreateGroup} className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="groupName" className="text-sm font-medium text-white">
                          Group Name
                        </label>
                        <input
                          id="groupName"
                          type="text"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="Enter group name"
                          className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/70 focus:bg-white/30 focus:border-white/50 focus:outline-none transition-all duration-200"
                          required
                          disabled={loading}
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-medium text-white">
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
                                className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/70 focus:bg-white/30 focus:border-white/50 focus:outline-none transition-all duration-200"
                                required
                                disabled={loading}
                              />
                            </div>
                            <div className="w-36">
                              <select
                                value={member.role}
                                onChange={(e) => updateMember(index, 'role', e.target.value as 'adventurer' | 'party member')}
                                className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white focus:bg-white/30 focus:border-white/50 focus:outline-none transition-all duration-200 text-sm"
                                disabled={index === 0 || loading}
                              >
                                <option value="adventurer" className="bg-teal-800 text-white">Adventurer</option>
                                <option value="party member" className="bg-teal-800 text-white">Party Member</option>
                              </select>
                            </div>
                            {members.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeMember(index)}
                                className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg transition-all duration-200"
                                disabled={loading}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addMember}
                          className="w-full py-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg transition-all duration-200"
                          disabled={loading}
                        >
                          + Add Member
                        </button>
                      </div>

                      {error && (
                        <div className="p-3 rounded-lg bg-red-900/50 border border-red-500/50">
                          <p className="text-sm text-red-200">{error}</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setMode('select'); resetForm(); }}
                          className="flex-1 py-3 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg transition-all duration-200"
                          disabled={loading}
                        >
                          Back
                        </button>
                        <button 
                          type="submit" 
                          className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
                          disabled={loading || !groupName.trim() || !members[0].name.trim()}
                        >
                          {loading ? 'Creating...' : 'Create Group'}
                        </button>
                      </div>
                    </form>
                  )}

                  {mode === 'join' && (
                    <form onSubmit={handleJoinGroup} className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="accessCode" className="text-sm font-medium text-white">
                          Access Code
                        </label>
                        <input
                          id="accessCode"
                          type="text"
                          value={accessCode}
                          onChange={(e) => setAccessCode(e.target.value)}
                          placeholder="Enter group access code"
                          className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/70 focus:bg-white/30 focus:border-white/50 focus:outline-none transition-all duration-200"
                          required
                          disabled={loading}
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="travelerName" className="text-sm font-medium text-white">
                          Your Traveler Name
                        </label>
                        <input
                          id="travelerName"
                          type="text"
                          value={travelerName}
                          onChange={(e) => setTravelerName(e.target.value)}
                          placeholder="Enter your traveler name"
                          className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/70 focus:bg-white/30 focus:border-white/50 focus:outline-none transition-all duration-200"
                          required
                          disabled={loading}
                        />
                      </div>
                      
                      {error && (
                        <div className="p-3 rounded-lg bg-red-900/50 border border-red-500/50">
                          <p className="text-sm text-red-200">{error}</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setMode('select'); resetForm(); }}
                          className="flex-1 py-3 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg transition-all duration-200"
                          disabled={loading}
                        >
                          Back
                        </button>
                        <button 
                          type="submit" 
                          className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
                          disabled={loading || !accessCode.trim() || !travelerName.trim()}
                        >
                          {loading ? 'Joining...' : 'Join Group'}
                        </button>
                      </div>
                    </form>
                  )}

                  {mode === 'confirm' && createdGroup && (
                    <div className="text-center space-y-4">
                      <div className="p-4 bg-teal-800/50 rounded-lg border border-teal-500/50">
                        <h4 className="text-lg font-semibold text-white mb-2">Group Created Successfully!</h4>
                        <p className="text-teal-200 mb-4">
                          Welcome {createdGroup.adventurerName}! Your group "{createdGroup.name}" has been created.
                        </p>
                        <div className="bg-white/20 p-3 rounded-lg">
                          <p className="text-sm text-white mb-1">Your Access Code:</p>
                          <p className="text-xl font-mono font-bold text-teal-200">{createdGroup.accessCode}</p>
                          <p className="text-xs text-teal-300 mt-2">Share this code with your travel companions</p>
                        </div>
                      </div>
                      <button
                        onClick={handleContinueToApp}
                        className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-semibold rounded-lg transition-all duration-200"
                      >
                        Continue to App
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}