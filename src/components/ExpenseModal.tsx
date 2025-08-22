'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus, UserPlus, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { Expense, CreateExpenseRequest, UpdateExpenseRequest } from '@/types/expense';
import type { GroupMember, Event } from '@prisma/client';
import { formatCurrency, calculateEvenSplit, validateSplitPercentages } from '@/types/expense';
import { useNotify } from '@/hooks/useNotify';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense?: Expense;
  tripId: string;
  tripName?: string;
  dayId?: string;
  eventId?: string;
  groupMembers: GroupMember[];
  onSave: (expense: CreateExpenseRequest | UpdateExpenseRequest) => Promise<void>;
  onDelete?: (expenseId: string) => Promise<void>;
  events?: Event[];
}

interface ParticipantEntry {
  participantId?: string;
  externalName?: string;
  splitPercentage: number;
  isSelected: boolean;
}

interface LineItemEntry {
  id?: string;
  description: string;
  amount: string;
  quantity: number;
  category?: string;
  participants: ParticipantEntry[];
}

interface ParticipantItem {
  id: string;
  description: string;
  amount: number;
  quantity: number;
  category?: string;
}

interface ParticipantItemizedList {
  participantId?: string;
  externalName?: string;
  items: ParticipantItem[];
  totalAmount: number;
}

const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Accommodation',
  'Activities',
  'Shopping',
  'Entertainment',
  'Other'
];

