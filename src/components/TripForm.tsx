'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface TripFormProps {
  startDate: Date
  endDate: Date
  onSubmit: (tripData: {
    name: string
    destination: string
    startDate: string
    endDate: string
  }) => void
  onCancel: () => void
  open?: boolean
}

export default function TripForm({ startDate, endDate, onSubmit, onCancel, open = true }: TripFormProps) {
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name,
      destination,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    })
  }

  const tripDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent onClose={onCancel}>
        <DialogHeader>
          <DialogTitle>Create New Trip</DialogTitle>
          <DialogDescription>
            Plan your {tripDuration}-day adventure from {format(startDate, 'MMM d, yyyy')} to {format(new Date(endDate.getTime() - 86400000), 'MMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
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
              Create Trip
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}