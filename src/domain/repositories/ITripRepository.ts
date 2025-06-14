import { Trip } from '../entities/Trip';
import { UserId } from '../value-objects/UserId';

export interface ITripRepository {
  findById(id: string): Promise<Trip | null>;
  findByUserId(userId: UserId): Promise<Trip[]>;
  save(trip: Trip): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}