export default function ExpenseModal({
  isOpen,
  onClose,
  expense,
  tripId,
  tripName,
  dayId,
  eventId,
  groupMembers,
  onSave,
  onDelete,
  events = []
}: ExpenseModalProps) {
  console.log('ExpenseModal - groupMembers:', groupMembers)
  const { error } = useNotify();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [splitMode, setSplitMode] = useState<'itemized' | 'participants'>('participants');
  const [customSplitFocusIndex, setCustomSplitFocusIndex] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Form fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [lineItems, setLineItems] = useState<LineItemEntry[]>([]);
  const [participantItemizedLists, setParticipantItemizedLists] = useState<ParticipantItemizedList[]>([]);
  const [externalName, setExternalName] = useState('');
  const [externalParticipants, setExternalParticipants] = useState<{id: string, name: string}[]>([]);
  const [showExternalSuggestions, setShowExternalSuggestions] = useState(false);
  
  // Track initialization to prevent unnecessary resets
  const initializedRef = useRef<string | null>(null);
  
  // Helper function to format number to 2 decimal places
  const formatToTwoDecimals = (value: string): string => {
    // Allow empty string
    if (value === '') return '';
    
    // Remove any non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    
    // Handle leading decimal point
    if (numericValue.startsWith('.')) {
      return '0' + numericValue.substring(0, 3); // '0.' + up to 2 digits
    }
    
    // Split by decimal point
    const parts = numericValue.split('.');
    
    // If there's more than one decimal point, keep only the first one
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('').substring(0, 2);
    }
    
    // If there's a decimal part, limit it to 2 digits
    if (parts.length === 2) {
      return parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    // Return the numeric value as is
    return numericValue;
  };
  
  
  // Initialize form when modal opens or expense changes
  useEffect(() => {
    const currentKey = `${isOpen}-${expense?.id || 'new'}`;
    
    if (!isOpen) {
      initializedRef.current = null;
      return;
    }
    
    // Skip if already initialized for this expense
    if (initializedRef.current === currentKey) {
      return;
    }
    
    initializedRef.current = currentKey;
    
    if (expense) {
      // Editing existing expense
      setDescription(expense.description);
      setAmount(expense.amount.toString());
      setCategory(expense.category || '');
      setOwnerId(expense.ownerId);
      setSelectedEventId(expense.eventId || '');
      
      if (expense.lineItems && expense.lineItems.length > 0) {
        // Load line items mode
        setSplitMode('itemized');
        
        const lineItemEntries: LineItemEntry[] = expense.lineItems.map(lineItem => {
          const participantEntries: ParticipantEntry[] = [];
          
          // Add existing line item participants
          lineItem.participants.forEach(p => {
            participantEntries.push({
              participantId: p.participantId,
              externalName: p.externalName,
              splitPercentage: Number(p.splitPercentage),
              isSelected: true
            });
          });
          
          // Add unselected group members
          groupMembers.forEach(member => {
            const isAlreadyParticipant = lineItem.participants.some(
              p => p.participantId === member.id
            );
            if (!isAlreadyParticipant) {
              participantEntries.push({
                participantId: member.id,
                splitPercentage: 0,
                isSelected: false
              });
            }
          });
          
          return {
            id: lineItem.id,
            description: lineItem.description,
            amount: lineItem.amount.toString(),
            quantity: lineItem.quantity,
            category: lineItem.category || '',
            participants: participantEntries
          };
        });
        
        setLineItems(lineItemEntries);
        setParticipants([]);
      } else {
        // Load participants mode
        setSplitMode('participants');
        
        // Set up participants
        const participantEntries: ParticipantEntry[] = [];
        
        // Add existing participants
        expense.participants.forEach(p => {
          participantEntries.push({
            participantId: p.participantId,
            externalName: p.externalName,
            splitPercentage: Number(p.splitPercentage),
            isSelected: true
          });
        });
        
        // Add unselected group members
        groupMembers.forEach(member => {
          const isAlreadyParticipant = expense.participants.some(
            p => p.participantId === member.id
          );
          if (!isAlreadyParticipant) {
            participantEntries.push({
              participantId: member.id,
              splitPercentage: 0,
              isSelected: false
            });
          }
        });
        
        setParticipants(participantEntries);
        setLineItems([]);
      }
    } else {
      // Creating new expense
      setDescription('');
      setAmount('');
      setCategory('');
      setOwnerId(groupMembers.length > 0 ? groupMembers[0].id : '');
      setSelectedEventId(eventId || '');
      
      // Default: all members selected with equal split
      const equalSplit = groupMembers.length > 0 ? 100 / groupMembers.length : 0;
      const participantEntries = groupMembers.map(member => ({
        participantId: member.id,
        splitPercentage: equalSplit,
        isSelected: true
      }));
      setParticipants(participantEntries);
      setLineItems([]);
      setSplitMode('participants');
    }
  }, [isOpen, expense, groupMembers.length]);
  
  
  
  // Removed actualSplitMode calculation for testing
  
  const handleParticipantToggle = (index: number) => {
    setParticipants(prev => {
      const updated = [...prev];
      
      if (!updated[index]) {
        return prev;
      }
      
      // Toggle selection with immutable update
      updated[index] = {
        ...updated[index],
        isSelected: !updated[index].isSelected
      };
      
      // Always recalculate percentages for ALL participants based on current selections
      const selectedParticipants = updated.filter(p => p.isSelected);
      const selectedCount = selectedParticipants.length;
      
      if (selectedCount === 0) {
        // No one selected - set everyone to 0%
        updated.forEach((p, i) => {
          updated[i] = {
            ...updated[i],
            splitPercentage: 0
          };
        });
      } else {
        // Calculate equal split: 100 / number of checked participants
        const equalSplit = 100 / selectedCount;
        
        updated.forEach((p, i) => {
          updated[i] = {
            ...updated[i],
            splitPercentage: p.isSelected ? equalSplit : 0
          };
        });
      }
      
      return updated;
    });
    
    // Update custom split focus if needed
    if (splitMode === 'itemized') {
      setCustomSplitFocusIndex(prev => {
        const newSelected = participants.map((p, i) => {
          if (i === index) return !p.isSelected;
          return p.isSelected;
        });
        
        const selectedIndices = newSelected
          .map((isSelected, i) => isSelected ? i : -1)
          .filter(i => i !== -1);
        
        // If the currently focused participant was deselected, focus on first selected
        if (prev !== null && prev === index && !newSelected[index]) {
          return selectedIndices.length > 0 ? selectedIndices[0] : null;
        }
        
        // If no focus set and we have selected participants, focus on first selected  
        if (prev === null && selectedIndices.length > 0) {
          return selectedIndices[0];
        }
        
        return prev;
      });
    }
  };
  
  const handleSplitPercentageChange = (index: number, value: string) => {
    const percentage = parseFloat(value) || 0;
    
    setParticipants(prev => {
      const updated = [...prev];
      const selectedParticipants = updated.filter(p => p.isSelected);
      
      if (selectedParticipants.length <= 1) {
        // If only one participant, they get 100%
        updated[index].splitPercentage = 100;
        return updated;
      }
      
      // Set the focus participant's percentage
      updated[index].splitPercentage = Math.min(100, Math.max(0, percentage));
      
      // Calculate remaining percentage for other selected participants
      const remainingPercentage = 100 - updated[index].splitPercentage;
      const otherSelectedCount = selectedParticipants.length - 1;
      const evenSplitForOthers = otherSelectedCount > 0 ? remainingPercentage / otherSelectedCount : 0;
      
      // Distribute remaining percentage evenly among other selected participants
      updated.forEach((p, i) => {
        if (i !== index && p.isSelected) {
          p.splitPercentage = evenSplitForOthers;
        }
      });
      
      return updated;
    });
  };

  // Function to set which participant has the editable percentage input
  const handleSetCustomFocus = (index: number) => {
    setCustomSplitFocusIndex(index);
  };

  // Fetch external participants for suggestions
  const fetchExternalParticipants = async () => {
    try {
      const response = await fetch('/api/external-participants');
      if (response.ok) {
        const data = await response.json();
        setExternalParticipants(data.externalParticipants || []);
      }
    } catch (error) {
      console.error('Failed to fetch external participants:', error);
    }
  };

  // Fetch external participants when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchExternalParticipants();
    }
  }, [isOpen]);
  
  const handleAddExternal = () => {
    if (!externalName.trim()) return;
    
    setParticipants(prev => {
      // Add the new external participant
      const updated = [
        ...prev,
        {
          externalName: externalName.trim(),
          splitPercentage: 0, // Will be recalculated below
          isSelected: true
        }
      ];
      
      // Recalculate percentages for all selected participants (including the new one)
      const selectedParticipants = updated.filter(p => p.isSelected);
      const evenSplit = selectedParticipants.length > 0 ? 100 / selectedParticipants.length : 0;
      
      // Apply the even split to all selected participants
      return updated.map(p => ({
        ...p,
        splitPercentage: p.isSelected ? evenSplit : 0
      }));
    });
    
    setExternalName('');
    setShowExternalForm(false);
    setShowExternalSuggestions(false);
    
    // If in custom mode and no focus is set, focus on the new participant
    if (splitMode === 'itemized' && customSplitFocusIndex === null) {
      setCustomSplitFocusIndex(participants.length); // Index of the newly added participant
    }
    
    // Refresh external participants list to include the new one
    fetchExternalParticipants();
  };
  
  const handleRemoveParticipant = (index: number) => {
    setParticipants(prev => {
      // Remove the participant
      const updated = prev.filter((_, i) => i !== index);
      
      // If in participant split mode, recalculate percentages for remaining selected participants
      if (splitMode === 'participants') {
        const selectedParticipants = updated.filter(p => p.isSelected);
        const evenSplit = selectedParticipants.length > 0 ? 100 / selectedParticipants.length : 0;
        
        return updated.map(p => ({
          ...p,
          splitPercentage: p.isSelected ? evenSplit : 0
        }));
      }
      
      return updated;
    });
    
    // Update custom split focus if the removed participant was focused
    if (splitMode === 'itemized' && customSplitFocusIndex === index) {
      setCustomSplitFocusIndex(prev => {
        const remainingSelected = participants
          .filter((_, i) => i !== index && participants[i].isSelected)
          .map((_, originalIndex) => originalIndex < index ? originalIndex : originalIndex - 1);
        
        return remainingSelected.length > 0 ? remainingSelected[0] : null;
      });
    } else if (splitMode === 'itemized' && customSplitFocusIndex !== null && customSplitFocusIndex > index) {
      // Adjust focus index if a participant before the focused one was removed
      setCustomSplitFocusIndex(prev => prev! - 1);
    }
  };
  
  // Itemized list helper functions

  const addExternalParticipantToItemizedList = () => {
    if (!externalName.trim()) return;
    
    setParticipantItemizedLists([...participantItemizedLists, {
      externalName: externalName.trim(),
      items: [],
      totalAmount: 0
    }]);
    
    setExternalName('');
    setShowExternalForm(false);
    setShowExternalSuggestions(false);
    
    // Refresh external participants list to include the new one
    fetchExternalParticipants();
  };

  const removeParticipantFromItemizedList = (index: number) => {
    setParticipantItemizedLists(participantItemizedLists.filter((_, i) => i !== index));
    // Update amount if total calculation is automatic
    if (splitMode === 'itemized') {
      updateAmountFromItemizedLists(participantItemizedLists.filter((_, i) => i !== index));
    }
  };

  const addItemToParticipant = (participantIndex: number) => {
    const updated = [...participantItemizedLists];
    updated[participantIndex].items.push({
      id: Date.now().toString(),
      description: '',
      amount: 0,
      quantity: 1
    });
    setParticipantItemizedLists(updated);
  };

  const removeItemFromParticipant = (participantIndex: number, itemIndex: number) => {
    const updated = [...participantItemizedLists];
    updated[participantIndex].items.splice(itemIndex, 1);
    updateParticipantTotal(updated, participantIndex);
    updateAmountFromItemizedLists(updated);
    setParticipantItemizedLists(updated);
  };

  const updateParticipantItem = (participantIndex: number, itemIndex: number, field: string, value: any) => {
    const updated = [...participantItemizedLists];
    updated[participantIndex].items[itemIndex] = {
      ...updated[participantIndex].items[itemIndex],
      [field]: value
    };
    updateParticipantTotal(updated, participantIndex);
    updateAmountFromItemizedLists(updated);
    setParticipantItemizedLists(updated);
  };

  const updateParticipantTotal = (lists: ParticipantItemizedList[], participantIndex: number) => {
    const total = lists[participantIndex].items.reduce((sum, item) => 
      sum + (item.amount * item.quantity), 0
    );
    lists[participantIndex].totalAmount = total;
  };

  const updateAmountFromItemizedLists = (lists: ParticipantItemizedList[]) => {
    const total = lists.reduce((sum, list) => sum + list.totalAmount, 0);
    setAmount(total.toFixed(2));
  };

  const getTotalExpenseAmountFromItemized = () => {
    return participantItemizedLists.reduce((sum, list) => sum + list.totalAmount, 0);
  };

  const getParticipantNameFromList = (participantId?: string, externalName?: string) => {
    if (externalName) return externalName;
    const member = groupMembers.find(m => m.id === participantId);
    return member?.travelerName || 'Unknown';
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Different validation for itemized vs participant split modes
    if (splitMode === 'itemized') {
      // Validate itemized split
      if (participantItemizedLists.length === 0) {
        error('Validation Error', 'Please add at least one participant with items');
        return;
      }
      
      const hasItemsWithAmount = participantItemizedLists.some(list => 
        list.items.some(item => item.amount > 0)
      );
      
      if (!hasItemsWithAmount) {
        error('Validation Error', 'Please add items with amounts for participants');
        return;
      }
    } else {
      // Validate participant split
      const selectedParticipants = participants.filter(p => p.isSelected);
      
      if (selectedParticipants.length === 0) {
        error('Validation Error', 'Please select at least one participant');
        return;
      }
      
      if (!validateSplitPercentages(selectedParticipants)) {
        error('Validation Error', 'Split percentages must sum to 100%');
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      let expenseData: any;
      
      if (splitMode === 'itemized') {
        // Itemized split mode
        const totalAmount = getTotalExpenseAmountFromItemized();
        
        expenseData = {
          description,
          amount: totalAmount,
          category: category || undefined,
          ownerId,
          splitType: 'itemized',
          participantItemizedLists: participantItemizedLists.map(list => ({
            participantId: list.participantId,
            externalName: list.externalName,
            items: list.items.map(item => ({
              description: item.description,
              amount: item.amount,
              quantity: item.quantity,
              category: item.category
            }))
          }))
        };
        
        if (expense) {
          // Update itemized expense
          expenseData.dayId = selectedEventId ? null : (dayId && dayId !== '' ? dayId : null);
          expenseData.eventId = selectedEventId && selectedEventId !== '' ? selectedEventId : null;
        } else {
          // Create itemized expense
          expenseData.tripId = tripId;
          expenseData.dayId = selectedEventId ? undefined : dayId;
          expenseData.eventId = selectedEventId || eventId;
        }
      } else {
        // Participant split mode (existing logic)
        const selectedParticipants = participants.filter(p => p.isSelected);
        const participantData = selectedParticipants.map(p => ({
          participantId: p.participantId && p.participantId !== '' ? p.participantId : undefined,
          externalName: p.externalName && p.externalName !== '' ? p.externalName : undefined,
          splitPercentage: Number(p.splitPercentage)
        }));
        
        if (expense) {
          // Update expense - only send changed fields
          expenseData = {
            description,
            amount: parseFloat(amount),
            category: category || null,
            ownerId,
            dayId: selectedEventId ? null : (dayId && dayId !== '' ? dayId : null),
            eventId: selectedEventId && selectedEventId !== '' ? selectedEventId : null,
            splitType: 'manual',
            participants: participantData
          };
        } else {
          // Create expense - send all required fields
          expenseData = {
            description,
            amount: parseFloat(amount),
            category: category || undefined,
            ownerId,
            tripId,
            dayId: selectedEventId ? undefined : dayId,
            eventId: selectedEventId || eventId,
            splitType: 'manual',
            participants: participantData
          };
        }
      }
      
      await onSave(expenseData);
      onClose();
    } catch (err) {
      console.error('Error saving expense:', err);
      error('Save Failed', 'Failed to save expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const totalPercentage = splitMode === 'participants' 
    ? participants.filter(p => p.isSelected).reduce((sum, p) => sum + Number(p.splitPercentage), 0)
    : 100; // Always valid for itemized mode
  
  const amountValue = parseFloat(amount) || 0;
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {expense ? 'Edit Expense' : 'Add Expense'}
              {tripName && <span className="text-sm font-normal text-gray-500 ml-2">for {tripName}</span>}
            </DialogTitle>
          </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Dinner at restaurant"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="amount">
                Amount {splitMode === 'itemized' && <span className="text-xs text-gray-500">(auto-calculated)</span>}
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(formatToTwoDecimals(e.target.value))}
                placeholder="0.00"
                required
                readOnly={splitMode === 'itemized'}
                className={splitMode === 'itemized' ? 'bg-gray-100 cursor-not-allowed' : ''}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <div className="relative">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <span>{category || "Select category"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="owner">Paid by</Label>
              <div className="relative">
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger>
                    <span>{groupMembers.find(m => m.id === ownerId)?.travelerName || "Select who paid"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {groupMembers.map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.travelerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Event attachment for standalone expenses */}
          {!eventId && events.length > 0 && (
            <div>
              <Label htmlFor="event">Attach to Event (Optional)</Label>
              <div className="relative">
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger>
                    <span>
                      {selectedEventId 
                        ? events.find(e => e.id === selectedEventId)?.title || "Select event"
                        : "No event (standalone expense)"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No event (standalone expense)</SelectItem>
                    {events.map(event => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Attach this expense to an event to view it in the event details
              </p>
            </div>
          )}
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <div>
                <Label>Split between</Label>
                <p className="text-xs text-gray-500 mt-1">
                  {splitMode === 'participants' 
                    ? 'Participant split mode - percentages divided equally among selected participants' 
                    : 'Itemized split mode - each participant adds their own items with individual prices.'
                  }
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={splitMode === 'participants' ? 'default' : 'outline'}
                  onClick={() => {
                    setSplitMode('participants');
                    // Clear itemized lists
                    setParticipantItemizedLists([]);
                    // Recalculate equal splits for all selected participants
                    const selectedCount = participants.filter(p => p.isSelected).length;
                    if (selectedCount > 0) {
                      const equalSplit = 100 / selectedCount;
                      setParticipants(prev => prev.map(p => ({
                        ...p,
                        splitPercentage: p.isSelected ? equalSplit : 0
                      })));
                    }
                  }}
                >
                  Participant Split
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={splitMode === 'itemized' ? 'default' : 'outline'}
                  onClick={() => {
                    setSplitMode('itemized');
                    // Clear participant selections and reset amount
                    setParticipants(prev => prev.map(p => ({
                      ...p,
                      isSelected: false,
                      splitPercentage: 0
                    })));
                    setAmount('0.00');
                    setCustomSplitFocusIndex(null);
                    
                    // Auto-include all group members in itemized lists if empty
                    if (participantItemizedLists.length === 0) {
                      setParticipantItemizedLists(groupMembers.map(member => ({
                        participantId: member.id,
                        items: [],
                        totalAmount: 0
                      })));
                    }
                  }}
                >
                  Itemized Split
                </Button>
              </div>
            </div>
            
            {splitMode === 'participants' ? (
              // Participant Split Mode UI
              <div className="space-y-2 border rounded-lg p-3">
                {participants.map((participant, index) => {
                  const isExternal = !participant.participantId;
                  const displayName = participant.participantId 
                    ? groupMembers.find(m => m.id === participant.participantId)?.travelerName
                    : participant.externalName;
                  
                  const participantKey = participant.participantId || participant.externalName || `external-${index}`;
                  
                  return (
                    <div key={`participant-${index}-${participantKey}`} className="flex items-center gap-2 p-2 rounded">
                      <Checkbox
                        checked={participant.isSelected}
                        onCheckedChange={() => handleParticipantToggle(index)}
                      />
                      <span className="flex-1">{displayName}</span>
                      {participant.isSelected && (
                        <>
                          <span className="text-sm text-gray-500 w-20 text-center">
                            {Number(participant.splitPercentage).toFixed(1)}%
                          </span>
                          {amountValue > 0 && (
                            <span className="text-sm font-medium w-20 text-right">
                              {formatCurrency(amountValue * Number(participant.splitPercentage) / 100)}
                            </span>
                          )}
                        </>
                      )}
                      {isExternal && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveParticipant(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                
                {!showExternalForm && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowExternalForm(true)}
                    className="w-full"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add External Participant
                  </Button>
                )}
                
                {showExternalForm && (
                  <div className="pt-2 border-t space-y-2">
                    {/* External participant suggestions */}
                    {externalParticipants.length > 0 && (
                      <div>
                        <Label className="text-sm text-gray-600">Recent external participants:</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {externalParticipants.slice(0, 5).map((participant) => (
                            <Button
                              key={participant.id}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => {
                                setExternalName(participant.name);
                                setShowExternalSuggestions(false);
                              }}
                            >
                              {participant.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="external-name">Add new external participant</Label>
                      <div className="flex gap-2">
                        <Input
                          id="external-name"
                          value={externalName}
                          onChange={(e) => setExternalName(e.target.value)}
                          placeholder="Enter name"
                          className="flex-1"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (externalName.trim()) {
                                const newParticipant = {
                                  externalName: externalName.trim(),
                                  splitPercentage: 0,
                                  isSelected: true
                                };
                                setParticipants(prev => [...prev, newParticipant]);
                                setExternalName('');
                                setShowExternalForm(false);
                                setShowExternalSuggestions(false);
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            if (externalName.trim()) {
                              const newParticipant = {
                                externalName: externalName.trim(),
                                splitPercentage: 0,
                                isSelected: true
                              };
                              setParticipants(prev => [...prev, newParticipant]);
                              setExternalName('');
                              setShowExternalForm(false);
                              setShowExternalSuggestions(false);
                            }
                          }}
                        >
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setExternalName('');
                            setShowExternalForm(false);
                            setShowExternalSuggestions(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Itemized Split Mode UI
              <div className="space-y-4 border rounded-lg p-3">
                {participantItemizedLists.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <p>No participants added yet.</p>
                    <p className="text-sm">Click "Add Participant" to start adding itemized expenses.</p>
                  </div>
                ) : (
                  participantItemizedLists.map((participantList, participantIndex) => (
                    <div key={participantIndex} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">
                          {getParticipantNameFromList(participantList.participantId, participantList.externalName)}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">
                            Total: ${participantList.totalAmount.toFixed(2)}
                          </span>
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeParticipantFromItemizedList(participantIndex)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {participantList.items.map((item, itemIndex) => (
                          <div key={item.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                            <Input
                              placeholder="Item description"
                              value={item.description}
                              onChange={(e) => updateParticipantItem(participantIndex, itemIndex, 'description', e.target.value)}
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={item.amount || ''}
                              onChange={(e) => updateParticipantItem(participantIndex, itemIndex, 'amount', parseFloat(e.target.value) || 0)}
                              className="w-20"
                              step="0.01"
                              min="0"
                            />
                            <Input
                              type="number"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => updateParticipantItem(participantIndex, itemIndex, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-16"
                              min="1"
                            />
                            <Button 
                              type="button"
                              variant="ghost" 
                              size="sm"
                              onClick={() => removeItemFromParticipant(participantIndex, itemIndex)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm"
                          onClick={() => addItemToParticipant(participantIndex)}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Item
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                
                {!showExternalForm && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowExternalForm(true)}
                    className="w-full"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add External Participant
                  </Button>
                )}
                
                {showExternalForm && (
                  <div className="pt-2 border-t space-y-2">
                    {/* External participant suggestions */}
                    {externalParticipants.length > 0 && (
                      <div>
                        <Label className="text-sm text-gray-600">Recent external participants:</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {externalParticipants.slice(0, 5).map((participant) => (
                            <Button
                              key={participant.id}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => {
                                setExternalName(participant.name);
                                setShowExternalSuggestions(false);
                              }}
                            >
                              {participant.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="external-name-itemized">Add new external participant</Label>
                      <div className="flex gap-2">
                        <Input
                          id="external-name-itemized"
                          value={externalName}
                          onChange={(e) => setExternalName(e.target.value)}
                          placeholder="Enter name"
                          className="flex-1"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addExternalParticipantToItemizedList();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={addExternalParticipantToItemizedList}
                        >
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setExternalName('');
                            setShowExternalForm(false);
                            setShowExternalSuggestions(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {participantItemizedLists.length > 0 && (
                  <div className="border-t pt-3">
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm">Split Breakdown:</h5>
                      {participantItemizedLists.map((list, index) => {
                        const total = getTotalExpenseAmountFromItemized();
                        const percentage = total > 0 ? (list.totalAmount / total) * 100 : 0;
                        return (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{getParticipantNameFromList(list.participantId, list.externalName)}</span>
                            <span>${list.totalAmount.toFixed(2)} ({percentage.toFixed(1)}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {splitMode === 'participants' && Math.abs(totalPercentage - 100) > 0.01 && (
              <p className="text-sm text-red-500 mt-1">
                Total: {totalPercentage.toFixed(1)}% (must equal 100%)
              </p>
            )}
          </div>
          
          {/* Button layout with integrated delete icon */}
          <div className="pt-6">
            <div className="flex items-center justify-between">
              {/* Delete icon button - positioned on the left */}
              {expense && onDelete ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSubmitting}
                  className="flex items-center justify-center w-10 h-10 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete Expense"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              ) : (
                <div className="w-10" />
              )}
              
              {/* Cancel/Save buttons */}
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || (splitMode === 'participants' && Math.abs(totalPercentage - 100) > 0.01)}
                  className="px-6"
                >
                  {isSubmitting ? 'Saving...' : (expense ? 'Update' : 'Create')}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    
    {/* Delete Confirmation Dialog */}
    {expense && (
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          if (onDelete && expense) {
            onDelete(expense.id);
          }
        }}
        title="Delete Expense"
        message={`Are you sure you want to delete this expense: "${expense.description}"? This action cannot be undone.`}
        confirmText="Delete Expense"
        cancelText="Cancel"
        variant="destructive"
      />
    )}
    </>
  );
}