'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Calendar, Trash2, Clock, ExternalLink, ChevronRight } from 'lucide-react'
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
  trips: Trip[]
  onTripsChange: () => void
  className?: string
}

export default function AllTripsView({ trips, onTripsChange, className }: AllTripsViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [tripToDelete, setTripToDelete] = useState<{id: string, name: string} | null>(null)
  const [showAll, setShowAll] = useState(false)
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
  const allTrips = [...current, ...upcoming, ...past]
  const displayTrips = showAll ? allTrips : allTrips.slice(0, 4)

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
                All Trips
              </CardTitle>
              <CardDescription>
                {trips.length} trip{trips.length !== 1 ? 's' : ''} total
              </CardDescription>
            </div>
            {trips.length > 4 && (
              <Button
                onClick={() => setShowAll(!showAll)}
                variant="ghost"
                size="sm"
                className="gap-1"
              >
                {showAll ? 'Show Less' : `View All ${trips.length}`}
                <ChevronRight className={`w-4 h-4 transition-transform ${showAll ? 'rotate-90' : ''}`} />
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
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {displayTrips.map((trip) => {
                const { status, color, icon: StatusIcon } = getTripStatus(trip)
                
                return (
                  <div
                    key={trip.id}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                    onClick={() => router.push(`/trips/${trip.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusIcon className={`w-3 h-3 ${color}`} />
                          <h4 className="font-medium text-sm truncate">{trip.name}</h4>
                        </div>
                        {trip.destination && (
                          <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                            <MapPin className="w-2.5 h-2.5" />
                            <span className="truncate">{trip.destination}</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 h-auto"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/trips/${trip.id}`)
                          }}
                          title="Open trip"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
                          onClick={(e) => handleDeleteTripClick(trip.id, trip.name, e)}
                          title="Delete trip"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

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