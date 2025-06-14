import { Event } from './Event';

export class TripDay {
  private _events: Event[] = [];

  constructor(
    private readonly _id: string,
    private readonly _tripId: string,
    private readonly _dayNumber: number,
    private readonly _date: Date,
    events: Event[] = []
  ) {
    this._events = [...events];
  }

  get id(): string {
    return this._id;
  }

  get tripId(): string {
    return this._tripId;
  }

  get dayNumber(): number {
    return this._dayNumber;
  }

  get date(): Date {
    return new Date(this._date);
  }

  get events(): Event[] {
    return [...this._events];
  }

  addEvent(event: Event): void {
    if (event.dayId !== this._id) {
      throw new Error('Event does not belong to this day');
    }
    this._events.push(event);
  }

  removeEvent(eventId: string): void {
    this._events = this._events.filter(event => event.id !== eventId);
  }

  getEvent(eventId: string): Event | undefined {
    return this._events.find(event => event.id === eventId);
  }

  hasEvents(): boolean {
    return this._events.length > 0;
  }
}