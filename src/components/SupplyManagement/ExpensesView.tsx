'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, DollarSign, TrendingUp, Calendar, MapPin, BarChart3 } from 'lucide-react'

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
  onBack: () => void
}

export default function ExpensesView({ onBack }: ExpensesViewProps) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadExpenses()
  }, [])

  const loadExpenses = async () => {
    try {
      setLoading(true)
      // This endpoint will need to be created to aggregate all expenses across all trips
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

  const getExpensesByTrip = () => {
    const tripTotals: Record<string, { name: string, destination: string, amount: number }> = {}
    
    expenses.forEach(expense => {
      const amount = typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount.toString())
      
      if (!isNaN(amount)) {
        if (!tripTotals[expense.tripId]) {
          tripTotals[expense.tripId] = {
            name: expense.tripName,
            destination: expense.tripDestination,
            amount: 0
          }
        }
        tripTotals[expense.tripId].amount += amount
      }
    })
    
    return Object.entries(tripTotals)
      .map(([tripId, data]) => ({ tripId, ...data }))
      .sort((a, b) => b.amount - a.amount)
  }

  const totalExpenses = calculateTotalExpenses()
  const expensesByCategory = getExpensesByCategory()
  const expensesByTrip = getExpensesByTrip()

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-4 mb-6 pb-4 border-b">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h2 className="text-xl font-semibold">Expenses</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-800 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading expenses...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-4 mb-6 pb-4 border-b">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h2 className="text-xl font-semibold">Expenses</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <DollarSign className="w-12 h-12 mx-auto text-red-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading expenses</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadExpenses}>Try Again</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Expenses Overview</h2>
          <p className="text-sm text-gray-600">{expenses.length} total expenses</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {expenses.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses yet</h3>
            <p className="text-gray-600">
              Expenses will appear here when you add them to your trip events.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Total Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalExpenses.toFixed(2)}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{expensesByCategory.length}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Avg per Trip
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${expensesByTrip.length > 0 ? (totalExpenses / expensesByTrip.length).toFixed(2) : '0.00'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Expenses by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
                <CardDescription>Breakdown of spending by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {expensesByCategory.map(({ category, amount }) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-teal-600 rounded-full"></div>
                        <span className="font-medium">{category}</span>
                      </div>
                      <span className="text-lg font-semibold">${amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Expenses by Trip */}
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Trip</CardTitle>
                <CardDescription>Total spending per trip</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {expensesByTrip.map(({ tripId, name, destination, amount }) => (
                    <div key={tripId} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{name}</h4>
                          {destination && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                              <MapPin className="w-3 h-3" />
                              {destination}
                            </div>
                          )}
                        </div>
                        <div className="text-lg font-semibold">${amount.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Development Notice */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">🚧 Under Development</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-800">
                  This expenses page is being actively developed. Future features will include:
                </p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1">
                  <li>• Interactive charts and graphs</li>
                  <li>• Export functionality (CSV, PDF)</li>
                  <li>• Date range filtering</li>
                  <li>• Budget tracking and alerts</li>
                  <li>• Currency conversion support</li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}