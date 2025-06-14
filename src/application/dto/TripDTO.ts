export interface CreateTripDTO {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  userId: string;
}

export interface UpdateTripDTO {
  id: string;
  name?: string;
  destination?: string;
}

export interface TripDTO {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  userId: string;
  duration: number;
  eventsCount: number;
  totalExpenses: {
    amount: number;
    currency: string;
  };
  hasEvents: boolean;
  days: TripDayDTO[];
}

export interface TripDayDTO {
  id: string;
  tripId: string;
  dayNumber: number;
  date: string;
  hasEvents: boolean;
  events: EventDTO[];
}

export interface EventDTO {
  id: string;
  dayId: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  color: string;
  hasExpenses: boolean;
  totalExpenses: {
    amount: number;
    currency: string;
  };
  expenses: ExpenseDTO[];
}

export interface ExpenseDTO {
  id: string;
  eventId: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
}

export interface CreateEventDTO {
  dayId: string;
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  color?: string;
  expenses?: CreateExpenseDTO[];
}

export interface UpdateEventDTO {
  id: string;
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  color?: string;
  expenses?: CreateExpenseDTO[];
}

export interface CreateExpenseDTO {
  description: string;
  amount: number;
  currency?: string;
  category: string;
}

export interface TripListDTO {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  duration: number;
  eventsCount: number;
  totalExpenses: {
    amount: number;
    currency: string;
  };
}