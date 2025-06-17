'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Trash2, Palette } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import type { Event, Expense } from '@prisma/client'
import { EVENT_COLORS, getEventColor, DEFAULT_EVENT_COLOR } from '@/lib/eventColors'

// API expects snake_case field names to match database columns
type EventFormData = {
  day_id: string
  title: string
  start_time: string
  end_time: string | null
  start_date: string
  end_date: string | null
  location: string | null
  notes: string | null
  weather: string | null
  loadout: string | null
  color: string
}

// Convert 24-hour time to 12-hour components
const to12HourComponents = (time24: string): { time: string, period: 'AM' | 'PM' } => {
  if (!time24) return { time: '12:00', period: 'AM' }
  
  const [hours, minutes] = time24.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  
  return {
    time: `${hour12}:${minutes.toString().padStart(2, '0')}`,
    period
  }
}

// Convert 12-hour components to 24-hour time
const to24HourTime = (time12: string, period: 'AM' | 'PM'): string => {
  const [hour, minute] = time12.split(':')
  let hour24 = parseInt(hour)
  
  if (period === 'AM') {
    if (hour24 === 12) hour24 = 0
  } else {
    if (hour24 !== 12) hour24 += 12
  }
  
  return `${hour24.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`
}

// Generate time options in 12-hour format (only 12 hours since AM/PM handles the distinction)
const TIME_OPTIONS_12H = [
  '12:00', '12:30', '1:00', '1:30', '2:00', '2:30', '3:00', '3:30',
  '4:00', '4:30', '5:00', '5:30', '6:00', '6:30', '7:00', '7:30',
  '8:00', '8:30', '9:00', '9:30', '10:00', '10:30', '11:00', '11:30'
]

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (event: EventInsert, expenses: Omit<Database['public']['Tables']['expenses']['Insert'], 'day_id' | 'event_id'>[]) => void
  onDelete?: (eventId: string) => void
  event?: Event | null
  dayId: string
  selectedTime?: string
  selectedEndTime?: string
  currentDate?: string
  selectedEndDate?: string
}

export default function EventModal({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  event, 
  dayId, 
  selectedTime,
  selectedEndTime,
  currentDate,
  selectedEndDate
}: EventModalProps) {
  const [formData, setFormData] = useState<EventFormData>({
    day_id: dayId,
    title: '',
    start_time: selectedTime || '09:00',
    end_time: selectedEndTime || '',
    start_date: currentDate || new Date().toISOString().split('T')[0],
    end_date: selectedEndDate || currentDate || new Date().toISOString().split('T')[0],
    location: '',
    notes: '',
    weather: '',
    loadout: '',
    color: DEFAULT_EVENT_COLOR
  })

  // 12-hour time state
  const [startTime12, setStartTime12] = useState(() => to12HourComponents(selectedTime || '09:00'))
  const [endTime12, setEndTime12] = useState(() => to12HourComponents(selectedEndTime || ''))

  const [expenses, setExpenses] = useState<Omit<Database['public']['Tables']['expenses']['Insert'], 'day_id' | 'event_id'>[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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

  useEffect(() => {
    if (event) {
      setFormData({
        day_id: event.day_id,
        title: event.title,
        start_time: event.start_time,
        end_time: event.end_time || '',
        start_date: event.start_date,
        end_date: event.end_date || event.start_date,
        location: event.location || '',
        notes: event.notes || '',
        weather: event.weather || '',
        loadout: event.loadout || '',
        color: event.color || DEFAULT_EVENT_COLOR
      })
      setStartTime12(to12HourComponents(event.start_time))
      setEndTime12(to12HourComponents(event.end_time || ''))
      fetchExistingExpenses(event.id)
    } else {
      setFormData({
        day_id: dayId,
        title: '',
        start_time: selectedTime || '09:00',
        end_time: selectedEndTime || '',
        start_date: currentDate || new Date().toISOString().split('T')[0],
        end_date: selectedEndDate || currentDate || new Date().toISOString().split('T')[0],
        location: '',
        notes: '',
        weather: '',
        loadout: '',
        color: DEFAULT_EVENT_COLOR
      })
      setStartTime12(to12HourComponents(selectedTime || '09:00'))
      setEndTime12(to12HourComponents(selectedEndTime || ''))
      setExpenses([])
    }
  }, [event, dayId, selectedTime, selectedEndTime, currentDate, selectedEndDate, fetchExistingExpenses])

  // Update 24-hour time when 12-hour components change
  useEffect(() => {
    const time24 = to24HourTime(startTime12.time, startTime12.period)
    setFormData((prev: EventFormData) => ({ ...prev, start_time: time24 }))
  }, [startTime12])

  useEffect(() => {
    if (endTime12.time && endTime12.time !== '12:00') {
      const time24 = to24HourTime(endTime12.time, endTime12.period)
      setFormData((prev: EventFormData) => ({ ...prev, end_time: time24 }))
    } else if (!endTime12.time) {
      setFormData((prev: EventFormData) => ({ ...prev, end_time: '' }))
    }
  }, [endTime12])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Set default end time if not provided
    let finalFormData = { ...formData }
    if (!finalFormData.end_time) {
      const [hours, minutes] = finalFormData.start_time.split(':').map(Number)
      const endMinutes = minutes === 0 ? 30 : 0
      const endHours = minutes === 30 ? hours + 1 : hours
      finalFormData.end_time = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
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


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'Create Event'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <label className="block text-sm font-medium mb-2">Start Time & Date *</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex gap-2">
                  <select
                    value={startTime12.time}
                    onChange={(e) => setStartTime12({ ...startTime12, time: e.target.value })}
                    className="flex-1 p-2 border rounded-md"
                  >
                    {TIME_OPTIONS_12H.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  <select
                    value={startTime12.period}
                    onChange={(e) => setStartTime12({ ...startTime12, period: e.target.value as 'AM' | 'PM' })}
                    className="w-20 p-2 border rounded-md"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
              <div>
                <input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">End Time & Date</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex gap-2">
                  <select
                    value={endTime12.time}
                    onChange={(e) => setEndTime12({ ...endTime12, time: e.target.value })}
                    className="flex-1 p-2 border rounded-md"
                  >
                    <option value="">--</option>
                    {TIME_OPTIONS_12H.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  <select
                    value={endTime12.period}
                    onChange={(e) => setEndTime12({ ...endTime12, period: e.target.value as 'AM' | 'PM' })}
                    className="w-20 p-2 border rounded-md"
                    disabled={!endTime12.time}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
              <div>
                <input
                  type="date"
                  value={formData.end_date || ''}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full p-2 border rounded-md"
              placeholder="Event location"
            />
          </div>

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