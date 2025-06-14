import { Money } from '../value-objects/Money';

export type ExpenseCategory = 'food' | 'transportation' | 'accommodation' | 'entertainment' | 'shopping' | 'other';

export class Expense {
  constructor(
    private readonly _id: string,
    private readonly _eventId: string,
    private _description: string,
    private _amount: Money,
    private _category: ExpenseCategory
  ) {
    if (!_description || _description.trim() === '') {
      throw new Error('Expense description cannot be empty');
    }
  }

  get id(): string {
    return this._id;
  }

  get eventId(): string {
    return this._eventId;
  }

  get description(): string {
    return this._description;
  }

  get amount(): Money {
    return this._amount;
  }

  get category(): ExpenseCategory {
    return this._category;
  }

  updateDescription(description: string): void {
    if (!description || description.trim() === '') {
      throw new Error('Expense description cannot be empty');
    }
    this._description = description;
  }

  updateAmount(amount: Money): void {
    this._amount = amount;
  }

  updateCategory(category: ExpenseCategory): void {
    this._category = category;
  }
}