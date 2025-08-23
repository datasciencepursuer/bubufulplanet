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
// Removed useGroupedFetch - using createGroupedFetch from groupUtils
import { useNotify } from '@/hooks/useNotify'
import { createClient } from '@/utils/supabase/client'
import { optimizedGroupSwitcher, getCachedGroupData } from '@/lib/optimizedGroupSwitch'
import TravelerNameEditor from '@/components/TravelerNameEditor'
// Removed GroupSelector - using direct optimized data access
import GroupNameEditor from '@/components/GroupNameEditor'
import { useOptimizedGroup, createGroupedFetch, updateGroupName } from '@/lib/groupUtils'

export default function AppPage() {
  const { warning } = useNotify()
  const { 
    selectedGroup, 
    selectedGroupMember, 
    isLoading: groupLoading,
    canCreate, 
    canModify, 
    isAdventurer
  } = useOptimizedGroup()
  const [showTripForm, setShowTripForm] = useState(false)
  const [selectedDates, setSelectedDates] = useState<{ start: Date; end: Date } | null>(null)
  const [tripsLoading, setTripsLoading] = useState(true)
  const [trips, setTrips] = useState<any[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [tripToDelete, setTripToDelete] = useState<{id: string, name: string} | null>(null)
  const [accessCodeCopied, setAccessCodeCopied] = useState(false)
  const [editingTrip, setEditingTrip] = useState<any>(null)
  
  // State for utility components data
  const [expensesData, setExpensesData] = useState<any>(null)
  const [pointsOfInterestData, setPointsOfInterestData] = useState<any[]>([])
  const [utilityDataLoading, setUtilityDataLoading] = useState(false)
  
  // State for app initialization
  const [appInitialized, setAppInitialized] = useState(false)
  const [groupSelectionComplete, setGroupSelectionComplete] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const groupedFetch = createGroupedFetch()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check for Supabase auth
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          // Redirect to login if not authenticated
          router.push('/login')
          return
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        router.push('/login')
      }
    }
    checkAuth()
  }, [supabase.auth, router])

  // Handle group data and redirect logic
  useEffect(() => {
    const handleGroupData = async () => {
      console.log('App: Starting initialization with optimized group data')
      
      // If still loading, wait
      if (groupLoading) {
        console.log('App: Group data still loading...')
        return
      }
      
      // If no group data after loading is complete, redirect immediately
      if (!selectedGroup) {
        console.log('App: No optimized group data found after loading, redirecting to group selection')
        router.push('/groups')
        return
      }
      
      console.log('App: Using optimized group data:', selectedGroup.id, selectedGroup.name)
      setGroupSelectionComplete(true)
      
      // Load additional data for the selected group
      await loadDataForSelectedGroup()
      
      console.log('App: Initialization complete')
      setAppInitialized(true)
    }
    
    handleGroupData()
  }, [groupLoading, selectedGroup, router])

  // Load data for the selected group
  const loadDataForSelectedGroup = async () => {
    if (!selectedGroup) return
    
    console.log('App: Loading data for selected group:', selectedGroup.id, selectedGroup.name)
    
    // Check if we have optimized data available (client-side only)
    const optimizedData = getCachedGroupData()
    const isOptimizedSwitch = typeof window !== 'undefined' && localStorage.getItem('optimizedSwitchComplete') === 'true'
    
    if (isOptimizedSwitch && optimizedData && optimizedData.group.id === selectedGroup.id) {
      console.log('App: Using optimized pre-loaded data')
      
      // Use the pre-loaded data
      setTrips(optimizedData.trips || [])
      setExpensesData(optimizedData.expensesSummary || null)
      setPointsOfInterestData(optimizedData.pointsOfInterest || [])
      setTripsLoading(false)
      setUtilityDataLoading(false)
      
      // Clear the flag (client-side only)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('optimizedSwitchComplete')
      }
      
      console.log('App: Optimized data loaded:', {
        trips: optimizedData.trips?.length || 0,
        expenses: optimizedData.expensesSummary ? 'loaded' : 'none',
        pointsOfInterest: optimizedData.pointsOfInterest?.length || 0
      })
    } else {
      console.log('App: Loading data normally (no optimization)')
      // Force cache busting when group changes to ensure fresh data
      await loadAllData()
    }
  }
  
  // Listen for group switch events to immediately refresh ALL data
  useEffect(() => {
    const handleGroupSwitch = (event: CustomEvent) => {
      console.log('App: Received group switch event, refreshing all data')
      // Clear all data immediately and reload
      setTrips([])
      setExpensesData(null)
      setPointsOfInterestData([])
      setTripsLoading(true)
      setUtilityDataLoading(true)
      
      // Small delay to ensure API caches are cleared
      setTimeout(() => {
        loadAllData()
      }, 50)
    }

    const handleCompleteCacheClear = (event: CustomEvent) => {
      console.log('App: Received complete cache clear event (like logout)')
      // Reset ALL state as if the user just logged in
      setTrips([])
      setExpensesData(null)
      setPointsOfInterestData([])
      setTripsLoading(true)
      setUtilityDataLoading(true)
      setShowTripForm(false)
      setSelectedDates(null)
      setEditingTrip(null)
      setShowDeleteConfirm(false)
      setTripToDelete(null)
      setAccessCodeCopied(false)
    }

    window.addEventListener('groupSwitched', handleGroupSwitch as EventListener)
    window.addEventListener('completeCacheClear', handleCompleteCacheClear as EventListener)
    
    return () => {
      window.removeEventListener('groupSwitched', handleGroupSwitch as EventListener)
      window.removeEventListener('completeCacheClear', handleCompleteCacheClear as EventListener)
    }
  }, [])

  // Load all data when group changes (trips, expenses, points of interest)
  const loadAllData = async () => {
    if (!selectedGroup) return
    
    // Load trips and utility data in parallel
    await Promise.all([
      loadTripsWithCacheBust(),
      loadUtilityData()
    ])
  }

  // Load utility components data (expenses and points of interest)
  const loadUtilityData = async () => {
    if (!selectedGroup) return
    
    try {
      setUtilityDataLoading(true)
      
      // Load expenses and points of interest in parallel
      const [expensesResponse, poiResponse] = await Promise.all([
        groupedFetch('/api/expenses/personal-summary', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        }, true),
        groupedFetch('/api/points-of-interest', {
          cache: 'no-store', 
          headers: { 'Cache-Control': 'no-cache' }
        }, true)
      ])

      // Handle expenses data
      if (expensesResponse.ok) {
        const expensesData = await expensesResponse.json()
        setExpensesData(expensesData)
      } else {
        console.error('Failed to load expenses:', expensesResponse.status)
        setExpensesData(null)
      }

      // Handle points of interest data
      if (poiResponse.ok) {
        const poiData = await poiResponse.json()
        setPointsOfInterestData(poiData.pointsOfInterest || [])
      } else {
        console.error('Failed to load points of interest:', poiResponse.status)
        setPointsOfInterestData([])
      }
    } catch (error) {
      console.error('Error loading utility data:', error)
      setExpensesData(null)
      setPointsOfInterestData([])
    } finally {
      setUtilityDataLoading(false)
    }
  }

  // Load trips with cache busting for group switches
  const loadTripsWithCacheBust = async () => {
    if (!selectedGroup) return
    
    try {
      setTripsLoading(true)
      // Use cache busting to ensure fresh data from new group
      const response = await groupedFetch(`/api/trips`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      }, true) // Enable cache busting
      
      if (response.ok) {
        const data = await response.json()
        console.log('Loaded fresh trips from API for group:', selectedGroup.id, '- Count:', data.trips?.length || 0)
        setTrips(data.trips || [])
      } else {
        console.error('Failed to load trips:', response.status, response.statusText)
        setTrips([]) // Clear trips if API fails
      }
    } catch (error) {
      console.error('Error loading trips:', error)
      setTrips([]) // Clear trips on error
    } finally {
      setTripsLoading(false)
    }
  }

  // Force refresh all data (clears any stale data)
  const forceRefreshAll = async () => {
    setTrips([]) // Clear current trips immediately  
    setExpensesData(null)
    setPointsOfInterestData([])
    await loadAllData()
  }

  // Force refresh trips data (clears any stale data)
  const forceRefreshTrips = async () => {
    setTrips([]) // Clear current trips immediately
    await loadTrips()
  }

  const loadTrips = async () => {
    if (!selectedGroup) return
    
    try {
      setTripsLoading(true)
      // Add cache-busting parameter to ensure fresh data
      const response = await groupedFetch(`/api/trips?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      })
      if (response.ok) {
        const data = await response.json()
        console.log('Loaded trips from API:', data.trips?.length || 0, 'trips')
        setTrips(data.trips || [])
      } else {
        console.error('Failed to load trips:', response.status, response.statusText)
        setTrips([]) // Clear trips if API fails
      }
    } catch (error) {
      console.error('Error loading trips:', error)
      setTrips([]) // Clear trips on error
    } finally {
      setTripsLoading(false)
    }
  }


  const handleTripSelect = (start: Date, end: Date) => {
    // Check if user has create permission
    if (!canCreate) {
      warning('Permission Denied', 'You do not have permission to create trips. Please ask your group adventurer for permission.')
      return
    }
    setSelectedDates({ start, end })
    setShowTripForm(true)
  }

  const handleCopyAccessCode = async () => {
    if (!selectedGroup?.accessCode) return

    try {
      await navigator.clipboard.writeText(selectedGroup.accessCode)
      setAccessCodeCopied(true)
      setTimeout(() => setAccessCodeCopied(false), 2000)
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = selectedGroup.accessCode
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
    if (!canCreate) {
      alert('You do not have permission to create trips. Please ask your group adventurer for permission.')
      return
    }
    // Set default dates to a week from now for a 3-day trip (more reasonable default)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + 7) // One week from today
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 9) // 3-day trip (inclusive)
    
    setSelectedDates({ start: startDate, end: endDate })
    setEditingTrip(null)
    setShowTripForm(true)
  }

  const handleEditTrip = (trip: any) => {
    // Check if user has modify permission
    if (!canModify) {
      alert('You do not have permission to edit trips. Please ask your group adventurer for permission.')
      return
    }
    setEditingTrip(trip)
    setShowTripForm(true)
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
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

      // Force refresh all data after creating/updating trips (expenses might be affected)
      await forceRefreshAll()
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
    if (!canModify) {
      alert('You do not have permission to delete trips. Please ask your group adventurer for permission.')
      return
    }
    setTripToDelete({ id: tripId, name: tripName })
    setShowDeleteConfirm(true)
  }

  const handleDeleteTripConfirm = async () => {
    if (!tripToDelete) return

    // Store reference to trip being deleted
    const tripBeingDeleted = tripToDelete
    
    // Optimistic update: immediately remove trip from UI
    const originalTrips = [...trips]
    setTrips(trips.filter(trip => trip.id !== tripBeingDeleted.id))
    setTripToDelete(null)

    try {
      const response = await groupedFetch(`/api/trips/${tripBeingDeleted.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Delete API error:', errorData)
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      // Success: force refresh to ensure no stale data
      await forceRefreshAll()
    } catch (error) {
      console.error('Error deleting trip:', error)
      // Rollback: restore original trips state
      setTrips(originalTrips)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Failed to delete trip: ${errorMessage}`)
    }
  }

  const handleDeleteTripFromEdit = () => {
    if (!editingTrip) return
    
    // Check if user has modify permission
    if (!canModify) {
      alert('You do not have permission to delete trips. Please ask your group adventurer for permission.')
      return
    }
    
    // Use the existing delete confirmation flow
    setTripToDelete({ id: editingTrip.id, name: editingTrip.name })
    setShowTripForm(false) // Close the edit modal
    setShowDeleteConfirm(true)
  }

  const handleUpdateTravelerName = async (newName: string) => {
    try {
      const response = await fetch('/api/groups/current', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ travelerName: newName }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to update traveler name')
      }

      // The context will update automatically on next data fetch
    } catch (error) {
      console.error('Error updating traveler name:', error)
      throw error
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

  // Show loading until optimized group data is loaded and processed
  if (!appInitialized || !groupSelectionComplete || groupLoading || 
      (tripsLoading && !trips.length) || (utilityDataLoading && !expensesData && !pointsOfInterestData.length)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BearGlobeLoader />
          <div className="mt-4 text-sm text-gray-600">
            {(() => {
              if (typeof window === 'undefined') return "Loading..."
              
              const groupSelectionInProgress = localStorage.getItem('groupSelectionInProgress') === 'true'
              const optimizedSwitchComplete = localStorage.getItem('optimizedSwitchComplete') === 'true'
              
              if (groupSelectionInProgress && !optimizedSwitchComplete) return "Completing group selection..."
              if (groupLoading) return "Loading groups..."
              if (!groupSelectionComplete && selectedGroup) return "Finalizing group selection..."
              if (tripsLoading) return "Loading trips..."
              if (utilityDataLoading) return "Loading data..."
              if (!appInitialized && !groupLoading) return "Preparing your workspace..."
              return "Loading..."
            })()}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* App Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 items-center h-16">
            {/* Left Section */}
            <div className="flex items-center gap-2 lg:gap-4 min-w-0">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  // Always go to groups page for group switching
                  router.push('/groups')
                }}
                className="gap-1 lg:gap-2"
                title="Switch groups"
              >
                <ArrowLeft className="w-4 h-4" /> 
                <span className="hidden sm:inline">
                  Groups
                </span>
              </Button>
              <div className="min-w-0">
                {selectedGroup ? (
                  <GroupNameEditor
                    groupId={selectedGroup.id}
                    currentName={selectedGroup.name}
                    canEdit={isAdventurer}
                    onNameUpdate={updateGroupName}
                    className="text-base lg:text-lg"
                  />
                ) : (
                  <h1 className="text-base lg:text-lg font-semibold truncate">
                    Select a Group
                  </h1>
                )}
                {selectedGroup && (
                  <div className="flex items-center gap-2 text-xs lg:text-sm text-gray-500">
                    <span className="hidden sm:inline">Access Code:</span>
                    <span className="font-mono font-medium">{selectedGroup.accessCode}</span>
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
            
            {/* Center Brand */}
            <div className="flex flex-col items-center justify-center">
              <h2 className="text-lg lg:text-xl font-bold bg-gradient-to-r from-teal-800 to-teal-600 bg-clip-text text-transparent">
                Bubuful Planet
              </h2>
              <p className="text-xs text-gray-500 italic hidden sm:block">
                Plan it beautifully
              </p>
            </div>
            
            {/* Right Section */}
            <div className="flex items-center gap-1 lg:gap-3 justify-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/groups')}
                className="gap-1 lg:gap-2"
              >
                <Users className="w-4 h-4" /> 
                <span className="hidden sm:inline">Switch Group</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/group-settings')}
                className="gap-1 lg:gap-2"
              >
                <Users className="w-4 h-4" /> 
                <span className="hidden sm:inline">Settings</span>
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
                {selectedGroupMember && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 mb-2">
                      Welcome {isAdventurer ? 'Adventurer' : 'Party Member'}:
                    </p>
                    <TravelerNameEditor
                      currentName={selectedGroupMember.travelerName}
                      onNameUpdate={handleUpdateTravelerName}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Desktop: Full layout */}
              <div className="hidden lg:flex lg:justify-between lg:items-start space-y-4 lg:space-y-0">
                <div>
                  <h2 className="text-3xl font-bold mb-2">
                    {selectedGroup ? `${selectedGroup.name} - Plan Your Trips` : 'Plan Your Trips'}
                  </h2>
                  <p className="text-gray-600">
                    Drag and select dates on the calendar to create a new trip
                  </p>
                </div>
                
                {/* Welcome Card */}
                {selectedGroupMember && (
                  <Card className="bg-teal-50 border-teal-200 max-w-sm flex-shrink-0">
                    <CardContent className="pt-4">
                      <p className="text-lg text-teal-700 font-medium mb-3">
                        Welcome {isAdventurer ? 'Adventurer' : 'Party Member'}:
                      </p>
                      <TravelerNameEditor
                        currentName={selectedGroupMember.travelerName}
                        onNameUpdate={handleUpdateTravelerName}
                        className="text-base"
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
            
            {/* Desktop Trip Management */}
            <div className="hidden lg:block space-y-4">
              {/* Next Trip Card - Moved from utility cards */}
              <AllTripsView 
                trips={trips} 
                onTripsChange={forceRefreshAll}
                onEditTrip={handleEditTrip}
                onDeleteTrip={handleDeleteTripClick}
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
                permissions={selectedGroupMember?.permissions}
              />
              
              {/* Mobile Utility Sections */}
              <div className="space-y-4">
                <PointsOfInterestView 
                  className="w-full" 
                  data={pointsOfInterestData}
                  loading={utilityDataLoading}
                  onDataChange={loadUtilityData}
                />
                <ExpensesView 
                  className="w-full"
                  data={expensesData}
                  loading={utilityDataLoading}
                />
              </div>
            </div>
          </div>
          
          {/* Desktop Utility Sidebar */}
          <div className="hidden lg:flex h-full flex-col space-y-4">
            <div className="flex-1 flex flex-col space-y-4">
              <PointsOfInterestView 
                className="flex-1" 
                data={pointsOfInterestData}
                loading={utilityDataLoading}
                onDataChange={loadUtilityData}
              />
              <ExpensesView 
                className="flex-1"
                data={expensesData}
                loading={utilityDataLoading}
              />
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