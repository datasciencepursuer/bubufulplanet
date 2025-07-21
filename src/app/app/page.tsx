'use client'

import { useState, useEffect, useMemo } from 'react'
import AppMonthlyCalendar from '@/components/AppMonthlyCalendar'
import MobileTripsList from '@/components/MobileTripsList'
import TripForm from '@/components/TripForm'
import AllTripsView from '@/components/TripUtilities/AllTripsView'
import ExpensesView from '@/components/TripUtilities/ExpensesView'
import PointsOfInterestView from '@/components/TripUtilities/PointsOfInterestView'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Calendar as CalendarIcon, DollarSign, Settings, ArrowLeft, Plus, LogOut, Trash2, Clock, Users, Copy, Check } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import BearGlobeLoader from '@/components/BearGlobeLoader'
import { useDeviceSession } from '@/hooks/useDeviceSession'
import { useNotify } from '@/hooks/useNotify'

export default function AppPage() {
  const { warning } = useNotify()
  const [showTripForm, setShowTripForm] = useState(false)
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date } | null>(null)
  const [loading, setLoading] = useState(true)
  const [trips, setTrips] = useState<any[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [tripToDelete, setTripToDelete] = useState<{id: string, name: string} | null>(null)
  const [groupInfo, setGroupInfo] = useState<{
    name: string, 
    accessCode: string, 
    travelerName?: string, 
    role?: string,
    permissions?: {
      read: boolean
      create: boolean
      modify: boolean
    }
  } | null>(null)
  const [accessCodeCopied, setAccessCodeCopied] = useState(false)
  const [editingTrip, setEditingTrip] = useState<any>(null)
  const router = useRouter()
  const { logout } = useDeviceSession()

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true)
      try {
        await Promise.all([loadTrips(), loadGroupInfo()])
      } finally {
        setLoading(false)
      }
    }
    loadInitialData()
  }, [])

  const loadTrips = async () => {
    try {
      const response = await fetch('/api/trips')
      if (response.ok) {
        const data = await response.json()
        setTrips(data.trips || [])
      }
    } catch (error) {
      console.error('Error loading trips:', error)
    }
  }

  const loadGroupInfo = async () => {
    try {
      const response = await fetch('/api/groups/current')
      if (response.ok) {
        const data = await response.json()
        setGroupInfo({
          name: data.group.name,
          accessCode: data.group.accessCode,
          travelerName: data.travelerName,
          role: data.role,
          permissions: data.currentMember?.permissions || {
            read: true,
            create: data.role === 'adventurer',
            modify: data.role === 'adventurer'
          }
        })
      }
    } catch (error) {
      console.error('Error loading group info:', error)
    }
  }

  const handleTripSelect = (start: Date, end: Date) => {
    // Check if user has create permission
    if (!groupInfo?.permissions?.create) {
      warning('Permission Denied', 'You do not have permission to create trips. Please ask your group adventurer for permission.')
      return
    }
    setSelectedDates({ start, end })
    setShowTripForm(true)
  }

  const handleCopyAccessCode = async () => {
    if (!groupInfo?.accessCode) return

    try {
      await navigator.clipboard.writeText(groupInfo.accessCode)
      setAccessCodeCopied(true)
      setTimeout(() => setAccessCodeCopied(false), 2000)
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = groupInfo.accessCode
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setAccessCodeCopied(true)
      setTimeout(() => setAccessCodeCopied(false), 2000)
    }
  }

  const handleCreateTrip = () => {
    // Check if user has create permission
    if (!groupInfo?.permissions?.create) {
      alert('You do not have permission to create trips. Please ask your group adventurer for permission.')
      return
    }
    // Set default dates to tomorrow and day after for user to adjust
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date()
    dayAfter.setDate(dayAfter.getDate() + 2)
    
    setSelectedDates({ start: tomorrow, end: dayAfter })
    setEditingTrip(null)
    setShowTripForm(true)
  }

  const handleEditTrip = (trip: any) => {
    // Check if user has modify permission
    if (!groupInfo?.permissions?.modify) {
      alert('You do not have permission to edit trips. Please ask your group adventurer for permission.')
      return
    }
    setEditingTrip(trip)
    setShowTripForm(true)
  }

  const handleLogout = async () => {
    try {
      const success = await logout()
      if (success) {
        router.push('/')
        router.refresh()
      } else {
        console.error('Logout failed')
      }
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const handleTripSubmit = async (tripData: {
    name: string
    destination: string
    startDate: string
    endDate: string
  }) => {
    const isEdit = !!editingTrip
    try {
      const url = isEdit ? `/api/trips/${editingTrip.id}` : '/api/trips'
      const method = isEdit ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tripData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      // Reload trips after creating/updating
      await loadTrips()
      setEditingTrip(null)
      setShowTripForm(false)
      
      // Only navigate to trip page for new trips
      if (!isEdit) {
        const { trip } = await response.json()
        router.push(`/trips/${trip.id}`)
      }
    } catch (error) {
      console.error(isEdit ? 'Error updating trip:' : 'Error creating trip:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to ${isEdit ? 'update' : 'create'} trip: ${errorMessage}`)
    }
  }

  const handleDeleteTripClick = (tripId: string, tripName: string, event: React.MouseEvent) => {
    event.stopPropagation()
    // Check if user has modify permission
    if (!groupInfo?.permissions?.modify) {
      alert('You do not have permission to delete trips. Please ask your group adventurer for permission.')
      return
    }
    setTripToDelete({ id: tripId, name: tripName })
    setShowDeleteConfirm(true)
  }

  const handleDeleteTripConfirm = async () => {
    if (!tripToDelete) return

    try {
      const response = await fetch(`/api/trips/${tripToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete trip')
      }

      await loadTrips()
      setTripToDelete(null)
    } catch (error) {
      console.error('Error deleting trip:', error)
      alert('Failed to delete trip. Please try again.')
    }
  }

  const handleDeleteTripFromEdit = () => {
    if (!editingTrip) return
    
    // Check if user has modify permission
    if (!groupInfo?.permissions?.modify) {
      alert('You do not have permission to delete trips. Please ask your group adventurer for permission.')
      return
    }
    
    // Use the existing delete confirmation flow
    setTripToDelete({ id: editingTrip.id, name: editingTrip.name })
    setShowTripForm(false) // Close the edit modal
    setShowDeleteConfirm(true)
  }

  // Categorize trips as current, upcoming, or past
  const { currentTrip, upcomingTrips, pastTrips } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const sorted = [...trips].sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )
    
    const current = sorted.find(trip => {
      const startDate = new Date(trip.startDate)
      const endDate = new Date(trip.endDate)
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)
      return today >= startDate && today <= endDate
    })
    
    const upcoming = sorted.filter(trip => {
      const startDate = new Date(trip.startDate)
      startDate.setHours(0, 0, 0, 0)
      return startDate > today && trip.id !== current?.id
    })
    
    const past = sorted.filter(trip => {
      const endDate = new Date(trip.endDate)
      endDate.setHours(23, 59, 59, 999)
      return endDate < today
    }).reverse() // Most recent past trips first
    
    return { currentTrip: current || null, upcomingTrips: upcoming, pastTrips: past }
  }, [trips])

  if (loading) {
    return <BearGlobeLoader />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* App Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 lg:gap-4 min-w-0 flex-1">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/')}
                className="gap-1 lg:gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> 
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base lg:text-lg font-semibold truncate">
                  {groupInfo ? groupInfo.name : 'My Trips'}
                </h1>
                {groupInfo && (
                  <div className="flex items-center gap-2 text-xs lg:text-sm text-gray-500">
                    <span className="hidden sm:inline">Access Code:</span>
                    <span className="font-mono font-medium">{groupInfo.accessCode}</span>
                    <button
                      onClick={handleCopyAccessCode}
                      className="relative inline-flex items-center justify-center w-5 h-5 text-gray-400 hover:text-teal-600 transition-colors duration-200 rounded-sm hover:bg-teal-50"
                      title={accessCodeCopied ? "Copied!" : "Copy access code"}
                    >
                      {accessCodeCopied ? (
                        <Check className="w-4 h-4 text-teal-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {accessCodeCopied && (
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-teal-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                          Copied!
                        </div>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Center Brand - Hide on small screens */}
            <div className="hidden lg:flex flex-col items-center justify-center">
              <h2 className="text-xl font-bold bg-gradient-to-r from-teal-800 to-teal-600 bg-clip-text text-transparent">
                Bubuful Planet
              </h2>
              <p className="text-xs text-gray-500 italic">
                Plan it beautifully
              </p>
            </div>
            
            <div className="flex items-center gap-1 lg:gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/group-settings')}
                className="gap-1 lg:gap-2"
              >
                <Users className="w-4 h-4" /> 
                <span className="hidden sm:inline">Group Settings</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
                className="gap-1 lg:gap-2"
              >
                <LogOut className="w-4 h-4" /> 
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4 lg:space-y-4">
            {/* Group Title and Welcome */}
            <div className="mb-4 lg:mb-6">
              {/* Mobile: Simple title */}
              <div className="lg:hidden mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Your Trips
                </h2>
                {groupInfo && groupInfo.travelerName && (
                  <p className="text-sm text-gray-600 mt-1">
                    Welcome {groupInfo.role === 'adventurer' ? 'Adventurer' : 'Party Member'} {groupInfo.travelerName}!
                  </p>
                )}
              </div>

              {/* Desktop: Full layout */}
              <div className="hidden lg:flex lg:justify-between lg:items-start space-y-4 lg:space-y-0">
                <div>
                  <h2 className="text-3xl font-bold mb-2">
                    {groupInfo ? `${groupInfo.name} - Plan Your Trips` : 'Plan Your Trips'}
                  </h2>
                  <p className="text-gray-600">
                    Drag and select dates on the calendar to create a new trip
                  </p>
                </div>
                
                {/* Welcome Card */}
                {(() => {
                  console.log('Welcome card render check:', { groupInfo, travelerName: groupInfo?.travelerName, role: groupInfo?.role })
                  return groupInfo && groupInfo.travelerName && (
                    <Card className="bg-teal-50 border-teal-200 max-w-sm flex-shrink-0">
                      <CardContent className="pt-4">
                        <p className="text-lg text-teal-700 font-medium">
                          Welcome {groupInfo.role === 'adventurer' ? 'Adventurer' : 'Party Member'} {groupInfo.travelerName}!
                        </p>
                      </CardContent>
                    </Card>
                  )
                })()}
              </div>
            </div>
            
            {/* Desktop Trip Management */}
            <div className="hidden lg:block">
              {/* Next Trip Card - Moved from utility cards */}
              <AllTripsView 
                trips={trips} 
                onTripsChange={loadTrips}
                onEditTrip={handleEditTrip}
              />
              
              <AppMonthlyCalendar 
                onTripSelect={handleTripSelect}
                onCreateTrip={handleCreateTrip}
                existingTrips={trips.map(trip => ({
                  id: trip.id,
                  title: trip.name,
                  start: trip.startDate,
                  end: trip.endDate
                }))}
              />
            </div>

            {/* Mobile Trip Management */}
            <div className="lg:hidden space-y-6">
              <MobileTripsList
                trips={trips}
                onTripClick={(tripId) => router.push(`/trips/${tripId}`)}
                onCreateTrip={handleCreateTrip}
                onEditTrip={handleEditTrip}
                onDeleteTrip={handleDeleteTripClick}
                permissions={groupInfo?.permissions}
              />
              
              {/* Mobile Utility Sections */}
              <div className="space-y-4">
                <PointsOfInterestView className="w-full" />
                <ExpensesView className="w-full" />
              </div>
            </div>
          </div>
          
          {/* Desktop Utility Sidebar */}
          <div className="hidden lg:flex h-full flex-col space-y-4">
            <div className="flex-1 flex flex-col space-y-4">
              <PointsOfInterestView className="flex-1" />
              <ExpensesView className="flex-1" />
            </div>
          </div>
        </div>
      </div>

      {showTripForm && (editingTrip || selectedDates) && (
        <TripForm
          startDate={editingTrip ? new Date(editingTrip.startDate) : selectedDates!.start}
          endDate={editingTrip ? new Date(editingTrip.endDate) : selectedDates!.end}
          onSubmit={handleTripSubmit}
          onCancel={() => {
            setShowTripForm(false)
            setEditingTrip(null)
            setSelectedDates(null)
          }}
          onDelete={editingTrip ? handleDeleteTripFromEdit : undefined}
          open={showTripForm}
          isEdit={!!editingTrip}
          allowDateEdit={!editingTrip} // Allow date editing in create mode
          existingTrip={editingTrip ? {
            id: editingTrip.id,
            name: editingTrip.name,
            destination: editingTrip.destination,
            startDate: new Date(editingTrip.startDate),
            endDate: new Date(editingTrip.endDate)
          } : undefined}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setTripToDelete(null)
        }}
        onConfirm={handleDeleteTripConfirm}
        title="Delete Trip"
        message={`Are you sure you want to delete "${tripToDelete?.name}"? This action cannot be undone and will remove all trip days, events, and expenses.`}
        confirmText="Delete Trip"
        cancelText="Cancel"
      />
    </div>
  )
}