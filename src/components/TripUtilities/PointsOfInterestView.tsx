'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Plus, Edit2, Trash2, X } from 'lucide-react'

interface PointsOfInterestViewProps {
  className?: string
}

export default function PointsOfInterestView({ className }: PointsOfInterestViewProps) {
  const [destinations, setDestinations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [newDestination, setNewDestination] = useState('')

  useEffect(() => {
    loadDestinations()
  }, [])

  const loadDestinations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/groups/current')
      
      if (response.ok) {
        const data = await response.json()
        const saved = data.group.savedDestinations
        if (saved) {
          setDestinations(saved.split(',').map((dest: string) => dest.trim()).filter(Boolean))
        } else {
          setDestinations([])
        }
      } else {
        throw new Error('Failed to load destinations')
      }
    } catch (error) {
      console.error('Error loading destinations:', error)
      setError('Failed to load points of interest')
    } finally {
      setLoading(false)
    }
  }

  const saveDestinations = async (newDestinations: string[]) => {
    try {
      setSaving(true)
      const destinationsString = newDestinations.join(', ')
      
      const response = await fetch('/api/groups/destinations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ savedDestinations: destinationsString }),
      })

      if (!response.ok) {
        throw new Error('Failed to save destinations')
      }

      setDestinations(newDestinations)
      setIsEditing(false)
      setNewDestination('')
    } catch (error) {
      console.error('Error saving destinations:', error)
      alert('Failed to save points of interest. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addDestination = () => {
    if (newDestination.trim() && !destinations.includes(newDestination.trim())) {
      const updated = [...destinations, newDestination.trim()]
      saveDestinations(updated)
    }
  }

  const removeDestination = (index: number) => {
    const updated = destinations.filter((_, i) => i !== index)
    saveDestinations(updated)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addDestination()
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-600" />
            Points of Interest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-800"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-600" />
            Points of Interest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-red-600 mb-2">{error}</p>
            <Button onClick={loadDestinations} size="sm">Try Again</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-600" />
              Points of Interest
            </CardTitle>
            <CardDescription>
              {destinations.length} destination{destinations.length !== 1 ? 's' : ''} saved
            </CardDescription>
          </div>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant="ghost"
            size="sm"
            className="gap-1"
          >
            {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Add New Destination */}
        {isEditing && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex gap-2">
              <input
                type="text"
                value={newDestination}
                onChange={(e) => setNewDestination(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter destination..."
                className="flex-1 p-2 text-sm border rounded-md"
                disabled={saving}
              />
              <Button 
                onClick={addDestination}
                disabled={!newDestination.trim() || saving}
                size="sm"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Destinations List */}
        {destinations.length === 0 ? (
          <div className="text-center py-6">
            <MapPin className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-3">No destinations saved yet</p>
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
                Add First Destination
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {destinations.slice(0, isEditing ? destinations.length : 5).map((destination, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-purple-600" />
                  <span className="text-sm font-medium truncate">{destination}</span>
                </div>
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDestination(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
                    disabled={saving}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
            {!isEditing && destinations.length > 5 && (
              <div className="text-center pt-2">
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                  View all {destinations.length} destinations
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}