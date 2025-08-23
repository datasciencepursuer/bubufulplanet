'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, Palette, MousePointer2, Edit, ChevronDown } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import type { Event, Expense } from '@prisma/client'
import { EVENT_COLORS, getEventColor, DEFAULT_EVENT_COLOR } from '@/lib/eventColors'
import { getTripDateInfo, getTripDateStyles } from '@/lib/tripDayUtils'
import { normalizeDate, createAbsoluteDate, extractTimeString, to12HourComponents, to24HourTime, TIME_OPTIONS_12H, calculateDefaultEndTime } from '@/lib/dateTimeUtils'
import { format } from 'date-fns'
import { createGroupedFetch } from '@/lib/groupUtils'

interface Destination {
  name: string
  link?: string
}

type EventInsert = Omit<Event, 'id' | 'createdAt'>
type ExpenseInsert = { description: string; amount: number; category?: string }

// API data format for events (camelCase) - matches EventModal and backend API
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

// Form data for internal use (includes date fields for UI)
type EventFormData = {
  dayId: string
  title: string
  startSlot: string
  endSlot: string | null
  startDate: string
  endDate: string | null
  location: string | null
  notes: string | null
  weather: string | null
  loadout: string | null
  color: string
}


interface PersistentEventModalProps {
  selectedEvent?: Event | null
  expenses?: Expense[]
  onSave: (event: EventApiData, expenses: ExpenseInsert[]) => void
  onDelete?: (eventId: string) => void
  dayId?: string
  selectedTime?: string
  selectedEndTime?: string
  currentDate?: string
  selectedEndDate?: string
  tripStartDate?: string
  tripEndDate?: string
  isEditMode?: boolean
  onEditModeChange?: (isEdit: boolean) => void
}

