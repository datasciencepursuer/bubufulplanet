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
  const [groupInfo, setGroupInfo] = useState<{name: string, accessCode: string} | null>(null)
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
          accessCode: data.group.accessCode
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            {groupInfo ? `${groupInfo.name} - Plan Your Trips` : 'Plan Your Trips'}
          </h2>
          <p className="text-gray-600">Select dates on the calendar to create a new trip</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
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
          
          <div className="space-y-6">
            {/* Current Trip Card */}
            {currentTrip && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-900">
                    <Clock className="w-5 h-5" />
                    Current Trip
                  </CardTitle>
                  <CardDescription>You&apos;re currently on this trip!</CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className="p-3 bg-white border border-green-200 rounded-lg hover:shadow-md cursor-pointer transition-all group"
                    onClick={() => router.push(`/trips/${currentTrip.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-green-900">{currentTrip.name}</h4>
                        <p className="text-sm text-green-700">{currentTrip.destination}</p>
                        <p className="text-xs text-green-600 mt-1">
                          {new Date(currentTrip.startDate).toLocaleDateString()} - {new Date(currentTrip.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => handleDeleteTripClick(currentTrip.id, currentTrip.name, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Trips Card */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Trips</CardTitle>
                <CardDescription>Your next adventures</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingTrips.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {currentTrip 
                      ? "No upcoming trips planned. Select dates on the calendar to plan your next adventure!"
                      : "No trips yet. Select dates on the calendar to create your first trip!"
                    }
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcomingTrips.slice(0, currentTrip ? 2 : 3).map((trip) => (
                      <div
                        key={trip.id}
                        className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                        onClick={() => router.push(`/trips/${trip.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{trip.name}</h4>
                            <p className="text-sm text-gray-600">{trip.destination}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => handleDeleteTripClick(trip.id, trip.name, e)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(upcomingTrips.length > (currentTrip ? 2 : 3) || pastTrips.length > 0) && (
                      <Button
                        variant="link"
                        className="w-full text-sm"
                        onClick={() => router.push('/trips')}
                      >
                        View all {trips.length} trips →
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Trip Utilities */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Trip Utilities</h3>
                <div className="space-y-4">
                  <AllTripsView 
                    trips={trips} 
                    onTripsChange={loadTrips}
                  />
                  <ExpensesView />
                  <PointsOfInterestView />
                </div>
              </div>
            </div>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">Pro Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li>• Click and drag to select multiple days</li>
                  <li>• Double-click a date for single day trips</li>
                  <li>• Use keyboard shortcuts for faster planning</li>
                </ul>
              </CardContent>
            </Card>
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