'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, MapPin, Plus, X, Save, Edit2, Trash2 } from 'lucide-react'

interface SavedDestinationsViewProps {
  onBack: () => void
}

export default function SavedDestinationsView({ onBack }: SavedDestinationsViewProps) {
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
          // Parse comma-delimited string into array
          setDestinations(saved.split(',').map((dest: string) => dest.trim()).filter(Boolean))
        } else {
          setDestinations([])
        }
      } else {
        throw new Error('Failed to load destinations')
      }
    } catch (error) {
      console.error('Error loading destinations:', error)
      setError('Failed to load saved destinations')
    } finally {
      setLoading(false)
    }
  }

  const saveDestinations = async (newDestinations: string[]) => {
    try {
      setSaving(true)
      // Convert array back to comma-delimited string
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
      alert('Failed to save destinations. Please try again.')
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
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-4 mb-6 pb-4 border-b">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h2 className="text-xl font-semibold">Saved Destinations</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-800 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading destinations...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-4 mb-6 pb-4 border-b">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h2 className="text-xl font-semibold">Saved Destinations</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-12 h-12 mx-auto text-red-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading destinations</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadDestinations}>Try Again</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-semibold">Saved Destinations</h2>
            <p className="text-sm text-gray-600">
              {destinations.length} destination{destinations.length !== 1 ? 's' : ''} saved for your group
            </p>
          </div>
        </div>
        
        <Button
          onClick={() => setIsEditing(!isEditing)}
          variant={isEditing ? "outline" : "default"}
          className="gap-2"
        >
          {isEditing ? (
            <>
              <X className="w-4 h-4" />
              Cancel
            </>
          ) : (
            <>
              <Edit2 className="w-4 h-4" />
              Edit
            </>
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Group Destinations
            </CardTitle>
            <CardDescription>
              Store places you'd like to visit in the future. These are shared with everyone in your travel group.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Add New Destination */}
            {isEditing && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Add New Destination</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDestination}
                    onChange={(e) => setNewDestination(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter destination name (e.g., Tokyo, Japan)"
                    className="flex-1 p-2 border rounded-md"
                    disabled={saving}
                  />
                  <Button 
                    onClick={addDestination}
                    disabled={!newDestination.trim() || saving}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </div>
              </div>
            )}

            {/* Destinations List */}
            {destinations.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No destinations saved yet</h3>
                <p className="text-gray-600 mb-4">
                  Start building your travel wishlist by adding destinations your group wants to visit.
                </p>
                {!isEditing && (
                  <Button onClick={() => setIsEditing(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add First Destination
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {destinations.map((destination, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-teal-600" />
                      <span className="font-medium">{destination}</span>
                    </div>
                    {isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDestination(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        disabled={saving}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tips */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">💡 Tips</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Add specific cities, countries, or regions you want to explore</li>
                <li>• Include bucket list destinations for future trip planning</li>
                <li>• All group members can see and contribute to this list</li>
                <li>• Use these destinations when creating new trips</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}