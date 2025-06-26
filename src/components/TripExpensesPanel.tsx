'use client'

import { useState } from 'react'
import { DollarSign, Calendar, Tag, User, Link as LinkIcon, Edit, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Event } from '@prisma/client'
import type { Expense } from '@/types/expense'
import { formatDateForDisplay } from '@/lib/dateTimeUtils'

interface TripExpensesPanelProps {
  expenses: Expense[]
  events: Event[]
  isOpen: boolean
  onClose: () => void
  onEditExpense?: (expense: Expense) => void
  onDeleteExpense?: (expense: Expense) => void
  onAddExpense?: () => void
  deletingExpenseIds?: Set<string>
}

export default function TripExpensesPanel({
  expenses,
  events,
  isOpen,
  onClose,
  onEditExpense,
  onDeleteExpense,
  onAddExpense,
  deletingExpenseIds = new Set()
}: TripExpensesPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Get unique categories
  const categories = Array.from(new Set(expenses.map(e => e.category).filter(Boolean)))
  
  // Filter expenses by category
  const filteredExpenses = selectedCategory === 'all' 
    ? expenses 
    : expenses.filter(e => e.category === selectedCategory)
  
  // Calculate totals
  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const standaloneExpenses = filteredExpenses.filter(e => !e.eventId)
  const eventExpenses = filteredExpenses.filter(e => e.eventId)
  
  // Group expenses by event
  const expensesByEvent = eventExpenses.reduce((acc, expense) => {
    const eventId = expense.eventId!
    if (!acc[eventId]) {
      acc[eventId] = []
    }
    acc[eventId].push(expense)
    return acc
  }, {} as Record<string, Expense[]>)

  if (!isOpen) return null

  return (
    <>
      {/* Invisible overlay to catch clicks outside */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div 
        className="fixed right-0 top-0 h-full z-50 w-[480px] transform transition-transform duration-300 ease-out"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)'
        }}
      >
        <div className="h-full overflow-y-auto bg-white shadow-2xl border-l-2 border-gray-300">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Trip Expenses</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Total: <span className="font-semibold text-green-600">${totalAmount.toFixed(2)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {onAddExpense && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddExpense}
                    className="h-8 px-3"
                  >
                    <DollarSign className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="h-8 px-2 hover:bg-red-50 hover:border-red-300"
                  title="Close Panel"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('all')}
                  className="h-7 text-xs"
                >
                  All ({expenses.length})
                </Button>
                {categories.map(category => {
                  const count = expenses.filter(e => e.category === category).length
                  return (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(category!)}
                      className="h-7 text-xs"
                    >
                      {category} ({count})
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Expenses Content */}
          <div className="p-4 space-y-6">
            {/* Standalone Expenses */}
            {standaloneExpenses.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  <span>Standalone Expenses</span>
                  <span className="ml-auto text-gray-500">
                    ({standaloneExpenses.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {standaloneExpenses.map((expense) => (
                    <ExpenseItem 
                      key={expense.id} 
                      expense={expense} 
                      onEdit={onEditExpense}
                      onDelete={onDeleteExpense}
                      isDeleting={deletingExpenseIds.has(expense.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Event-linked Expenses */}
            {Object.entries(expensesByEvent).map(([eventId, eventExpenses]) => {
              const event = events.find(e => e.id === eventId)
              if (!event) return null

              const eventTotal = eventExpenses.reduce((sum, e) => sum + Number(e.amount), 0)

              return (
                <div key={eventId} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-700">{event.title}</div>
                      <div className="text-xs text-gray-500">
                        {event.startSlot} - {event.endSlot || 'End'}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      ${eventTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-2 ml-6">
                    {eventExpenses.map((expense) => (
                      <ExpenseItem 
                        key={expense.id} 
                        expense={expense} 
                        onEdit={onEditExpense}
                        onDelete={onDeleteExpense}
                        isNested
                        isDeleting={deletingExpenseIds.has(expense.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {filteredExpenses.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No expenses found</p>
                {selectedCategory !== 'all' && (
                  <p className="text-sm mt-1">Try selecting a different category</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// Individual expense item component
function ExpenseItem({ 
  expense, 
  onEdit,
  onDelete,
  isNested = false,
  isDeleting = false
}: { 
  expense: Expense
  onEdit?: (expense: Expense) => void
  onDelete?: (expense: Expense) => void
  isNested?: boolean
  isDeleting?: boolean
}) {
  return (
    <div className={`bg-gray-50 p-3 rounded hover:bg-gray-100 hover:shadow-sm transition-all cursor-pointer ${isNested ? 'text-sm' : ''} ${isDeleting ? 'opacity-50 animate-pulse' : ''}`}
         onClick={() => !isDeleting && onEdit && onEdit(expense)}
         title={isDeleting ? "Deleting expense..." : "Click to edit expense"}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="font-medium text-gray-700 break-words">{expense.description}</div>
              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                {expense.category && (
                  <div className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {expense.category}
                  </div>
                )}
                {expense.eventId && expense.createdAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateForDisplay(expense.createdAt)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <div className="text-sm font-semibold text-gray-900">
            ${Number(expense.amount).toFixed(2)}
          </div>
          <div className="flex items-center gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(expense);
                }}
                className="h-7 w-7 p-0 hover:bg-gray-200"
                title="Edit expense"
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(expense);
                }}
                className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600"
                title="Delete expense"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
      {!expense.eventId && (
        <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
          <LinkIcon className="h-3 w-3" />
          <span>Not linked to any event</span>
        </div>
      )}
    </div>
  )
}