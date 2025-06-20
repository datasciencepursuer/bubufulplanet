'use client'

import { Calendar, Clock, MapPin, DollarSign, Palette, FileText, Edit, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Event, Expense } from '@prisma/client'
import { getEventColor } from '@/lib/eventColors'
import { formatDateRange, extractTimeString, normalizeDate } from '@/lib/tripDayUtils'

interface EventPropertiesPanelProps {
  selectedEvent: Event | null
  expenses: Expense[]
  position?: { top: number; left: number } | null
  onEditEvent?: (event: Event) => void
  onClearSelection?: () => void
}

export default function EventPropertiesPanel({
  selectedEvent,
  expenses,
  position,
  onEditEvent,
  onClearSelection
}: EventPropertiesPanelProps) {

  if (!selectedEvent) {
    return null
  }

  const eventColor = getEventColor(selectedEvent.color || '#fbf2c4')
  const eventExpenses = expenses.filter(expense => expense.eventId === selectedEvent.id)
  const totalExpenses = eventExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)


  return (
    <>
      {/* Invisible overlay to catch clicks outside */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 z-40"
          onClick={onClearSelection}
        />
      )}
      
      {/* Panel */}
      <div 
        className="fixed right-0 top-0 h-full z-50 w-96 transform transition-transform duration-300 ease-out"
        style={{
          transform: selectedEvent ? 'translateX(0)' : 'translateX(100%)'
        }}
      >
        <div className="h-full overflow-y-auto bg-white shadow-2xl border-l-2 border-gray-300">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-cyan-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Event Details</h3>
            <div className="flex items-center gap-2">
              {onEditEvent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditEvent(selectedEvent)}
                  className="h-8 px-2"
                  title="Edit Event"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
              {onClearSelection && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearSelection}
                  className="h-8 px-2 hover:bg-red-50 hover:border-red-300"
                  title="Close Panel"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Event Content */}
        <div className="p-4 space-y-4">
          {/* Title */}
          <div className="flex items-start gap-3">
            <div
              className="w-4 h-4 rounded-full border border-gray-300 mt-1 flex-shrink-0"
              style={{ backgroundColor: eventColor.color }}
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-lg font-medium text-gray-900 break-words">{selectedEvent.title}</h4>
            </div>
          </div>

          {/* Location */}
          {selectedEvent.location && (
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <span className="break-words">{selectedEvent.location}</span>
            </div>
          )}

          {/* Date & Time */}
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <Calendar className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <span className="break-words">
              {selectedEvent.startSlot}
              {selectedEvent.endSlot && ` - ${selectedEvent.endSlot}`}
            </span>
          </div>

          {/* Notes */}
          {selectedEvent.notes && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <FileText className="h-4 w-4 text-gray-500" />
                <span>Notes</span>
              </div>
              <div className="text-sm text-gray-600 break-words bg-gray-50 p-3 rounded">
                {selectedEvent.notes}
              </div>
            </div>
          )}

          {/* Expenses */}
          {eventExpenses.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <DollarSign className="h-4 w-4 text-gray-500" />
                <span>Expenses</span>
                <span className="ml-auto font-semibold text-green-600">
                  ${totalExpenses.toFixed(2)}
                </span>
              </div>
              <div className="space-y-2">
                {eventExpenses.map((expense) => (
                  <div key={expense.id} className="bg-gray-50 p-3 rounded">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 break-words">{expense.description}</div>
                        {expense.category && (
                          <div className="text-xs text-gray-500 mt-1">{expense.category}</div>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 ml-2">
                        ${expense.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event Color Info */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Palette className="h-3 w-3" />
              <span>Color: {eventColor.name}</span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  )
}