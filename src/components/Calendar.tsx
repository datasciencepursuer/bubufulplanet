'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { DateSelectArg } from '@fullcalendar/core'
import { useState } from 'react'
import { format } from 'date-fns'

interface CalendarProps {
  onTripSelect: (startDate: Date, endDate: Date) => void
  existingTrips?: Array<{
    id: string
    title: string
    start: string
    end: string
  }>
}

export default function Calendar({ onTripSelect, existingTrips = [] }: CalendarProps) {
  const [selectedDates, setSelectedDates] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  })

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    const start = selectInfo.start
    const end = selectInfo.end
    
    setSelectedDates({ start, end })
    onTripSelect(start, end)
  }

  return (
    <div className="rounded-2xl glass shadow-modern overflow-hidden">
      <div className="p-6">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek'
          }}
          initialView='dayGridMonth'
          selectable={true}
          selectMirror={true}
          select={handleDateSelect}
          events={existingTrips}
          height="auto"
        />
      </div>
      {selectedDates.start && selectedDates.end && (
        <div className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 p-4 border-t border-teal-200/20">
          <p className="text-sm font-medium text-teal-800">
            ✈️ Selected dates: {format(selectedDates.start, 'MMM d, yyyy')} - {format(selectedDates.end, 'MMM d, yyyy')}
          </p>
        </div>
      )}
    </div>
  )
}