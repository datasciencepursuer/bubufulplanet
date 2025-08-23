'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, AlertCircle } from 'lucide-react'
import GroupMembersManagement from '@/components/GroupMembersManagement'
import { useOptimizedGroup } from '@/lib/groupUtils'
import BearGlobeLoader from '@/components/BearGlobeLoader'

export default function GroupSettings() {
  const router = useRouter()
  const { selectedGroup, isAdventurer, isLoading } = useOptimizedGroup()

  if (isLoading || !selectedGroup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 flex items-center justify-center">
        <BearGlobeLoader />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button 
            onClick={() => router.push('/app')}
            variant="outline"
            className="mb-4"
          >
            ← Back to Dashboard
          </Button>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-teal-800 flex items-center gap-2">
                <Shield className="w-6 h-6" />
                Group Settings
              </CardTitle>
              <CardDescription>
                {isAdventurer 
                  ? "Manage group members and their permissions" 
                  : "View group members and their roles"
                }
              </CardDescription>
              {!isAdventurer && (
                <div className="flex items-center gap-2 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    You have view-only access. Only group adventurers can make changes.
                  </span>
                </div>
              )}
            </CardHeader>
          </Card>
        </div>

        {/* Embed the GroupMembersManagement component with read-only flag */}
        <GroupMembersManagement readOnly={!isAdventurer} />
      </div>
    </div>
  )
}