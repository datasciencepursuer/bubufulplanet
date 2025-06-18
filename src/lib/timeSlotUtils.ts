// Simple time slot utilities for calendar views

export const TIME_SLOTS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', 
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
]

// Convert 24-hour time slot to 12-hour format for display
export function formatTimeSlot(timeSlot: string): string {
  const [hours, minutes] = timeSlot.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

// Get the next time slot (for default end time)
export function getNextTimeSlot(timeSlot: string): string {
  const currentIndex = TIME_SLOTS.indexOf(timeSlot)
  if (currentIndex === -1 || currentIndex === TIME_SLOTS.length - 1) {
    return timeSlot // Return same slot if not found or is last slot
  }
  return TIME_SLOTS[currentIndex + 1]
}

// Check if one time slot is before another
export function isTimeSlotBefore(timeSlot1: string, timeSlot2: string): boolean {
  const index1 = TIME_SLOTS.indexOf(timeSlot1)
  const index2 = TIME_SLOTS.indexOf(timeSlot2)
  return index1 < index2
}

// Get time slots between start and end (inclusive)
export function getTimeSlotRange(startSlot: string, endSlot: string): string[] {
  const startIndex = TIME_SLOTS.indexOf(startSlot)
  const endIndex = TIME_SLOTS.indexOf(endSlot)
  
  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    return [startSlot]
  }
  
  return TIME_SLOTS.slice(startIndex, endIndex + 1)
}

// Validate time slot format
export function isValidTimeSlot(timeSlot: string): boolean {
  return TIME_SLOTS.includes(timeSlot)
}