'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, ChevronRight, TrendingUp, TrendingDown, Users, MapPin } from 'lucide-react'

interface PersonalExpenseSummary {
  currentMemberId: string
  currentMemberName: string
  totalExpensesAcrossAllTrips: number
  totalYouOwe: number
  totalOwedToYou: number
  netBalance: number
  tripBreakdowns: {
    tripId: string
    tripName: string
    tripDestination: string | null
    totalExpenses: number
    yourShare: number
    youOwe: number
    owedToYou: number
  }[]
  peopleYouOwe: {
    memberId: string
    memberName: string
    amount: number
    trips: { tripId: string; tripName: string; amount: number }[]
  }[]
  peopleWhoOweYou: {
    memberId: string
    memberName: string
    amount: number
    trips: { tripId: string; tripName: string; amount: number }[]
  }[]
}

interface ExpensesViewProps {
  className?: string
  data?: PersonalExpenseSummary | null
  loading?: boolean
}

export default function ExpensesView({ className, data, loading = false }: ExpensesViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const summary = data

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            My Expenses
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

  if (!summary) {
    return null
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              My Expenses
            </CardTitle>
            <CardDescription>
              Hi {summary.currentMemberName}! Here's your expense summary
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Balance Overview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-red-600 font-medium">You Owe</p>
                  <p className="text-lg font-bold text-red-700">{formatCurrency(summary.totalYouOwe)}</p>
                </div>
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-medium">Owed to You</p>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(summary.totalOwedToYou)}</p>
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </div>

          {/* Net Balance */}
          <div className={`rounded-lg p-3 ${summary.netBalance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            <p className="text-sm font-medium text-gray-700">Net Balance</p>
            <p className={`text-xl font-bold ${summary.netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(Math.abs(summary.netBalance))}
              <span className="text-sm font-normal ml-2">
                {summary.netBalance >= 0 ? 'to receive' : 'to pay'}
              </span>
            </p>
          </div>

          {/* Trip Breakdown */}
          {summary.tripBreakdowns.length > 0 && (
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newSections = new Set(expandedSections)
                  if (newSections.has('trips')) {
                    newSections.delete('trips')
                  } else {
                    newSections.add('trips')
                  }
                  setExpandedSections(newSections)
                }}
                className="w-full justify-between p-2 hover:bg-gray-50"
              >
                <span className="flex items-center gap-2 font-medium">
                  <MapPin className="w-4 h-4" />
                  Cost per Trip
                </span>
                <ChevronRight className={`w-4 h-4 transition-transform ${expandedSections.has('trips') ? 'rotate-90' : ''}`} />
              </Button>
              
              {expandedSections.has('trips') && (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {summary.tripBreakdowns.map((trip) => (
                    <div key={trip.tripId} className="bg-gray-50 rounded p-3 text-sm">
                      <div className="font-medium text-gray-900">{trip.tripName}</div>
                      <div className="text-xs text-gray-500 mb-2">{trip.tripDestination || 'No destination'}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-600">Total:</span>
                          <span className="font-medium ml-1">{formatCurrency(trip.totalExpenses)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Your share:</span>
                          <span className="font-medium ml-1">{formatCurrency(trip.yourShare)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">You owe:</span>
                          <span className="font-medium text-red-600 ml-1">{formatCurrency(trip.youOwe)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Owed to you:</span>
                          <span className="font-medium text-green-600 ml-1">{formatCurrency(trip.owedToYou)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* People You Owe */}
          {summary.peopleYouOwe.length > 0 && (
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newSections = new Set(expandedSections)
                  if (newSections.has('owe')) {
                    newSections.delete('owe')
                  } else {
                    newSections.add('owe')
                  }
                  setExpandedSections(newSections)
                }}
                className="w-full justify-between p-2 hover:bg-gray-50"
              >
                <span className="flex items-center gap-2 font-medium text-red-700">
                  <Users className="w-4 h-4" />
                  Who You Owe ({summary.peopleYouOwe.length})
                </span>
                <ChevronRight className={`w-4 h-4 transition-transform ${expandedSections.has('owe') ? 'rotate-90' : ''}`} />
              </Button>
              
              {expandedSections.has('owe') && (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {summary.peopleYouOwe.map((person) => (
                    <div key={person.memberId} className="bg-red-50 rounded p-3">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-gray-900">{person.memberName}</span>
                        <span className="font-bold text-red-700">{formatCurrency(person.amount)}</span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        {person.trips.map((trip) => (
                          <div key={trip.tripId} className="flex justify-between">
                            <span className="truncate mr-2">{trip.tripName}</span>
                            <span className="font-medium">{formatCurrency(trip.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* People Who Owe You */}
          {summary.peopleWhoOweYou.length > 0 && (
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newSections = new Set(expandedSections)
                  if (newSections.has('owed')) {
                    newSections.delete('owed')
                  } else {
                    newSections.add('owed')
                  }
                  setExpandedSections(newSections)
                }}
                className="w-full justify-between p-2 hover:bg-gray-50"
              >
                <span className="flex items-center gap-2 font-medium text-green-700">
                  <Users className="w-4 h-4" />
                  Who Owes You ({summary.peopleWhoOweYou.length})
                </span>
                <ChevronRight className={`w-4 h-4 transition-transform ${expandedSections.has('owed') ? 'rotate-90' : ''}`} />
              </Button>
              
              {expandedSections.has('owed') && (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {summary.peopleWhoOweYou.map((person) => (
                    <div key={person.memberId} className="bg-green-50 rounded p-3">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-gray-900">{person.memberName}</span>
                        <span className="font-bold text-green-700">{formatCurrency(person.amount)}</span>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        {person.trips.map((trip) => (
                          <div key={trip.tripId} className="flex justify-between">
                            <span className="truncate mr-2">{trip.tripName}</span>
                            <span className="font-medium">{formatCurrency(trip.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* No Expenses Message */}
          {summary.totalExpensesAcrossAllTrips === 0 && (
            <div className="text-center py-6">
              <DollarSign className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">No expenses yet</p>
              <p className="text-xs text-gray-500 mt-1">Start tracking expenses in your trips!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}