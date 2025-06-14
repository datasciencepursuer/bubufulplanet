import { TripDay } from '../entities/TripDay';

export interface ITripDayRepository {
  findById(id: string): Promise<TripDay | null>;
  findByTripId(tripId: string): Promise<TripDay[]>;
  save(tripDay: TripDay): Promise<void>;
  saveBatch(tripDays: TripDay[]): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}