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
  const [splitMode, setSplitMode] = useState<'even' | 'custom'>('even');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Form fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [externalName, setExternalName] = useState('');
  const [externalParticipants, setExternalParticipants] = useState<{id: string, name: string}[]>([]);
  const [showExternalSuggestions, setShowExternalSuggestions] = useState(false);
  
  // Track initialization to prevent unnecessary resets
  const initializedRef = useRef<string | null>(null);
  
  
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
      
      // Determine split mode
      const selectedParticipants = participantEntries.filter(p => p.isSelected);
      const equalSplit = selectedParticipants.length > 0 ? 100 / selectedParticipants.length : 0;
      const isEven = selectedParticipants.every(p => 
        Math.abs(Number(p.splitPercentage) - equalSplit) < 0.01
      );
      setSplitMode(isEven ? 'even' : 'custom');
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
      setSplitMode('even');
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
  };
  
  const handleSplitPercentageChange = (index: number, value: string) => {
    const percentage = parseFloat(value) || 0;
    setParticipants(prev => {
      const updated = [...prev];
      updated[index].splitPercentage = percentage;
      return updated;
    });
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
    
    const selectedCount = participants.filter(p => p.isSelected).length;
    const evenSplit = calculateEvenSplit(selectedCount + 1);
    
    setParticipants(prev => [
      ...prev,
      {
        externalName: externalName.trim(),
        splitPercentage: evenSplit,
        isSelected: true
      }
    ]);
    
    setExternalName('');
    setShowExternalForm(false);
    setShowExternalSuggestions(false);
    
    // Refresh external participants list to include the new one
    fetchExternalParticipants();
  };
  
  const handleRemoveParticipant = (index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedParticipants = participants.filter(p => p.isSelected);
    
    if (selectedParticipants.length === 0) {
      error('Validation Error', 'Please select at least one participant');
      return;
    }
    
    if (!validateSplitPercentages(selectedParticipants)) {
      error('Validation Error', 'Split percentages must sum to 100%');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const participantData = selectedParticipants.map(p => ({
        participantId: p.participantId && p.participantId !== '' ? p.participantId : undefined,
        externalName: p.externalName && p.externalName !== '' ? p.externalName : undefined,
        splitPercentage: Number(p.splitPercentage)
      }));
      
      let expenseData: any;
      
      if (expense) {
        // Update expense - only send changed fields
        expenseData = {
          description,
          amount: parseFloat(amount),
          category: category || null,
          ownerId,
          dayId: selectedEventId ? null : (dayId && dayId !== '' ? dayId : null),
          eventId: selectedEventId && selectedEventId !== '' ? selectedEventId : null,
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
          participants: participantData
        };
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
  
  const totalPercentage = participants
    .filter(p => p.isSelected)
    .reduce((sum, p) => sum + Number(p.splitPercentage), 0);
  
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
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
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
                  {splitMode === 'even' 
                    ? 'Even split mode - percentages recalculated automatically when selections change' 
                    : 'Custom split mode - percentages recalculated when selections change, then manually editable'
                  }
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={splitMode === 'even' ? 'default' : 'outline'}
                  onClick={() => {
                    setSplitMode('even');
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
                  Even Split
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={splitMode === 'custom' ? 'default' : 'outline'}
                  onClick={() => setSplitMode('custom')}
                >
                  Custom Split
                </Button>
              </div>
            </div>
            
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
                        {splitMode === 'custom' && (
                          <Input
                            type="number"
                            step="0.01"
                            value={participant.splitPercentage}
                            onChange={(e) => handleSplitPercentageChange(index, e.target.value)}
                            className="w-20"
                          />
                        )}
                        <span className="text-sm text-gray-500 w-12">
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
                  
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        value={externalName}
                        onChange={(e) => {
                          setExternalName(e.target.value);
                          setShowExternalSuggestions(e.target.value.length > 0);
                        }}
                        placeholder="External participant name"
                        className="w-full"
                      />
                      
                      {/* Filtered suggestions dropdown */}
                      {showExternalSuggestions && externalName.trim() && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-32 overflow-y-auto">
                          {externalParticipants
                            .filter(p => p.name.toLowerCase().includes(externalName.toLowerCase()))
                            .slice(0, 5)
                            .map((participant) => (
                              <button
                                key={participant.id}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                onClick={() => {
                                  setExternalName(participant.name);
                                  setShowExternalSuggestions(false);
                                }}
                              >
                                {participant.name}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddExternal}
                    disabled={!externalName.trim()}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowExternalForm(false);
                      setExternalName('');
                      setShowExternalSuggestions(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                </div>
              )}
            </div>
            
            {Math.abs(totalPercentage - 100) > 0.01 && (
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
                  disabled={isSubmitting || Math.abs(totalPercentage - 100) > 0.01}
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