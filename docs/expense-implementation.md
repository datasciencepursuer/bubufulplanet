# Expense Implementation Plan

## Expense Characteristics

### Mandatory Fields
- **Amount**: The monetary value of the expense
- **Owner**: The person who paid for the expense
- **Participants**: The people who should split the expense
  - Minimum: 1 participant
  - Default: All group members (even split)
  - Can be added/modified during creation or update

### Split Logic
- **Default**: Even split across all group members
  - Automatically includes all trip party members
  - Example: 4 group members = 25% each
- **Custom Participants**: 
  - Can add temporary/external participants for specific expenses
  - External participants are expense-specific (not added to group)
- **Custom Split**: Users can manually adjust the percentage split
  - Each participant's percentage should be editable
  - Total must equal 100%

### Current Database Schema
The expense model already exists in the database with the following structure:
- Connected to events
- Basic fields for amount and description
- Category field for expense types

### Implementation Requirements
1. Update the expense model to include owner and participants tracking
2. Create UI for selecting expense participants from group members
3. Implement expense splitting logic
4. Build expense summary views showing who owes whom
5. Add expense CRUD operations independent of events (optional expenses outside events)

### Workflow
1. User creates an expense with amount and description
2. User selects the owner (who paid)
3. User selects participants (who should split the cost)
4. System calculates splits based on participants
5. System tracks balances between group members

### Modal Access Points
The ExpenseModal will be accessible from:
1. **Trip Detail Page (/trips/[id])**: Primary location - "Add Expense" button in trip header
2. **Weekly Calendar View**: Button near the "Edit Trip" action (expense tied to current trip)
3. **Daily Calendar View**: Button near the "Edit Trip" action (expense tied to current trip and day)
4. **Event Modal**: "Add Expense" option within events (expense tied to trip, day, and event)
5. **Main Dashboard (/app)**: Trip-specific expense summaries with "View Expenses" links

### UI Components
- **ExpenseModal**: New modal component for creating and updating expenses
  - Form fields: Amount, Description, Owner, Participants
  - Participant selection:
    - Pre-populated with all group members (checked by default)
    - Can uncheck members to exclude from expense
    - "Add External Participant" button for temporary participants
  - External participant management:
    - Name input for non-group members
    - These are saved per-expense only
  - Split calculation with two modes:
    - **Even Split Mode**: Automatically calculates equal percentages
    - **Custom Split Mode**: Editable percentage for each participant
  - Real-time split preview showing amount owed per person
  - Validation to ensure percentages total 100%
  - Save/Update functionality

## Database Schema Design

### Updated Expense Model
```prisma
model Expense {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  eventId     String?  @map("event_id") @db.Uuid
  dayId       String?  @map("day_id") @db.Uuid
  tripId      String   @map("trip_id") @db.Uuid
  description String   @db.VarChar(255)
  amount      Decimal  @db.Decimal(10, 2)
  category    String?  @db.VarChar(100)
  ownerId     String   @map("owner_id") @db.Uuid
  groupId     String   @map("group_id") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  
  // Relations
  trip        Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  day         TripDay? @relation(fields: [dayId], references: [id], onDelete: Cascade)
  event       Event?   @relation(fields: [eventId], references: [id], onDelete: Cascade)
  owner       GroupMember @relation(fields: [ownerId], references: [id])
  participants ExpenseParticipant[]
  
  @@index([tripId], map: "idx_expenses_trip_id")
}
```

### New ExpenseParticipant Model
```prisma
model ExpenseParticipant {
  id              String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  expenseId       String      @map("expense_id") @db.Uuid
  participantId   String?     @map("participant_id") @db.Uuid
  externalName    String?     @map("external_name") @db.VarChar(255)
  splitPercentage Decimal     @map("split_percentage") @db.Decimal(5, 2)
  amountOwed      Decimal     @map("amount_owed") @db.Decimal(10, 2)
  
  expense     Expense      @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  participant GroupMember? @relation(fields: [participantId], references: [id])
}
```

## API Implementation Plan

### New Routes
1. `POST /api/expenses` - Create standalone expense (requires tripId)
2. `GET /api/expenses/[id]` - Get expense with participants
3. `PUT /api/expenses/[id]` - Update expense and participants
4. `DELETE /api/expenses/[id]` - Delete expense
5. `GET /api/expenses/summary` - Get group expense summary and balances
6. `GET /api/expenses/summary/trip/[tripId]` - Get trip-specific expense summary
7. `GET /api/trips/[tripId]/expenses` - Get all expenses for a specific trip

### Types
```typescript
interface CreateExpenseRequest {
  description: string
  amount: number
  category?: string
  ownerId: string
  tripId: string  // Required - expense must be tied to a trip
  dayId?: string  // Optional - for expenses tied to specific days
  eventId?: string  // Optional - for expenses tied to specific events
  participants: {
    participantId?: string
    externalName?: string
    splitPercentage: number
  }[]
}

interface ExpenseBalance {
  memberId: string
  memberName: string
  totalOwed: number
  totalOwing: number
  netBalance: number
  balancesWith: {
    memberId: string
    memberName: string
    amount: number
  }[]
}
```

## Implementation Steps

### Phase 1: Database Updates
1. Create migration for new expense fields and ExpenseParticipant table
2. Update existing expenses with default owner (first group member)
3. Create default participants for existing expenses (even split)

### Phase 2: API Development
1. Implement new expense CRUD endpoints
2. Add participant management to expense operations
3. Create balance calculation service
4. Update existing expense routes to include new data

### Phase 3: Frontend Components
1. Create ExpenseModal component
2. Add expense buttons to required views
3. Create expense summary components
4. Integrate with existing event expense flow

