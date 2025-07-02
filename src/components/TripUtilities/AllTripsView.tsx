'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Calendar, Trash2, Clock, ExternalLink, ChevronRight, X, Edit2 } from 'lucide-react'
import ConfirmDialog from '../ConfirmDialog'
import { formatDateForDisplay } from '@/lib/dateTimeUtils'
import { useNotify } from '@/hooks/useNotify'

interface Trip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  createdAt: string
}

interface AllTripsViewProps {
  trips: Trip[]
  onTripsChange: () => void
  onEditTrip?: (trip: Trip) => void
  className?: string
}

export default function AllTripsView({ trips, onTripsChange, onEditTrip, className }: AllTripsViewProps) {
  const { error } = useNotify()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [tripToDelete, setTripToDelete] = useState<{id: string, name: string} | null>(null)
  const [showAllModal, setShowAllModal] = useState(false)
  const router = useRouter()

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
  
  // For the main card, show next upcoming trip or current trip
  const nextTrip = current[0] || upcoming[0]
  const hasMoreTrips = trips.length > 1
  
  // For the modal, show all trips categorized
  const allTrips = [...current, ...upcoming, ...past]

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
    } catch (err) {
      console.error('Error deleting trip:', err)
      error('Delete Failed', 'Failed to delete trip. Please try again.')
    }
  }

  const getTripStatus = (trip: Trip) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const startDate = new Date(trip.startDate)
    const endDate = new Date(trip.endDate)
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)
    
    if (today >= startDate && today <= endDate) {
      return { status: 'current', color: 'text-green-600', icon: Clock }
    } else if (startDate > today) {
      return { status: 'upcoming', color: 'text-blue-600', icon: Calendar }
    } else {
      return { status: 'past', color: 'text-gray-600', icon: Calendar }
    }
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Next Trip
              </CardTitle>
              <CardDescription>
                {trips.length} trip{trips.length !== 1 ? 's' : ''} total
              </CardDescription>
            </div>
            {hasMoreTrips && (
              <Button
                onClick={() => setShowAllModal(true)}
                variant="ghost"
                size="sm"
                className="gap-1"
              >
                View All Trips
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {trips.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">No trips yet</p>
            </div>
          ) : nextTrip ? (
            <div
              className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
              onClick={() => router.push(`/trips/${nextTrip.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {(() => {
                      const { color, icon: StatusIcon } = getTripStatus(nextTrip)
                      return <StatusIcon className={`w-4 h-4 ${color}`} />
                    })()}
                    <h4 className="font-medium truncate">{nextTrip.name}</h4>
                  </div>
                  {nextTrip.destination && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{nextTrip.destination}</span>
                    </div>
                  )}
                  <p className="text-sm text-gray-500">
                    {formatDateForDisplay(nextTrip.startDate)} - {formatDateForDisplay(nextTrip.endDate)}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onEditTrip && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 p-1 h-auto"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditTrip(nextTrip)
                      }}
                      title="Edit trip"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
                    onClick={(e) => handleDeleteTripClick(nextTrip.id, nextTrip.name, e)}
                    title="Delete trip"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Calendar className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">No upcoming trips</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Trips Modal */}
      {showAllModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                All Trips
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllModal(false)}
                className="p-1 h-auto"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              {trips.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600">No trips yet</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Current Trips */}
                  {current.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-green-600 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Current Trip{current.length > 1 ? 's' : ''}
                      </h3>
                      <div className="space-y-2">
                        {current.map((trip) => (
                          <TripCard key={trip.id} trip={trip} onDelete={handleDeleteTripClick} onEdit={onEditTrip} />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Upcoming Trips */}
                  {upcoming.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-blue-600 mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Upcoming Trip{upcoming.length > 1 ? 's' : ''}
                      </h3>
                      <div className="space-y-2">
                        {upcoming.map((trip) => (
                          <TripCard key={trip.id} trip={trip} onDelete={handleDeleteTripClick} onEdit={onEditTrip} />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Past Trips */}
                  {past.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Past Trip{past.length > 1 ? 's' : ''}
                      </h3>
                      <div className="space-y-2">
                        {past.map((trip) => (
                          <TripCard key={trip.id} trip={trip} onDelete={handleDeleteTripClick} onEdit={onEditTrip} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
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
    </>
  )
}

// Helper function moved outside component to avoid re-creation
function getTripStatus(trip: Trip) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const startDate = new Date(trip.startDate)
  const endDate = new Date(trip.endDate)
  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)
  
  if (today >= startDate && today <= endDate) {
    return { status: 'current', color: 'text-green-600', icon: Clock }
  } else if (startDate > today) {
    return { status: 'upcoming', color: 'text-blue-600', icon: Calendar }
  } else {
    return { status: 'past', color: 'text-gray-600', icon: Calendar }
  }
}

// Helper component for trip cards in the modal
function TripCard({ trip, onDelete, onEdit }: { 
  trip: Trip; 
  onDelete: (id: string, name: string, e: React.MouseEvent) => void;
  onEdit?: (trip: Trip) => void;
}) {
  const router = useRouter()
  const { status, color, icon: StatusIcon } = getTripStatus(trip)
  
  return (
    <div
      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
      onClick={() => router.push(`/trips/${trip.id}`)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon className={`w-4 h-4 ${color}`} />
            <h4 className="font-medium truncate">{trip.name}</h4>
          </div>
          {trip.destination && (
            <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{trip.destination}</span>
            </div>
          )}
          <p className="text-sm text-gray-500">
            {formatDateForDisplay(trip.startDate)} - {formatDateForDisplay(trip.endDate)}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 p-1 h-auto"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(trip)
              }}
              title="Edit trip"
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
            onClick={(e) => onDelete(trip.id, trip.name, e)}
            title="Delete trip"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}