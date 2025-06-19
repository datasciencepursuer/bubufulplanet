'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface TripFormProps {
  startDate?: Date
  endDate?: Date
  onSubmit: (tripData: {
    name: string
    destination: string
    startDate: string
    endDate: string
  }) => void
  onCancel: () => void
  open?: boolean
  // Edit mode props
  isEdit?: boolean
  existingTrip?: {
    id: string
    name: string
    destination: string | null
    startDate: Date
    endDate: Date
  }
}

export default function TripForm({ 
  startDate, 
  endDate, 
  onSubmit, 
  onCancel, 
  open = true, 
  isEdit = false, 
  existingTrip 
}: TripFormProps) {
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')

  // Initialize form data
  useEffect(() => {
    if (isEdit && existingTrip) {
      setName(existingTrip.name)
      setDestination(existingTrip.destination || '')
      setEditStartDate(format(new Date(existingTrip.startDate), 'yyyy-MM-dd'))
      setEditEndDate(format(new Date(existingTrip.endDate), 'yyyy-MM-dd'))
    } else {
      setName('')
      setDestination('')
      if (startDate && endDate) {
        setEditStartDate(format(startDate, 'yyyy-MM-dd'))
        setEditEndDate(format(endDate, 'yyyy-MM-dd'))
      }
    }
  }, [isEdit, existingTrip, startDate, endDate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const submitStartDate = isEdit ? editStartDate : (startDate ? format(startDate, 'yyyy-MM-dd') : editStartDate)
    const submitEndDate = isEdit ? editEndDate : (endDate ? format(endDate, 'yyyy-MM-dd') : editEndDate)
    
    onSubmit({
      name,
      destination,
      startDate: submitStartDate,
      endDate: submitEndDate,
    })
  }

  // Calculate duration based on current dates (inclusive range)
  const currentStartDate = isEdit ? new Date(editStartDate) : startDate
  const currentEndDate = isEdit ? new Date(editEndDate) : endDate
  const tripDuration = currentStartDate && currentEndDate 
    ? Math.floor((currentEndDate.getTime() - currentStartDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  // Check if dates changed in edit mode
  const datesChanged = isEdit && existingTrip && (
    editStartDate !== format(new Date(existingTrip.startDate), 'yyyy-MM-dd') ||
    editEndDate !== format(new Date(existingTrip.endDate), 'yyyy-MM-dd')
  )

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent onClose={onCancel}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Trip' : 'Create New Trip'}</DialogTitle>
          <DialogDescription>
            {isEdit ? (
              `Edit your ${tripDuration}-day trip${currentStartDate && currentEndDate ? ` from ${format(currentStartDate, 'MMM d, yyyy')} to ${format(new Date(currentEndDate.getTime() - 86400000), 'MMM d, yyyy')}` : ''}`
            ) : (
              `Plan your ${tripDuration}-day adventure from ${format(startDate!, 'MMM d, yyyy')} to ${format(new Date(endDate!.getTime() - 86400000), 'MMM d, yyyy')}`
            )}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Date Section */}
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-teal-800 mb-2">
                {isEdit ? 'Trip Dates' : 'Selected Trip Dates'}
              </h3>
              
              {datesChanged && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Warning:</span>
                    <span>Changing dates will delete all existing events and expenses.</span>
                  </div>
                </div>
              )}
              
              {isEdit ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="startDate" className="text-xs font-medium text-gray-600 block mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        id="startDate"
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-teal-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="endDate" className="text-xs font-medium text-gray-600 block mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        id="endDate"
                        value={editEndDate}
                        onChange={(e) => setEditEndDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-teal-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-200 focus:outline-none"
                        required
                        min={editStartDate}
                      />
                    </div>
                  </div>
                  {currentStartDate && currentEndDate && (
                    <div className="flex justify-between items-center text-sm border-t border-teal-200 pt-2 mt-2">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium text-teal-700">{tripDuration} day{tripDuration !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Start Date:</span>
                    <span className="font-medium text-teal-700">{startDate ? format(startDate, 'EEEE, MMM d, yyyy') : 'Not set'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">End Date:</span>
                    <span className="font-medium text-teal-700">{endDate ? format(new Date(endDate.getTime() - 86400000), 'EEEE, MMM d, yyyy') : 'Not set'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t border-teal-200 pt-2 mt-2">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium text-teal-700">{tripDuration} day{tripDuration !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium">
                Trip Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="modern-input flex h-11 w-full rounded-lg px-4 py-2 text-base placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                required
                placeholder="Summer Vacation 2024"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="destination" className="text-sm font-medium">
                Destination
              </label>
              <input
                type="text"
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="modern-input flex h-11 w-full rounded-lg px-4 py-2 text-base placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Paris, France"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {isEdit ? 'Update Trip' : 'Create Trip'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}