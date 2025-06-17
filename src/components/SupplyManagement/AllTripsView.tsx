'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, MapPin, Calendar, Trash2, Clock, ExternalLink } from 'lucide-react'
import ConfirmDialog from '../ConfirmDialog'

interface Trip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  createdAt: string
}

interface AllTripsViewProps {
  onBack: () => void
  trips: Trip[]
  onTripsChange: () => void
}

const TRIPS_PER_PAGE = 10

export default function AllTripsView({ onBack, trips, onTripsChange }: AllTripsViewProps) {
  const [displayedTrips, setDisplayedTrips] = useState<Trip[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [tripToDelete, setTripToDelete] = useState<{id: string, name: string} | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Sort trips by date (most recent first)
    const sortedTrips = [...trips].sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    )
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * TRIPS_PER_PAGE
    const endIndex = startIndex + TRIPS_PER_PAGE
    setDisplayedTrips(sortedTrips.slice(0, endIndex))
  }, [trips, currentPage])

  const categorizeTrips = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const current: Trip[] = []
    const upcoming: Trip[] = []
    const past: Trip[] = []
    
    trips.forEach(trip => {
      const startDate = new Date(trip.startDate)
      const endDate = new Date(trip.endDate)
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)
      
      if (today >= startDate && today <= endDate) {
        current.push(trip)
      } else if (startDate > today) {
        upcoming.push(trip)
      } else {
        past.push(trip)
      }
    })
    
    return { current, upcoming, past }
  }

  const { current, upcoming, past } = categorizeTrips()

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

      onTripsChange()
      setTripToDelete(null)
    } catch (error) {
      console.error('Error deleting trip:', error)
      alert('Failed to delete trip. Please try again.')
    }
  }

  const loadMoreTrips = () => {
    setCurrentPage(prev => prev + 1)
  }

  const TripCard = ({ trip, status }: { trip: Trip, status: 'current' | 'upcoming' | 'past' }) => {
    const statusColors = {
      current: 'border-green-200 bg-green-50',
      upcoming: 'border-blue-200 bg-blue-50',
      past: 'border-gray-200 bg-gray-50'
    }
    
    const statusIcons = {
      current: <Clock className="w-4 h-4 text-green-600" />,
      upcoming: <Calendar className="w-4 h-4 text-blue-600" />,
      past: <Calendar className="w-4 h-4 text-gray-600" />
    }

    return (
      <div
        className={`p-4 border rounded-lg hover:shadow-md cursor-pointer transition-all group ${statusColors[status]}`}
        onClick={() => router.push(`/trips/${trip.id}`)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {statusIcons[status]}
              <h4 className="font-medium text-gray-900">{trip.name}</h4>
            </div>
            {trip.destination && (
              <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                <MapPin className="w-3 h-3" />
                {trip.destination}
              </div>
            )}
            <p className="text-sm text-gray-500">
              {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Created {new Date(trip.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 hover:text-blue-800 hover:bg-blue-100"
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/trips/${trip.id}`)
              }}
              title="Open trip"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={(e) => handleDeleteTripClick(trip.id, trip.name, e)}
              title="Delete trip"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-xl font-semibold">All Trips</h2>
          <p className="text-sm text-gray-600">{trips.length} total trips</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Current Trips */}
        {current.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-3 text-green-800">Current Trips ({current.length})</h3>
            <div className="space-y-3">
              {current.map(trip => (
                <TripCard key={trip.id} trip={trip} status="current" />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Trips */}
        {upcoming.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-3 text-blue-800">Upcoming Trips ({upcoming.length})</h3>
            <div className="space-y-3">
              {upcoming.map(trip => (
                <TripCard key={trip.id} trip={trip} status="upcoming" />
              ))}
            </div>
          </div>
        )}

        {/* Past Trips */}
        {past.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-3 text-gray-800">Past Trips ({past.length})</h3>
            <div className="space-y-3">
              {past.map(trip => (
                <TripCard key={trip.id} trip={trip} status="past" />
              ))}
            </div>
          </div>
        )}

        {/* Load More Button */}
        {displayedTrips.length < trips.length && (
          <div className="text-center py-4">
            <Button variant="outline" onClick={loadMoreTrips}>
              Load More Trips
            </Button>
          </div>
        )}

        {/* Empty State */}
        {trips.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No trips yet</h3>
            <p className="text-gray-600">Create your first trip to get started!</p>
          </div>
        )}
      </div>

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