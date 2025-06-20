'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trash2, Palette, ChevronDown } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import type { Event, Expense } from '@prisma/client'
import { EVENT_COLORS, getEventColor, DEFAULT_EVENT_COLOR } from '@/lib/eventColors'
import { getTripDateInfo, getTripDateStyles } from '@/lib/tripDayUtils'
import { TIME_SLOTS, formatTimeSlot, getNextTimeSlot, getValidEndTimeOptions } from '@/lib/timeSlotUtils'

interface Destination {
  name: string
  link?: string
}

// API data format for events
type EventApiData = {
  dayId: string
  title: string
  startSlot: string
  endSlot: string | null
  location: string | null
  notes: string | null
  weather: string | null
  loadout: string | null
  color: string
}

type ExpenseInsert = { description: string; amount: number; category?: string }

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (event: EventApiData, expenses: ExpenseInsert[]) => void
  onDelete?: (eventId: string) => void
  event?: Event | null
  dayId: string
  startSlot?: string
  endSlot?: string
  tripStartDate?: string
  tripEndDate?: string
}

export default function EventModal({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  event, 
  dayId, 
  startSlot,
  endSlot,
  tripStartDate,
  tripEndDate
}: EventModalProps) {
  const [formData, setFormData] = useState<EventApiData>({
    dayId: dayId,
    title: '',
    startSlot: startSlot || '09:00',
    endSlot: endSlot || getNextTimeSlot(startSlot || '09:00'),
    location: '',
    notes: '',
    weather: '',
    loadout: '',
    color: DEFAULT_EVENT_COLOR
  })

  const [expenses, setExpenses] = useState<ExpenseInsert[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false)

  const fetchExistingExpenses = useCallback(async (eventId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}`)
      
      if (!response.ok) {
        console.error('Error fetching event expenses:', response.statusText)
        return
      }

      const data = await response.json()
      
      if (data.event?.expenses) {
        const existingExpenses = data.event.expenses.map((expense: Expense) => ({
          description: expense.description,
          amount: expense.amount,
          category: expense.category || ''
        }))
        setExpenses(existingExpenses)
      }
    } catch (error) {
      console.error('Error fetching existing expenses:', error)
    }
  }, [])

  const fetchDestinations = useCallback(async () => {
    try {
      const response = await fetch('/api/groups/current')
      
      if (response.ok) {
        const data = await response.json()
        const saved = data.group.savedDestinations
        if (saved) {
          // Handle both old string format and new JSON format
          if (typeof saved === 'string') {
            // Legacy format: comma-delimited strings
            const legacyDestinations = saved.split(',').map((dest: string) => ({
              name: dest.trim(),
              link: undefined
            })).filter((dest: Destination) => dest.name)
            setDestinations(legacyDestinations)
          } else if (Array.isArray(saved)) {
            // New format: array of objects
            setDestinations(saved.filter((dest: Destination) => dest.name))
          } else {
            setDestinations([])
          }
        } else {
          setDestinations([])
        }
      }
    } catch (error) {
      console.error('Error fetching destinations:', error)
    }
  }, [])

  useEffect(() => {
    fetchDestinations()
    
    if (event) {
      setFormData({
        dayId: event.dayId,
        title: event.title,
        startSlot: event.startSlot,
        endSlot: event.endSlot,
        location: event.location || '',
        notes: event.notes || '',
        weather: event.weather || '',
        loadout: event.loadout || '',
        color: event.color || DEFAULT_EVENT_COLOR
      })
      fetchExistingExpenses(event.id)
    } else {
      setFormData({
        dayId: dayId,
        title: '',
        startSlot: startSlot || '09:00',
        endSlot: endSlot || getNextTimeSlot(startSlot || '09:00'),
        location: '',
        notes: '',
        weather: '',
        loadout: '',
        color: DEFAULT_EVENT_COLOR
      })
      setExpenses([])
    }
  }, [event, dayId, startSlot, endSlot, fetchExistingExpenses, fetchDestinations])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Ensure end slot is set
    let finalFormData = { ...formData }
    if (!finalFormData.endSlot) {
      finalFormData.endSlot = getNextTimeSlot(finalFormData.startSlot)
    }
    
    onSave(finalFormData, expenses)
    onClose()
  }

  const addExpense = () => {
    setExpenses([...expenses, { description: '', amount: 0, category: '' }])
  }

  const updateExpense = (index: number, field: string, value: any) => {
    const newExpenses = [...expenses]
    newExpenses[index] = { ...newExpenses[index], [field]: value }
    setExpenses(newExpenses)
  }

  const removeExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index))
  }

  const handleDeleteConfirm = () => {
    if (!event || !onDelete) return
    onDelete(event.id)
    onClose()
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (showDestinationDropdown && !target.closest('.location-dropdown-container')) {
        setShowDestinationDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDestinationDropdown])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setShowDestinationDropdown(false)
      }
      onClose()
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Create Event'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Event Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              onFocus={(e) => e.target.select()}
              className="w-full p-2 border rounded-md"
              placeholder="Event title"
            />
          </div>

          {/* Time Slots */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Time *</label>
              <select
                value={formData.startSlot}
                onChange={(e) => {
                  const newStartSlot = e.target.value
                  const validEndTimes = getValidEndTimeOptions(newStartSlot)
                  
                  // Update start slot
                  setFormData(prev => {
                    // If current end slot is before or equal to new start slot, update it
                    if (prev.endSlot && !validEndTimes.includes(prev.endSlot)) {
                      return {
                        ...prev,
                        startSlot: newStartSlot,
                        endSlot: getNextTimeSlot(newStartSlot)
                      }
                    }
                    return { ...prev, startSlot: newStartSlot }
                  })
                }}
                className="w-full p-2 border rounded-md"
              >
                {TIME_SLOTS.map(slot => (
                  <option key={slot} value={slot}>{formatTimeSlot(slot)}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">End Time</label>
              <select
                value={formData.endSlot || ''}
                onChange={(e) => setFormData({ ...formData, endSlot: e.target.value || null })}
                className="w-full p-2 border rounded-md"
              >
                <option value="">--</option>
                {getValidEndTimeOptions(formData.startSlot).map(slot => (
                  <option key={slot} value={slot}>{formatTimeSlot(slot)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <div className="relative location-dropdown-container">
              <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                onFocus={() => setShowDestinationDropdown(true)}
                className="w-full p-2 pr-8 border rounded-md"
                placeholder="Event location or select from Points of Interest"
              />
              {destinations.length > 0 && (
                <ChevronDown 
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer"
                  onClick={() => setShowDestinationDropdown(!showDestinationDropdown)}
                />
              )}
              
              {/* Dropdown for Points of Interest */}
              {showDestinationDropdown && destinations.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  <div className="p-2 text-xs text-gray-500 border-b">
                    Points of Interest ({destinations.length})
                  </div>
                  {destinations.map((destination, index) => (
                    <div
                      key={index}
                      className="p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => {
                        setFormData({ ...formData, location: destination.name })
                        setShowDestinationDropdown(false)
                      }}
                    >
                      <div className="font-medium text-sm">{destination.name}</div>
                      {destination.link && (
                        <div className="text-xs text-gray-500 truncate mt-1">
                          {destination.link}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {destinations.length === 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Add destinations to Points of Interest to see them here
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-2 border rounded-md"
              rows={3}
              placeholder="Additional notes..."
            />
          </div>

          {/* Event Color */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <Palette className="inline-block w-4 h-4 mr-1" />
              Event Color
            </label>
            <div className="grid grid-cols-5 gap-2">
              {EVENT_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.color })}
                  className={`relative h-12 rounded-lg border-2 transition-all ${
                    formData.color === color.color 
                      ? 'border-gray-900 scale-105 shadow-lg' 
                      : 'border-gray-300 hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: color.color }}
                  title={color.name}
                >
                  {formData.color === color.color && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Expenses */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium">Expenses</label>
              <Button type="button" onClick={addExpense} size="sm">
                Add Expense
              </Button>
            </div>
            {expenses.map((expense, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                <input
                  type="text"
                  value={expense.description}
                  onChange={(e) => updateExpense(index, 'description', e.target.value)}
                  className="col-span-6 p-2 border rounded-md"
                  placeholder="Description"
                />
                <input
                  type="number"
                  value={expense.amount}
                  onChange={(e) => updateExpense(index, 'amount', parseFloat(e.target.value) || 0)}
                  className="col-span-3 p-2 border rounded-md"
                  placeholder="Amount"
                  step="0.01"
                />
                <input
                  type="text"
                  value={expense.category || ''}
                  onChange={(e) => updateExpense(index, 'category', e.target.value)}
                  className="col-span-2 p-2 border rounded-md"
                  placeholder="Category"
                />
                <Button
                  type="button"
                  onClick={() => removeExpense(index)}
                  size="sm"
                  variant="destructive"
                  className="col-span-1"
                >
                  ×
                </Button>
              </div>
            ))}
            {expenses.length > 0 && (
              <div className="text-right mt-2">
                <span className="font-medium">Total: ${expenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between gap-2 pt-4">
            <div>
              {event && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {event ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Event"
        message="Are you sure you want to delete this event? This action cannot be undone."
      />
    </Dialog>
  )
}