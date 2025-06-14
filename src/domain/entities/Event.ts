import { Expense } from './Expense';
import { Money } from '../value-objects/Money';

export type EventColor = 'purple' | 'blue' | 'green' | 'yellow' | 'red' | 'orange' | 'pink' | 'gray';

export class Event {
  private _expenses: Expense[] = [];

  constructor(
    private readonly _id: string,
    private readonly _dayId: string,
    private _title: string,
    private _description: string | null = null,
    private _startTime: string | null = null,
    private _endTime: string | null = null,
    private _location: string | null = null,
    private _color: EventColor = 'purple',
    expenses: Expense[] = []
  ) {
    if (!_title || _title.trim() === '') {
      throw new Error('Event title cannot be empty');
    }
    this._expenses = [...expenses];
  }

  get id(): string {
    return this._id;
  }

  get dayId(): string {
    return this._dayId;
  }

  get title(): string {
    return this._title;
  }

  get description(): string | null {
    return this._description;
  }

  get startTime(): string | null {
    return this._startTime;
  }

  get endTime(): string | null {
    return this._endTime;
  }

  get location(): string | null {
    return this._location;
  }

  get color(): EventColor {
    return this._color;
  }

  get expenses(): Expense[] {
    return [...this._expenses];
  }

  updateTitle(title: string): void {
    if (!title || title.trim() === '') {
      throw new Error('Event title cannot be empty');
    }
    this._title = title;
  }

  updateDescription(description: string | null): void {
    this._description = description;
  }

  updateTime(startTime: string | null, endTime: string | null): void {
    this._startTime = startTime;
    this._endTime = endTime;
  }

  updateLocation(location: string | null): void {
    this._location = location;
  }

  updateColor(color: EventColor): void {
    this._color = color;
  }

  addExpense(expense: Expense): void {
    if (expense.eventId !== this._id) {
      throw new Error('Expense does not belong to this event');
    }
    this._expenses.push(expense);
  }

  removeExpense(expenseId: string): void {
    this._expenses = this._expenses.filter(expense => expense.id !== expenseId);
  }

  getExpense(expenseId: string): Expense | undefined {
    return this._expenses.find(expense => expense.id === expenseId);
  }

  getTotalExpenses(): Money {
    if (this._expenses.length === 0) {
      return new Money(0);
    }

    const firstCurrency = this._expenses[0].amount.currency;
    let total = 0;

    for (const expense of this._expenses) {
      if (expense.amount.currency !== firstCurrency) {
        throw new Error('Cannot calculate total with mixed currencies');
      }
      total += expense.amount.amount;
    }

    return new Money(total, firstCurrency);
  }

  hasExpenses(): boolean {
    return this._expenses.length > 0;
  }
}