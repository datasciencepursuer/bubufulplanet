import { Expense } from '../entities/Expense';

export interface IExpenseRepository {
  findById(id: string): Promise<Expense | null>;
  findByEventId(eventId: string): Promise<Expense[]>;
  findByTripId(tripId: string): Promise<Expense[]>;
  save(expense: Expense): Promise<void>;
  saveBatch(expenses: Expense[]): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByEventId(eventId: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}