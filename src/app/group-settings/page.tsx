'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import GroupMembersManagement from '@/components/GroupMembersManagement'

export default function GroupSettings() {
  const router = useRouter()

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
              <CardTitle className="text-2xl font-bold text-teal-800">Group Settings</CardTitle>
              <CardDescription>
                Manage group members and their permissions
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Embed the GroupMembersManagement component */}
        <GroupMembersManagement />
      </div>
    </div>
  )
}