### Phase 4: Testing & Polish
1. Test split calculations
2. Validate external participant handling
3. Performance optimization for large groups
4. Error handling and edge cases

## Migration Strategy for Existing Data

Since we're adding owner and participant tracking to existing expenses:

1. **Add nullable columns first**
   - Make ownerId nullable initially
   - Create ExpenseParticipant table

2. **Data migration script**
   ```sql
   -- Add trip_id to existing expenses based on their day_id
   UPDATE expenses e
   SET trip_id = (
     SELECT td.trip_id
     FROM trip_days td
     WHERE td.id = e.day_id
   )
   WHERE e.trip_id IS NULL AND e.day_id IS NOT NULL;
   
   -- Set owner to first group member for existing expenses
   UPDATE expenses e
   SET owner_id = (
     SELECT gm.id 
     FROM group_members gm
     JOIN trips t ON t.group_id = gm.group_id
     JOIN trip_days td ON td.trip_id = t.id
     WHERE td.id = e.day_id
     ORDER BY gm.joined_at
     LIMIT 1
   )
   WHERE e.owner_id IS NULL;
   
   -- Create even split participants for existing expenses
   INSERT INTO expense_participants (expense_id, participant_id, split_percentage, amount_owed)
   SELECT 
     e.id,
     gm.id,
     100.0 / COUNT(*) OVER (PARTITION BY e.id),
     e.amount / COUNT(*) OVER (PARTITION BY e.id)
   FROM expenses e
   JOIN trip_days td ON td.id = e.day_id
   JOIN trips t ON t.id = td.trip_id
   JOIN group_members gm ON gm.group_id = t.group_id
   WHERE NOT EXISTS (
     SELECT 1 FROM expense_participants ep 
     WHERE ep.expense_id = e.id
   );
   ```

3. **Make columns required**
   - After migration, make ownerId required
   - Add proper foreign key constraints

## Balance Calculation Algorithm

```typescript
// Calculate who owes whom within a group
function calculateGroupBalances(expenses: ExpenseWithParticipants[]): BalanceSummary[] {
  // Track amounts owed between members
  const owings = new Map<string, Map<string, number>>();
  
  for (const expense of expenses) {
    for (const participant of expense.participants) {
      if (participant.participantId === expense.ownerId) continue;
      
      const owerId = participant.participantId || `external_${participant.externalName}`;
      const ownerId = expense.ownerId;
      
      if (!owings.has(owerId)) {
        owings.set(owerId, new Map());
      }
      
      const owerBalances = owings.get(owerId)!;
      const currentOwed = owerBalances.get(ownerId) || 0;
      owerBalances.set(ownerId, currentOwed + Number(participant.amountOwed));
    }
  }
  
  // Simplify balances (if A owes B $10 and B owes A $6, then A owes B $4)
  const netBalances = new Map<string, Map<string, number>>();
  
  for (const [owerId, debts] of owings) {
    for (const [ownerId, amount] of debts) {
      const reverseAmount = owings.get(ownerId)?.get(owerId) || 0;
      const netAmount = amount - reverseAmount;
      
      if (netAmount > 0) {
        if (!netBalances.has(owerId)) {
          netBalances.set(owerId, new Map());
        }
        netBalances.get(owerId)!.set(ownerId, netAmount);
      }
    }
  }
  
  return formatBalanceSummaries(netBalances);
}
```

## Component Props and Interfaces

```typescript
// ExpenseModal Props
interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense?: ExpenseWithParticipants; // For editing
  tripId: string; // Required - all expenses must be tied to a trip
  dayId?: string; // Optional - for creating from calendar
  eventId?: string; // Optional - for creating from event
  groupMembers: GroupMember[];
  onSave: (expense: CreateExpenseRequest) => Promise<void>;
}

// ExpenseSummaryCard Props  
interface ExpenseSummaryCardProps {
  groupId: string;
  memberId: string;
  tripId: string; // Required - show summary for specific trip
}

// TripExpensesSummary Props
interface TripExpensesSummaryProps {
  tripId: string;
  tripName: string;
  totalExpenses: number;
  memberBalances: BalanceSummary[];
  onViewDetails: () => void;
}

// ExpenseBalanceList Props
interface ExpenseBalanceListProps {
  balances: BalanceSummary[];
  currentMemberId: string;
  onSettleUp: (withMemberId: string) => void;
}
```

## Trip-Based Expense Reporting

### Summary Views
1. **Trip Overview**
   - Total expenses for the trip
   - Expense breakdown by category
   - Daily expense trends
   - Member contribution summary

2. **Trip Balance Report**
   - Who paid what during the trip
   - Who owes whom at trip end
   - Suggested settlements
   - Export options (CSV, PDF)

3. **Expense Timeline**
   - Chronological list of expenses
   - Filter by day, member, or category
   - Running balance view

### Dashboard Integration
```typescript
// Dashboard shows trip summaries
interface DashboardExpenseSection {
  recentTrips: {
    tripId: string;
    tripName: string;
    totalExpenses: number;
    userBalance: number; // positive = owed, negative = owes
    settlementNeeded: boolean;
  }[];
  upcomingTrips: {
    tripId: string;
    tripName: string;
    plannedBudget?: number;
  }[];
}
```

## Security Considerations

1. **Authorization checks**
   - Verify user belongs to group for all operations
   - Ensure owner is a valid group member
   - Validate participant IDs belong to group
   - Verify tripId belongs to user's group

2. **Data validation**
   - Ensure split percentages sum to 100%
   - Prevent duplicate participants
   - Validate amount is positive
   - Check for circular references
   - Validate trip exists and is accessible

3. **Performance**
   - Index on tripId for expense queries
   - Index on groupId for group-wide summaries
   - Batch participant operations
   - Cache balance calculations per trip
   - Paginate expense lists