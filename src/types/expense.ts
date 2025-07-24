export interface ExpenseParticipant {
  id: string;
  expenseId: string;
  participantId?: string;
  externalName?: string;
  splitPercentage: number;
  amountOwed: number;
  participant?: {
    id: string;
    travelerName: string;
  };
  externalParticipant?: {
    id: string;
    name: string;
  };
}

export interface LineItemParticipant {
  id: string;
  lineItemId: string;
  participantId?: string;
  externalName?: string;
  splitPercentage: number;
  amountOwed: number;
  participant?: {
    id: string;
    travelerName: string;
  };
  externalParticipant?: {
    id: string;
    name: string;
  };
}

export interface ExpenseLineItem {
  id: string;
  expenseId: string;
  description: string;
  amount: number;
  quantity: number;
  category?: string;
  createdAt: string;
  participants: LineItemParticipant[];
}

export interface Expense {
  id: string;
  eventId?: string;
  dayId?: string;
  tripId: string;
  description: string;
  amount: number;
  category?: string;
  ownerId: string;
  groupId: string;
  createdAt: string;
  owner: {
    id: string;
    travelerName: string;
  };
  participants: ExpenseParticipant[];
  lineItems?: ExpenseLineItem[];
  trip?: {
    id: string;
    name: string;
    destination?: string;
  };
  day?: {
    id: string;
    date: string;
    dayNumber: number;
  };
  event?: {
    id: string;
    title: string;
    startSlot: string;
    endSlot?: string;
  };
}

export interface CreateExpenseRequest {
  description: string;
  amount: number;
  category?: string;
  ownerId: string;
  tripId: string;
  dayId?: string;
  eventId?: string;
  participants?: {
    participantId?: string;
    externalName?: string;
    splitPercentage: number;
  }[];
  lineItems?: {
    description: string;
    amount: number;
    quantity?: number;
    category?: string;
    participants: {
      participantId?: string;
      externalName?: string;
      splitPercentage: number;
    }[];
  }[];
}

export interface UpdateExpenseRequest {
  description?: string;
  amount?: number;
  category?: string | null;
  ownerId?: string;
  dayId?: string | null;
  eventId?: string | null;
  participants?: {
    participantId?: string;
    externalName?: string;
    splitPercentage: number;
  }[];
  lineItems?: {
    id?: string;
    description: string;
    amount: number;
    quantity?: number;
    category?: string;
    participants: {
      participantId?: string;
      externalName?: string;
      splitPercentage: number;
    }[];
  }[];
}

export interface ExpenseBalance {
  memberId: string;
  memberName: string;
  totalOwed: number;
  totalOwing: number;
  netBalance: number;
  balancesWith: {
    memberId: string;
    memberName: string;
    amount: number; // positive = they owe you, negative = you owe them
  }[];
}

export interface ExpenseSummary {
  balances: ExpenseBalance[];
  trip?: {
    id: string;
    name: string;
    destination?: string;
    startDate: string;
    endDate: string;
  };
  totalExpenses: number;
}

export interface TripExpensesSummary {
  trip: {
    id: string;
    name: string;
    destination?: string;
    startDate: string;
    endDate: string;
  };
  expenses: Expense[];
  expensesByDay: {
    dayId: string;
    date?: string;
    dayNumber?: number;
    expenses: Expense[];
  }[];
  summary: {
    total: number;
    byCategory: Record<string, number>;
    count: number;
  };
}

// Helper function to format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Helper function to get participant display name
export function getParticipantName(participant: ExpenseParticipant): string {
  if (participant.participant) {
    return participant.participant.travelerName;
  }
  return participant.externalName || 'Unknown';
}

// Helper function to calculate even split percentages
export function calculateEvenSplit(participantCount: number): number {
  return Math.round((100 / participantCount) * 100) / 100;
}

// Helper function to validate split percentages
export function validateSplitPercentages(participants: { splitPercentage: number }[]): boolean {
  const total = participants.reduce((sum, p) => sum + p.splitPercentage, 0);
  return Math.abs(total - 100) < 0.01;
}