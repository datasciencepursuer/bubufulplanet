import { SupabaseClient } from '@supabase/supabase-js';
import { ITripRepository } from '../../domain/repositories/ITripRepository';
import { Trip } from '../../domain/entities/Trip';
import { TripDay } from '../../domain/entities/TripDay';
import { Event } from '../../domain/entities/Event';
import { Expense } from '../../domain/entities/Expense';
import { UserId } from '../../domain/value-objects/UserId';
import { DateRange } from '../../domain/value-objects/DateRange';
import { Money } from '../../domain/value-objects/Money';
import { EventColor } from '../../domain/entities/Event';
import { ExpenseCategory } from '../../domain/entities/Expense';

export class SupabaseTripRepository implements ITripRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findById(id: string): Promise<Trip | null> {
    const { data: tripData, error: tripError } = await this.supabase
      .from('trips')
      .select(`
        *,
        trip_days:trip_days(
          *,
          events:events(
            *,
            expenses:expenses(*)
          )
        )
      `)
      .eq('id', id)
      .single();

    if (tripError || !tripData) {
      return null;
    }

    return this.mapToDomainEntity(tripData as any);
  }

  async findByUserId(userId: UserId): Promise<Trip[]> {
    const { data: tripsData, error } = await this.supabase
      .from('trips')
      .select(`
        *,
        trip_days:trip_days(
          *,
          events:events(
            *,
            expenses:expenses(*)
          )
        )
      `)
      .eq('user_id', userId.value)
      .order('created_at', { ascending: false });

    if (error || !tripsData) {
      return [];
    }

    return tripsData.map(tripData => this.mapToDomainEntity(tripData as any));
  }

  async save(trip: Trip): Promise<void> {
    const { error: tripError } = await this.supabase
      .from('trips')
      .upsert({
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        start_date: trip.dateRange.startDate.toISOString().split('T')[0],
        end_date: trip.dateRange.endDate.toISOString().split('T')[0],
        user_id: trip.userId.value,
        updated_at: new Date().toISOString(),
      });

    if (tripError) {
      throw new Error(`Failed to save trip: ${tripError.message}`);
    }

    // Save trip days
    if (trip.days.length > 0) {
      const { error: daysError } = await this.supabase
        .from('trip_days')
        .upsert(
          trip.days.map(day => ({
            id: day.id,
            trip_id: trip.id,
            day_number: day.dayNumber,
            date: day.date.toISOString().split('T')[0],
          }))
        );

      if (daysError) {
        throw new Error(`Failed to save trip days: ${daysError.message}`);
      }

      // Save events and expenses
      for (const day of trip.days) {
        if (day.events.length > 0) {
          const { error: eventsError } = await this.supabase
            .from('events')
            .upsert(
              day.events.map(event => ({
                id: event.id,
                day_id: event.dayId,
                title: event.title,
                notes: event.description,
                start_time: event.startTime || '',
                end_time: event.endTime,
                start_date: day.date.toISOString().split('T')[0],
                end_date: day.date.toISOString().split('T')[0],
                location: event.location,
                color: event.color,
              }))
            );

          if (eventsError) {
            throw new Error(`Failed to save events: ${eventsError.message}`);
          }

          // Save expenses for each event
          for (const event of day.events) {
            if (event.expenses.length > 0) {
              const { error: expensesError } = await this.supabase
                .from('expenses')
                .upsert(
                  event.expenses.map(expense => ({
                    id: expense.id,
                    event_id: expense.eventId,
                    day_id: day.id,
                    description: expense.description,
                    amount: expense.amount.amount,
                    category: expense.category,
                  }))
                );

              if (expensesError) {
                throw new Error(`Failed to save expenses: ${expensesError.message}`);
              }
            }
          }
        }
      }
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('trips')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete trip: ${error.message}`);
    }
  }

  async exists(id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('trips')
      .select('id')
      .eq('id', id)
      .single();

    return !error && !!data;
  }

  private mapToDomainEntity(tripData: any): Trip {
    const dateRange = new DateRange(
      new Date(tripData.start_date),
      new Date(tripData.end_date)
    );
    const userId = new UserId(tripData.user_id);

    const days = (tripData.trip_days || []).map((dayData: any) => {
      const events = (dayData.events || []).map((eventData: any) => {
        const expenses = (eventData.expenses || []).map((expenseData: any) => 
          new Expense(
            expenseData.id,
            expenseData.event_id,
            expenseData.description,
            new Money(expenseData.amount),
            expenseData.category as ExpenseCategory || 'other'
          )
        );

        return new Event(
          eventData.id,
          eventData.day_id,
          eventData.title,
          eventData.notes,
          eventData.start_time,
          eventData.end_time,
          eventData.location,
          eventData.color as EventColor || 'purple',
          expenses
        );
      });

      return new TripDay(
        dayData.id,
        dayData.trip_id,
        dayData.day_number,
        new Date(dayData.date),
        events
      );
    });

    return new Trip(
      tripData.id,
      tripData.name,
      tripData.destination || '',
      dateRange,
      userId,
      days
    );
  }
}