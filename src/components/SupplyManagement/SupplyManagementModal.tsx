'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, DollarSign, MapPin, X } from 'lucide-react'
import AllTripsView from './AllTripsView'
import ExpensesView from './ExpensesView'
import SavedDestinationsView from './SavedDestinationsView'

interface Trip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  createdAt: string
}

interface SupplyManagementModalProps {
  isOpen: boolean
  onClose: () => void
  trips: Trip[]
  onTripsChange: () => void
}

type ViewType = 'main' | 'trips' | 'expenses' | 'destinations'

export default function SupplyManagementModal({ 
  isOpen, 
  onClose, 
  trips, 
  onTripsChange 
}: SupplyManagementModalProps) {
  const [currentView, setCurrentView] = useState<ViewType>('main')

  if (!isOpen) return null

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view)
  }

  const handleBack = () => {
    setCurrentView('main')
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'trips':
        return (
          <AllTripsView
            onBack={handleBack}
            trips={trips}
            onTripsChange={onTripsChange}
          />
        )
      case 'expenses':
        return <ExpensesView onBack={handleBack} />
      case 'destinations':
        return <SavedDestinationsView onBack={handleBack} />
      default:
        return (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
              <div>
                <h2 className="text-xl font-semibold">Supply Management</h2>
                <p className="text-sm text-gray-600">Manage your trips, expenses, and destinations</p>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Main Menu */}
            <div className="flex-1 space-y-4">
              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleViewChange('trips')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    View All Trips
                  </CardTitle>
                  <CardDescription>
                    See all your trips in one place with detailed views and management options
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      {trips.length} trip{trips.length !== 1 ? 's' : ''} total
                    </div>
                    <Button variant="outline" size="sm">
                      View →
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleViewChange('expenses')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Expenses
                  </CardTitle>
                  <CardDescription>
                    View and analyze all expenses from your trip events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      Track spending across all trips
                    </div>
                    <Button variant="outline" size="sm">
                      View →
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleViewChange('destinations')}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    Saved Destinations
                  </CardTitle>
                  <CardDescription>
                    Manage your group's wishlist of places to visit
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      Shared with your travel group
                    </div>
                    <Button variant="outline" size="sm">
                      View →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] p-6">
        {renderCurrentView()}
      </div>
    </div>
  )
}