export default function PersistentEventModal({ 
  selectedEvent,
  expenses: initialExpenses = [],
  onSave,
  onDelete,
  dayId = '',
  selectedTime,
  selectedEndTime,
  currentDate,
  selectedEndDate,
  tripStartDate,
  tripEndDate,
  isEditMode = false,
  onEditModeChange
}: PersistentEventModalProps) {
  const [formData, setFormData] = useState<EventFormData>({
    dayId: dayId,
    title: '',
    startSlot: selectedTime || '09:00',
    endSlot: selectedEndTime || '',
    startDate: currentDate || normalizeDate(new Date()),
    endDate: selectedEndDate || currentDate || normalizeDate(new Date()),
    location: '',
    notes: '',
    weather: '',
    loadout: '',
    color: DEFAULT_EVENT_COLOR
  })

  // 12-hour time state
  const [startTime12, setStartTime12] = useState(() => to12HourComponents(selectedTime || '09:00'))
  const [endTime12, setEndTime12] = useState(() => to12HourComponents(selectedEndTime || '10:00'))

  const [expenses, setExpenses] = useState<ExpenseInsert[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false)

  const fetchDestinations = useCallback(async () => {
    try {
      const groupedFetch = createGroupedFetch()
      const response = await groupedFetch('/api/groups/current')
      
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
          amount: typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount.toString()),
          category: expense.category || ''
        }))
        setExpenses(existingExpenses)
      }
    } catch (error) {
      console.error('Error fetching existing expenses:', error)
    }
  }, [])

  useEffect(() => {
    fetchDestinations()
    
    if (selectedEvent && isEditMode) {
      const startTimeStr = selectedEvent.startSlot || '09:00'
      const endTimeStr = selectedEvent.endSlot || ''
      const startDateStr = currentDate || normalizeDate(new Date())
      const endDateStr = startDateStr
      
      setFormData({
        dayId: selectedEvent.dayId,
        title: selectedEvent.title,
        startSlot: startTimeStr,
        endSlot: endTimeStr,
        startDate: startDateStr,
        endDate: endDateStr,
        location: selectedEvent.location || '',
        notes: selectedEvent.notes || '',
        weather: selectedEvent.weather || '',
        loadout: selectedEvent.loadout || '',
        color: selectedEvent.color || DEFAULT_EVENT_COLOR
      })
      setStartTime12(to12HourComponents(startTimeStr))
      setEndTime12(to12HourComponents(endTimeStr))
      fetchExistingExpenses(selectedEvent.id)
    } else if (!selectedEvent) {
      setFormData({
        dayId: dayId,
        title: '',
        startSlot: selectedTime || '09:00',
        endSlot: selectedEndTime || '',
        startDate: currentDate || normalizeDate(new Date()),
        endDate: selectedEndDate || currentDate || normalizeDate(new Date()),
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
  }, [selectedEvent, isEditMode, dayId, selectedTime, selectedEndTime, currentDate, selectedEndDate, fetchExistingExpenses, fetchDestinations])

  // Update expenses from props
  useEffect(() => {
    if (selectedEvent && !isEditMode && initialExpenses.length > 0) {
      const eventExpenses = initialExpenses
        .filter(expense => expense.eventId === selectedEvent.id)
        .map(expense => ({
          description: expense.description,
          amount: typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount.toString()),
          category: expense.category || ''
        }))
      setExpenses(eventExpenses)
    }
  }, [selectedEvent, initialExpenses, isEditMode])

  // Update 24-hour time when 12-hour components change
  useEffect(() => {
    const time24 = to24HourTime(startTime12.time, startTime12.period)
    setFormData((prev: EventFormData) => ({ ...prev, startSlot: time24 }))
  }, [startTime12])

  useEffect(() => {
    if (endTime12.time && endTime12.time !== '12:00') {
      const time24 = to24HourTime(endTime12.time, endTime12.period)
      setFormData((prev: EventFormData) => ({ ...prev, endSlot: time24 }))
    } else if (!endTime12.time) {
      setFormData((prev: EventFormData) => ({ ...prev, endSlot: null }))
    }
  }, [endTime12])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Set default end time if not provided
    let finalFormData = { ...formData }
    if (!finalFormData.endSlot) {
      finalFormData.endSlot = finalFormData.startSlot // Use same slot for default
    }
    
    // Convert to API format (camelCase)
    const eventApiData: EventApiData = {
      dayId: finalFormData.dayId,
      title: finalFormData.title,
      startSlot: finalFormData.startSlot,
      endSlot: finalFormData.endSlot,
      location: finalFormData.location,
      notes: finalFormData.notes,
      weather: finalFormData.weather,
      loadout: finalFormData.loadout,
      color: finalFormData.color
    }
    
    onSave(eventApiData, expenses)
    if (onEditModeChange) {
      onEditModeChange(false)
    }
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
    if (!selectedEvent || !onDelete) return
    onDelete(selectedEvent.id)
    if (onEditModeChange) {
      onEditModeChange(false)
    }
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

  const handleEditToggle = () => {
    if (onEditModeChange) {
      onEditModeChange(!isEditMode)
    }
  }

  // Show instructions when no event is selected AND not in edit mode
  if (!selectedEvent && !isEditMode) {
    return (
      <div className="bg-white rounded-lg border h-full flex flex-col">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Event Details</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-gray-500">
            <MousePointer2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg mb-2">No event selected</p>
            <p className="text-sm">
              Click an empty time slot to create an event<br />
              Click an event to preview details<br />
              Double-click an event to edit
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show event preview when event is selected but not in edit mode
  if (selectedEvent && !isEditMode) {
    return (
      <div className="bg-white rounded-lg border h-full flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Event Details</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEditToggle}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <h4 className="text-xl font-semibold text-gray-900">{selectedEvent.title}</h4>
            {selectedEvent.location && (
              <p className="text-gray-600 mt-1">{selectedEvent.location}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <div className="text-sm text-gray-900">
                {selectedEvent.startSlot || 'No start time'}
              </div>
              <div className="text-sm text-gray-600">
                {currentDate ? format(createAbsoluteDate(normalizeDate(currentDate)), 'MMM d, yyyy') : 'No date'}
              </div>
              {tripStartDate && tripEndDate && currentDate && (
                <div className="text-xs mt-1">
                  {(() => {
                    const dateInfo = getTripDateInfo(new Date(currentDate), tripStartDate, tripEndDate)
                    const styles = getTripDateStyles(dateInfo)
                    
                    return styles.dayLabel.show && (
                      <span className={styles.dayLabel.className}>
                        {styles.dayLabel.text}{dateInfo.dateType === 'trip-day' ? ' of trip' : ''}
                      </span>
                    )
                  })()}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
              <div className="text-sm text-gray-900">
                {selectedEvent.endSlot || 'No end time'}
              </div>
              <div className="text-sm text-gray-600">
                {/* End date is same as start date for time slots */}
              </div>
            </div>
          </div>

          {selectedEvent.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedEvent.notes}</p>
            </div>
          )}

          {expenses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Expenses</label>
              <div className="space-y-2">
                {expenses.map((expense, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div>
                      <div className="text-sm font-medium">{expense.description}</div>
                      {expense.category && (
                        <div className="text-xs text-gray-500">{expense.category}</div>
                      )}
                    </div>
                    <div className="text-sm font-medium">${expense.amount.toFixed(2)}</div>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Total:</span>
                  <span>${expenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded border"
              style={{ backgroundColor: selectedEvent.color || DEFAULT_EVENT_COLOR }}
            />
            <span className="text-sm text-gray-600">Event Color</span>
          </div>
        </div>
      </div>
    )
  }

  // Show edit form when in edit mode
  return (
    <div className="bg-white rounded-lg border h-full flex flex-col">
      <div className="p-6 border-b flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          {selectedEvent ? 'Edit Event' : 'Create Event'}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEditModeChange && onEditModeChange(false)}
        >
          Cancel
        </Button>
      </div>
      
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
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
          {tripStartDate && tripEndDate && formData.startDate && (
            <div className="mb-2 text-sm text-gray-600">
              {(() => {
                const dateInfo = getTripDateInfo(new Date(formData.startDate), tripStartDate, tripEndDate)
                const styles = getTripDateStyles(dateInfo)
                
                return styles.dayLabel.show && (
                  <span className={styles.dayLabel.className}>
                    {styles.dayLabel.text}{dateInfo.dateType === 'trip-day' ? ' of trip' : ''}
                  </span>
                )
              })()
              }
            </div>
          )}
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
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full p-2 border rounded-md"
              />
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">End Time & Date</label>
          {tripStartDate && tripEndDate && formData.endDate && (
            <div className="mb-2 text-sm text-gray-600">
              {(() => {
                const dateInfo = getTripDateInfo(new Date(formData.endDate), tripStartDate, tripEndDate)
                const styles = getTripDateStyles(dateInfo)
                
                return styles.dayLabel.show && (
                  <span className={styles.dayLabel.className}>
                    {styles.dayLabel.text}{dateInfo.dateType === 'trip-day' ? ' of trip' : ''}
                  </span>
                )
              })()
              }
            </div>
          )}
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
                value={formData.endDate || ''}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full p-2 border rounded-md"
              />
            </div>
          </div>
        </div>

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

        <div className="flex justify-between gap-2 pt-4 border-t">
          <div>
            {selectedEvent && onDelete && (
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
            <Button type="submit">
              {selectedEvent ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Event"
        message="Are you sure you want to delete this event? This action cannot be undone."
      />
    </div>
  )
}