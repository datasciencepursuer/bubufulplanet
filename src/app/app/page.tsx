'use client'

import { useState, useEffect, useMemo } from 'react'
import AppMonthlyCalendar from '@/components/AppMonthlyCalendar'
import TripForm from '@/components/TripForm'
import AllTripsView from '@/components/TripUtilities/AllTripsView'
import ExpensesView from '@/components/TripUtilities/ExpensesView'
import PointsOfInterestView from '@/components/TripUtilities/PointsOfInterestView'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Calendar as CalendarIcon, DollarSign, Settings, ArrowLeft, Plus, LogOut, Trash2, Clock, Users, Copy, Check } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useDeviceSession } from '@/hooks/useDeviceSession'

export default function AppPage() {
  const [showTripForm, setShowTripForm] = useState(false)
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date } | null>(null)
  const [loading, setLoading] = useState(false)
  const [trips, setTrips] = useState<any[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [tripToDelete, setTripToDelete] = useState<{id: string, name: string} | null>(null)
  const [groupInfo, setGroupInfo] = useState<{name: string, accessCode: string, travelerName?: string, role?: string} | null>(null)
  const [accessCodeCopied, setAccessCodeCopied] = useState(false)
  const router = useRouter()
  const { logout } = useDeviceSession()

  useEffect(() => {
    loadTrips()
    loadGroupInfo()
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
          role: data.role
        })
      }
    } catch (error) {
      console.error('Error loading group info:', error)
    }
  }

  const handleTripSelect = (start: Date, end: Date) => {
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
    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tripData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const { trip } = await response.json()
      // Reload trips after creating a new one
      await loadTrips()
      router.push(`/trips/${trip.id}`)
    } catch (error) {
      console.error('Error creating trip:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to create trip: ${errorMessage}`)
    }
  }

  const handleDeleteTripClick = (tripId: string, tripName: string, event: React.MouseEvent) => {
    event.stopPropagation()
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-800 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* App Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/')}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <div>
                <h1 className="text-lg font-semibold">
                  {groupInfo ? groupInfo.name : 'My Trips'}
                </h1>
                {groupInfo && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Access Code:</span>
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
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/group-settings')}
                className="gap-2"
              >
                <Users className="w-4 h-4" /> Group Settings
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" /> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {/* Group Title and Welcome */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-3xl font-bold mb-2">
                  {groupInfo ? `${groupInfo.name} - Plan Your Trips` : 'Plan Your Trips'}
                </h2>
                <p className="text-gray-600">Drag and select dates on the calendar to create a new trip</p>
              </div>
              
              {/* Welcome Card */}
              {groupInfo && groupInfo.travelerName && (
                <Card className="bg-teal-50 border-teal-200 max-w-sm flex-shrink-0">
                  <CardContent className="pt-4">
                    <p className="text-lg text-teal-700 font-medium">
                      Welcome {groupInfo.role === 'adventurer' ? 'Adventurer' : 'Party Member'} {groupInfo.travelerName}!
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* Next Trip Card - Moved from utility cards */}
            <AllTripsView 
              trips={trips} 
              onTripsChange={loadTrips}
            />
            
            <AppMonthlyCalendar 
              onTripSelect={handleTripSelect} 
              existingTrips={trips.map(trip => ({
                id: trip.id,
                title: trip.name,
                start: trip.startDate,
                end: trip.endDate
              }))}
            />
          </div>
          
          <div className="h-full flex flex-col space-y-4">
            {/* Remaining Utility Cards - Swapped order */}
            <div className="flex-1 flex flex-col space-y-4">
              <PointsOfInterestView className="flex-1" />
              <ExpensesView className="flex-1" />
            </div>
          </div>
        </div>
      </div>

      {showTripForm && selectedDates && (
        <TripForm
          startDate={selectedDates.start}
          endDate={selectedDates.end}
          onSubmit={handleTripSubmit}
          onCancel={() => setShowTripForm(false)}
          open={showTripForm}
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