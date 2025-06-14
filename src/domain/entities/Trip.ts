import { TripDay } from './TripDay';
import { DateRange } from '../value-objects/DateRange';
import { UserId } from '../value-objects/UserId';
import { Money } from '../value-objects/Money';

export class Trip {
  private _days: TripDay[] = [];

  constructor(
    private readonly _id: string,
    private _name: string,
    private _destination: string,
    private readonly _dateRange: DateRange,
    private readonly _userId: UserId,
    days: TripDay[] = []
  ) {
    if (!_name || _name.trim() === '') {
      throw new Error('Trip name cannot be empty');
    }
    if (!_destination || _destination.trim() === '') {
      throw new Error('Trip destination cannot be empty');
    }
    this._days = [...days];
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get destination(): string {
    return this._destination;
  }

  get dateRange(): DateRange {
    return this._dateRange;
  }

  get userId(): UserId {
    return this._userId;
  }

  get days(): TripDay[] {
    return [...this._days];
  }

  updateName(name: string): void {
    if (!name || name.trim() === '') {
      throw new Error('Trip name cannot be empty');
    }
    this._name = name;
  }

  updateDestination(destination: string): void {
    if (!destination || destination.trim() === '') {
      throw new Error('Trip destination cannot be empty');
    }
    this._destination = destination;
  }

  addDay(day: TripDay): void {
    if (day.tripId !== this._id) {
      throw new Error('Day does not belong to this trip');
    }
    if (!this._dateRange.contains(day.date)) {
      throw new Error('Day date is outside trip date range');
    }
    this._days.push(day);
  }

  removeDay(dayId: string): void {
    this._days = this._days.filter(day => day.id !== dayId);
  }

  getDay(dayId: string): TripDay | undefined {
    return this._days.find(day => day.id === dayId);
  }

  getDayByNumber(dayNumber: number): TripDay | undefined {
    return this._days.find(day => day.dayNumber === dayNumber);
  }

  getDayByDate(date: Date): TripDay | undefined {
    return this._days.find(day => 
      day.date.toDateString() === date.toDateString()
    );
  }

  getDuration(): number {
    return this._dateRange.getDurationInDays();
  }

  getTotalExpenses(): Money {
    const allExpenses = this._days
      .flatMap(day => day.events)
      .flatMap(event => event.expenses);

    if (allExpenses.length === 0) {
      return new Money(0);
    }

    const firstCurrency = allExpenses[0].amount.currency;
    let total = 0;

    for (const expense of allExpenses) {
      if (expense.amount.currency !== firstCurrency) {
        throw new Error('Cannot calculate total with mixed currencies');
      }
      total += expense.amount.amount;
    }

    return new Money(total, firstCurrency);
  }

  hasEvents(): boolean {
    return this._days.some(day => day.hasEvents());
  }

  getEventsCount(): number {
    return this._days.reduce((count, day) => count + day.events.length, 0);
  }
}