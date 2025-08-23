'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Plus, Edit2, Trash2, X, Link, ExternalLink, StickyNote, Map, Calendar } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import ConfirmDialog from '../ConfirmDialog'

interface PointOfInterest {
  id: string
  destinationName: string
  address?: string | null
  notes?: string | null
  link?: string | null
  tripId?: string | null
  trip?: {
    id: string
    name: string
  } | null
}

interface PointsOfInterestViewProps {
  className?: string
  tripId?: string // Optional tripId to filter by specific trip
  data?: PointOfInterest[]
  loading?: boolean
  onDataChange?: () => Promise<void> // Callback to refresh data after changes
}

export default function PointsOfInterestView({ 
  className, 
  tripId, 
  data = [], 
  loading = false, 
  onDataChange 
}: PointsOfInterestViewProps) {
  const pointsOfInterest = data
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [poiToDelete, setPoiToDelete] = useState<{ id: string; name: string } | null>(null)
  const { canCreate, canModify } = usePermissions()
  
  // Form state
  const [formData, setFormData] = useState({
    destinationName: '',
    address: '',
    notes: '',
    link: '',
    tripId: tripId || ''
  })

  // Available trips for dropdown
  const [availableTrips, setAvailableTrips] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (!tripId) {
      loadAvailableTrips()
    }
  }, [tripId])

  const refreshData = async () => {
    if (onDataChange) {
      await onDataChange()
    }
  }

  const loadAvailableTrips = async () => {
    try {
      const response = await fetch('/api/trips')
      if (response.ok) {
        const data = await response.json()
        setAvailableTrips(data.trips || [])
      }
    } catch (error) {
      console.error('Error loading trips:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      destinationName: '',
      address: '',
      notes: '',
      link: '',
      tripId: tripId || ''
    })
    setEditingId(null)
  }

  const handleSave = async () => {
    if (!formData.destinationName.trim()) return

    try {
      setSaving(true)
      
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId 
        ? { id: editingId, ...formData }
        : formData

      const response = await fetch('/api/points-of-interest', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save point of interest')
      }

      await refreshData()
      resetForm()
      if (!editingId) {
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Error saving point of interest:', error)
      alert(error instanceof Error ? error.message : 'Failed to save point of interest. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (poi: PointOfInterest) => {
    setFormData({
      destinationName: poi.destinationName,
      address: poi.address || '',
      notes: poi.notes || '',
      link: poi.link || '',
      tripId: poi.tripId || ''
    })
    setEditingId(poi.id)
    setIsEditing(true)
  }

  const handleDeleteClick = (poi: PointOfInterest, e: React.MouseEvent) => {
    e.stopPropagation()
    setPoiToDelete({ id: poi.id, name: poi.destinationName })
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!poiToDelete) return

    try {
      const response = await fetch(`/api/points-of-interest?id=${poiToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete point of interest')
      }

      await refreshData()
      setPoiToDelete(null)
    } catch (error) {
      console.error('Error deleting point of interest:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete point of interest. Please try again.')
    }
  }

  const handleLinkClick = (link: string, e: React.MouseEvent) => {
    // Don't open link if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    e.stopPropagation()
    const url = link.startsWith('http') ? link : `https://${link}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
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
            <Button onClick={refreshData} size="sm">Try Again</Button>
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
              {pointsOfInterest.length} destination{pointsOfInterest.length !== 1 ? 's' : ''} saved
            </CardDescription>
          </div>
          {(canCreate() || canModify()) && (
            <Button
              onClick={() => {
                setIsEditing(!isEditing)
                if (!isEditing) {
                  resetForm()
                }
              }}
              variant="ghost"
              size="sm"
              className="gap-1"
            >
              {isEditing ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Add/Edit Form */}
        {isEditing && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-3">
            <input
              type="text"
              value={formData.destinationName}
              onChange={(e) => setFormData({ ...formData, destinationName: e.target.value })}
              onKeyPress={handleKeyPress}
              placeholder="Destination name *"
              className="w-full p-2 text-sm border rounded-md"
              disabled={saving}
            />
            
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              onKeyPress={handleKeyPress}
              placeholder="Address (optional)"
              className="w-full p-2 text-sm border rounded-md"
              disabled={saving}
            />
            
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notes (optional)"
              className="w-full p-2 text-sm border rounded-md resize-none"
              rows={2}
              disabled={saving}
            />
            
            <input
              type="url"
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              onKeyPress={handleKeyPress}
              placeholder="Link (optional)"
              className="w-full p-2 text-sm border rounded-md"
              disabled={saving}
            />
            
            {!tripId && availableTrips.length > 0 && (
              <select
                value={formData.tripId}
                onChange={(e) => setFormData({ ...formData, tripId: e.target.value })}
                className="w-full p-2 text-sm border rounded-md"
                disabled={saving}
              >
                <option value="">No specific trip</option>
                {availableTrips.map(trip => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name}
                  </option>
                ))}
              </select>
            )}
            
            <div className="flex gap-2">
              <Button 
                onClick={handleSave}
                disabled={!formData.destinationName.trim() || saving}
                size="sm"
                className="flex-1"
              >
                {editingId ? 'Update' : 'Add'}
              </Button>
              {editingId && (
                <Button 
                  onClick={resetForm}
                  disabled={saving}
                  size="sm"
                  variant="outline"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Points of Interest List */}
        {pointsOfInterest.length === 0 ? (
          <div className="text-center py-6">
            <MapPin className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-3">No destinations saved yet</p>
            {!isEditing && canCreate() && (
              <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
                Add First Destination
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pointsOfInterest.map((poi) => (
              <div
                key={poi.id}
                className={`group border rounded-lg p-3 hover:bg-gray-50 transition-colors ${poi.link ? 'cursor-pointer' : ''}`}
                onClick={poi.link ? (e) => handleLinkClick(poi.link!, e) : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{poi.destinationName}</h4>
                    
                    {poi.address && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                        <Map className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{poi.address}</span>
                      </div>
                    )}
                    
                    {poi.notes && (
                      <div className="flex items-start gap-1 text-xs text-gray-600 mt-1">
                        <StickyNote className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{poi.notes}</span>
                      </div>
                    )}
                    
                    {poi.link && (
                      <div className="flex items-center gap-1 mt-1">
                        <ExternalLink className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-blue-600 truncate">
                          {poi.link}
                        </span>
                      </div>
                    )}
                    
                    {poi.trip && !tripId && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>Trip: {poi.trip.name}</span>
                      </div>
                    )}
                  </div>
                  
                  {canModify() && (
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(poi)}
                        className="p-1 h-auto"
                        disabled={saving}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteClick(poi, e)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-auto"
                        disabled={saving}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setPoiToDelete(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Point of Interest"
        message={`Are you sure you want to delete "${poiToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </Card>
  )
}