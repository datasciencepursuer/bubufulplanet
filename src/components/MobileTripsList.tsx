'use client'

import { useState } from 'react'
import { format, differenceInDays, isToday, isFuture, isPast } from 'date-fns'
import { Calendar, MapPin, Clock, Plus, ChevronRight, Plane, Users, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface Trip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
}

interface MobileTripsListProps {
  trips: Trip[]
  onTripClick: (tripId: string) => void
  onCreateTrip: () => void
  onEditTrip?: (trip: Trip) => void
  onDeleteTrip?: (tripId: string, tripName: string, event: React.MouseEvent) => void
  permissions?: {
    create: boolean
    modify: boolean
  }
  className?: string
}

export default function MobileTripsList({ 
  trips, 
  onTripClick, 
  onCreateTrip, 
  onEditTrip,
  onDeleteTrip,
  permissions = { create: true, modify: true },
  className
}: MobileTripsListProps) {
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null)

  const categorizeTrips = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const current = trips.filter(trip => {
      const startDate = new Date(trip.startDate)
      const endDate = new Date(trip.endDate)
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)
      return today >= startDate && today <= endDate
    })
    
    const upcoming = trips.filter(trip => {
      const startDate = new Date(trip.startDate)
      startDate.setHours(0, 0, 0, 0)
      return startDate > today
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    
    const past = trips.filter(trip => {
      const endDate = new Date(trip.endDate)
      endDate.setHours(23, 59, 59, 999)
      return endDate < today
    }).sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
    
    return { current, upcoming, past }
  }

  const { current, upcoming, past } = categorizeTrips()

  const getTripDuration = (trip: Trip) => {
    const startDate = new Date(trip.startDate)
    const endDate = new Date(trip.endDate)
    const days = differenceInDays(endDate, startDate) + 1
    return `${days} ${days === 1 ? 'day' : 'days'}`
  }

  const getTripStatus = (trip: Trip) => {
    const startDate = new Date(trip.startDate)
    const endDate = new Date(trip.endDate)
    const today = new Date()
    
    if (isToday(startDate)) return { text: 'Starts today', color: 'text-green-600' }
    if (isToday(endDate)) return { text: 'Ends today', color: 'text-orange-600' }
    if (isFuture(startDate)) {
      const daysUntil = differenceInDays(startDate, today)
      return { text: `Starts in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}`, color: 'text-blue-600' }
    }
    if (isPast(endDate)) {
      const daysAgo = differenceInDays(today, endDate)
      return { text: `Ended ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`, color: 'text-gray-500' }
    }
    return { text: 'In progress', color: 'text-green-600' }
  }

  const renderTrip = (trip: Trip, section: 'current' | 'upcoming' | 'past') => {
    const status = getTripStatus(trip)
    const duration = getTripDuration(trip)
    const isExpanded = expandedTripId === trip.id

    return (
      <Card key={trip.id} className="mb-3 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
        <CardContent className="p-0">
          <div 
            className="p-4 cursor-pointer"
            onClick={() => onTripClick(trip.id)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-gray-900 truncate">{trip.name}</h3>
                {trip.destination && (
                  <div className="flex items-center text-gray-600 mt-1">
                    <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                    <span className="text-sm truncate">{trip.destination}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 ml-2">
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center text-gray-600">
                <Calendar className="h-4 w-4 mr-1" />
                <span>
                  {format(new Date(trip.startDate), 'MMM d')} - {format(new Date(trip.endDate), 'MMM d, yyyy')}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center text-gray-600">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>{duration}</span>
                </div>
                
                <span className={`text-xs font-medium ${status.color}`}>
                  {status.text}
                </span>
              </div>
            </div>
          </div>

          {/* Trip Actions - Show on tap/expanded */}
          {(onEditTrip || onDeleteTrip) && permissions.modify && (
            <div className="border-t bg-gray-50 px-4 py-3 flex gap-2">
              {onEditTrip && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditTrip(trip)
                  }}
                  className="gap-2 flex-1"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
              )}
              {onDeleteTrip && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteTrip(trip.id, trip.name, e)
                  }}
                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderSection = (title: string, tripList: Trip[], icon: React.ReactNode, sectionType: 'current' | 'upcoming' | 'past') => {
    if (tripList.length === 0) return null

    return (
      <div className="mb-6">
        <div className="flex items-center mb-3">
          {icon}
          <h2 className="text-lg font-semibold text-gray-900 ml-2">{title}</h2>
          <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
            {tripList.length}
          </span>
        </div>
        {tripList.map(trip => renderTrip(trip, sectionType))}
      </div>
    )
  }

  // Empty state when no trips exist
  if (trips.length === 0) {
    return (
      <div className={`p-6 ${className || ''}`}>
        <Card className="text-center py-12">
          <CardContent className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
              <Plane className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No trips yet!</h3>
              <p className="text-gray-600 mb-6">Ready to plan your next adventure? Create your first trip to get started.</p>
              {permissions.create ? (
                <Button 
                  onClick={onCreateTrip}
                  size="lg"
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Create Your First Trip
                </Button>
              ) : (
                <p className="text-sm text-gray-500">
                  Ask your group adventurer to create trips for the group.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-teal-600" />
          My Trips
        </CardTitle>
        <CardDescription>
          {trips.length} trip{trips.length !== 1 ? 's' : ''} planned
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Quick Create Button */}
        {permissions.create && (
          <div className="mb-6">
            <Button 
              onClick={onCreateTrip}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2 py-3"
              size="lg"
            >
              <Plus className="h-5 w-5" />
              Create New Trip
            </Button>
          </div>
        )}

        {/* Trip Sections */}
        {renderSection(
          "Current Trip", 
          current, 
          <Plane className="h-5 w-5 text-green-600" />, 
          'current'
        )}
        
        {renderSection(
          "Upcoming Trips", 
          upcoming, 
          <Calendar className="h-5 w-5 text-blue-600" />, 
          'upcoming'
        )}
        
        {renderSection(
          "Past Trips", 
          past, 
          <Clock className="h-5 w-5 text-gray-500" />, 
          'past'
        )}
      </CardContent>
    </Card>
  )
}