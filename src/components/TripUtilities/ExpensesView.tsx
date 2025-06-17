'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, ChevronRight } from 'lucide-react'

interface Expense {
  id: string
  description: string
  amount: number | string
  category: string
  eventId: string
  tripId: string
  eventTitle: string
  tripName: string
  tripDestination: string
  eventDate: string
}

interface ExpensesViewProps {
  className?: string
}

export default function ExpensesView({ className }: ExpensesViewProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    loadExpenses()
  }, [])

  const loadExpenses = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/expenses/all')
      
      if (response.ok) {
        const data = await response.json()
        setExpenses(data.expenses || [])
      } else {
        throw new Error('Failed to load expenses')
      }
    } catch (error) {
      console.error('Error loading expenses:', error)
      setError('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }

  const calculateTotalExpenses = () => {
    return expenses.reduce((total, expense) => {
      const amount = typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount.toString())
      return total + (isNaN(amount) ? 0 : amount)
    }, 0)
  }

  const getExpensesByCategory = () => {
    const categoryTotals: Record<string, number> = {}
    
    expenses.forEach(expense => {
      const category = expense.category || 'Uncategorized'
      const amount = typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount.toString())
      
      if (!isNaN(amount)) {
        categoryTotals[category] = (categoryTotals[category] || 0) + amount
      }
    })
    
    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  }

  const totalExpenses = calculateTotalExpenses()
  const expensesByCategory = getExpensesByCategory()
  const recentExpenses = expenses.slice(0, showAll ? expenses.length : 5)

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-800"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-red-600 mb-2">{error}</p>
            <Button onClick={loadExpenses} size="sm">Try Again</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Expenses
            </CardTitle>
            <CardDescription>
              ${totalExpenses.toFixed(2)} across {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          {expenses.length > 5 && (
            <Button
              onClick={() => setShowAll(!showAll)}
              variant="ghost"
              size="sm"
              className="gap-1"
            >
              {showAll ? 'Show Less' : `View All ${expenses.length}`}
              <ChevronRight className={`w-4 h-4 transition-transform ${showAll ? 'rotate-90' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <div className="text-center py-6">
            <DollarSign className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-2">No expenses yet</p>
            <p className="text-xs text-gray-500">Expenses will appear when you add them to trip events</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-sm font-semibold text-green-600">${totalExpenses.toFixed(2)}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-sm font-semibold text-blue-600">{expensesByCategory.length}</div>
                <div className="text-xs text-gray-600">Categories</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="text-sm font-semibold text-purple-600">
                  ${expenses.length > 0 ? (totalExpenses / expenses.length).toFixed(2) : '0.00'}
                </div>
                <div className="text-xs text-gray-600">Avg/Item</div>
              </div>
            </div>

            {/* Top Categories */}
            {expensesByCategory.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Top Categories</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {expensesByCategory.slice(0, showAll ? expensesByCategory.length : 3).map(({ category, amount }) => (
                    <div key={category} className="flex items-center justify-between text-sm">
                      <span className="truncate">{category}</span>
                      <span className="font-medium">${amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Expenses */}
            <div>
              <h4 className="text-sm font-medium mb-2">Recent Expenses</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {recentExpenses.map((expense) => {
                  const amount = typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount.toString())
                  return (
                    <div key={expense.id} className="p-2 border rounded text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium truncate">{expense.description}</span>
                        <span className="font-semibold">${amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="truncate">{expense.tripName}</span>
                        <span>{expense.category || 'Uncategorized'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Development Notice */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs">
              <div className="font-medium text-blue-900 mb-1">🚧 Under Development</div>
              <p className="text-blue-800">
                Charts, exports, and advanced filtering coming soon!
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}