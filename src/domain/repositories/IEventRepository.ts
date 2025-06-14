import { Event } from '../entities/Event';

export interface IEventRepository {
  findById(id: string): Promise<Event | null>;
  findByDayId(dayId: string): Promise<Event[]>;
  findByTripId(tripId: string): Promise<Event[]>;
  save(event: Event): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}