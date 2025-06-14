import { Trip } from '../../domain/entities/Trip';
import { TripDay } from '../../domain/entities/TripDay';
import { Event } from '../../domain/entities/Event';
import { Expense } from '../../domain/entities/Expense';
import { TripDTO, TripDayDTO, EventDTO, ExpenseDTO, TripListDTO } from '../dto/TripDTO';

export class TripMapper {
  toDTO(trip: Trip): TripDTO {
    const totalExpenses = trip.getTotalExpenses();
    
    return {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      startDate: trip.dateRange.startDate.toISOString().split('T')[0],
      endDate: trip.dateRange.endDate.toISOString().split('T')[0],
      userId: trip.userId.value,
      duration: trip.getDuration(),
      eventsCount: trip.getEventsCount(),
      totalExpenses: {
        amount: totalExpenses.amount,
        currency: totalExpenses.currency,
      },
      hasEvents: trip.hasEvents(),
      days: trip.days.map(day => this.mapTripDayToDTO(day)),
    };
  }

  toListDTO(trip: Trip): TripListDTO {
    const totalExpenses = trip.getTotalExpenses();
    
    return {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      startDate: trip.dateRange.startDate.toISOString().split('T')[0],
      endDate: trip.dateRange.endDate.toISOString().split('T')[0],
      duration: trip.getDuration(),
      eventsCount: trip.getEventsCount(),
      totalExpenses: {
        amount: totalExpenses.amount,
        currency: totalExpenses.currency,
      },
    };
  }

  private mapTripDayToDTO(day: TripDay): TripDayDTO {
    return {
      id: day.id,
      tripId: day.tripId,
      dayNumber: day.dayNumber,
      date: day.date.toISOString().split('T')[0],
      hasEvents: day.hasEvents(),
      events: day.events.map(event => this.mapEventToDTO(event)),
    };
  }

  private mapEventToDTO(event: Event): EventDTO {
    const totalExpenses = event.getTotalExpenses();
    
    return {
      id: event.id,
      dayId: event.dayId,
      title: event.title,
      description: event.description || undefined,
      startTime: event.startTime || undefined,
      endTime: event.endTime || undefined,
      location: event.location || undefined,
      color: event.color,
      hasExpenses: event.hasExpenses(),
      totalExpenses: {
        amount: totalExpenses.amount,
        currency: totalExpenses.currency,
      },
      expenses: event.expenses.map(expense => this.mapExpenseToDTO(expense)),
    };
  }

  private mapExpenseToDTO(expense: Expense): ExpenseDTO {
    return {
      id: expense.id,
      eventId: expense.eventId,
      description: expense.description,
      amount: expense.amount.amount,
      currency: expense.amount.currency,
      category: expense.category,
    };
  }
}