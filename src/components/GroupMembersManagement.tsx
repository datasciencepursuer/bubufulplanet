'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserPlus, Settings, Trash2, Shield, Eye, Edit, Plus, LogOut, AlertTriangle } from 'lucide-react'
import { getRoleDisplay, getPermissionDisplay } from '@/lib/permissions'
import ConfirmDialog from './ConfirmDialog'
import { useNotify } from '@/hooks/useNotify'
import { useOptimizedGroup, createGroupedFetch } from '@/lib/groupUtils'

interface GroupMember {
  id: string
  travelerName: string
  email?: string
  role: string
  permissions: {
    read: boolean
    create: boolean
    modify: boolean
  }
  joinedAt: string
  isCurrentUser?: boolean
  isLinked?: boolean // Whether the user has signed up and linked their account
}

interface GroupMembersManagementProps {
  readOnly?: boolean
}

export default function GroupMembersManagement({ readOnly = false }: GroupMembersManagementProps) {
  const { error, success } = useNotify()
  const { selectedGroup, isAdventurer } = useOptimizedGroup()
  const groupedFetch = createGroupedFetch()
  const router = useRouter()
  
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [defaultPermissions, setDefaultPermissions] = useState({
    read: true,
    create: true,
    modify: false
  })
  const [editingMember, setEditingMember] = useState<string | null>(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null)
  const [showLeaveGroup, setShowLeaveGroup] = useState(false)
  const [leavingGroup, setLeavingGroup] = useState(false)

  useEffect(() => {
    if (selectedGroup?.id) {
      loadMembers()
    }
  }, [selectedGroup?.id])

  const loadMembers = async () => {
    if (!selectedGroup?.id) {
      setLoading(false)
      return
    }
    
    try {
      const response = await groupedFetch(`/api/groups/members?groupId=${selectedGroup.id}`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
      } else {
        console.error('Failed to load members:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error loading members:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberName.trim() || !newMemberEmail.trim() || !selectedGroup?.id || readOnly) return

    try {
      const response = await groupedFetch(`/api/groups/members?groupId=${selectedGroup.id}`, {
        method: 'POST',
        body: JSON.stringify({ 
          travelerName: newMemberName.trim(),
          email: newMemberEmail.trim().toLowerCase(),
          permissions: defaultPermissions,
          role: 'party member'
        })
      })

      if (response.ok) {
        setNewMemberName('')
        setNewMemberEmail('')
        setShowAddMember(false)
        loadMembers()
      } else {
        const data = await response.json()
        error('Add Member Failed', data.error || 'Failed to add member')
      }
    } catch (err) {
      console.error('Error adding member:', err)
      error('Add Member Failed', 'Failed to add member. Please try again.')
    }
  }

  const handleUpdatePermissions = async (memberId: string, permissions: any) => {
    if (!selectedGroup?.id || readOnly) return
    
    try {
      const response = await groupedFetch(`/api/groups/members?groupId=${selectedGroup.id}`, {
        method: 'PUT',
        body: JSON.stringify({ memberId, permissions })
      })

      if (response.ok) {
        setEditingMember(null)
        loadMembers()
      } else {
        const data = await response.json()
        error('Update Failed', data.error || 'Failed to update permissions')
      }
    } catch (err) {
      console.error('Error updating permissions:', err)
      error('Update Failed', 'Failed to update permissions. Please try again.')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (readOnly) return
    
    try {
      const response = await groupedFetch(`/api/groups/members/${memberId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setShowConfirmDelete(null)
        loadMembers()
      } else {
        const data = await response.json()
        error('Remove Failed', data.error || 'Failed to remove member')
      }
    } catch (err) {
      console.error('Error removing member:', err)
      error('Remove Failed', 'Failed to remove member. Please try again.')
    }
  }

  const handleLeaveGroup = async () => {
    if (!selectedGroup?.id || leavingGroup) return
    
    try {
      setLeavingGroup(true)
      const response = await fetch('/api/groups/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupId: selectedGroup.id }),
      })

      if (response.ok) {
        success('Left Group', 'You have successfully left the group.')
        setShowLeaveGroup(false)
        // Redirect to groups page or login if user has no other groups
        setTimeout(() => {
          router.push('/groups')
        }, 1500)
      } else {
        const data = await response.json()
        error('Leave Failed', data.error || 'Failed to leave group')
      }
    } catch (err) {
      console.error('Error leaving group:', err)
      error('Leave Failed', 'Failed to leave group. Please try again.')
    } finally {
      setLeavingGroup(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Group Members</CardTitle>
            <CardDescription>
              {isAdventurer ? 'Manage member permissions' : 'View group members'}
            </CardDescription>
          </div>
          {isAdventurer && !readOnly && (
            <Button
              size="sm"
              onClick={() => setShowAddMember(true)}
              className="gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add Member
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {members.map((member) => (
            <div key={member.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">
                      {member.travelerName}
                      {member.isCurrentUser && (
                        <span className="ml-2 text-xs text-gray-500">(You)</span>
                      )}
                    </h4>
                    {member.role === 'adventurer' && (
                      <Shield className="w-4 h-4 text-amber-600" />
                    )}
                    {!member.isLinked && (
                      <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {getRoleDisplay(member.role)}
                    {member.email && (
                      <span className="text-gray-400"> • {member.email}</span>
                    )}
                  </p>
                  
                  {editingMember === member.id ? (
                    <div className="mt-3 space-y-2 bg-gray-50 p-3 rounded">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={member.permissions.create}
                          onChange={(e) => {
                            const newPermissions = { ...member.permissions, create: e.target.checked }
                            setMembers(members.map(m => 
                              m.id === member.id ? { ...m, permissions: newPermissions } : m
                            ))
                          }}
                          className="rounded"
                          disabled={member.role === 'adventurer' || readOnly}
                        />
                        <Plus className="w-3 h-3" />
                        Can create trips & events
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={member.permissions.modify}
                          onChange={(e) => {
                            const newPermissions = { ...member.permissions, modify: e.target.checked }
                            setMembers(members.map(m => 
                              m.id === member.id ? { ...m, permissions: newPermissions } : m
                            ))
                          }}
                          className="rounded"
                          disabled={member.role === 'adventurer' || readOnly}
                        />
                        <Edit className="w-3 h-3" />
                        Can edit & delete items
                      </label>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => {
                            const memberToUpdate = members.find(m => m.id === member.id)
                            if (memberToUpdate) {
                              handleUpdatePermissions(member.id, memberToUpdate.permissions)
                            }
                          }}
                          disabled={member.role === 'adventurer' || readOnly}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingMember(null)
                            loadMembers() // Reset to original
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {getPermissionDisplay(member.permissions)}
                      </span>
                    </div>
                  )}
                </div>
                
                {isAdventurer && member.role !== 'adventurer' && !readOnly && (
                  <div className="flex items-center gap-1 ml-4">
                    {editingMember !== member.id && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingMember(member.id)}
                          className="p-1"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        {!member.isCurrentUser && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowConfirmDelete(member.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Member Form */}
        {showAddMember && !readOnly && (
          <div className="border-t p-4 bg-gray-50">
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Traveler Name
                  </label>
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Enter traveler name"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Permissions
                </label>
                <div className="space-y-2 bg-white p-3 rounded border">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={defaultPermissions.create}
                      onChange={(e) => setDefaultPermissions(prev => ({ 
                        ...prev, 
                        create: e.target.checked 
                      }))}
                      className="rounded"
                    />
                    <Plus className="w-3 h-3" />
                    Can create trips & events
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={defaultPermissions.modify}
                      onChange={(e) => setDefaultPermissions(prev => ({ 
                        ...prev, 
                        modify: e.target.checked 
                      }))}
                      className="rounded"
                    />
                    <Edit className="w-3 h-3" />
                    Can edit & delete items
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={!newMemberName.trim() || !newMemberEmail.trim() || readOnly}
                  className="flex-1"
                >
                  Send Invitation
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddMember(false)
                    setNewMemberName('')
                    setNewMemberEmail('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
            <p className="text-xs text-gray-500 mt-2">
              Members will be linked automatically when they sign up with the provided email address.
              If they already have an account with this email, they'll be added immediately.
            </p>
          </div>
        )}

        {/* Leave Group Section - Always available to all users */}
        <div className="border-t p-4 bg-red-50">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Danger Zone
              </h4>
              <p className="text-sm text-red-600 mt-1">
                Leave this travel group permanently. This action cannot be undone.
              </p>
              {isAdventurer && (
                <p className="text-xs text-red-500 mt-1">
                  Note: As the group leader, you can only leave if there are other adventurers in the group.
                </p>
              )}
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowLeaveGroup(true)}
              className="gap-2"
              disabled={leavingGroup}
            >
              <LogOut className="w-4 h-4" />
              {leavingGroup ? 'Leaving...' : 'Leave Group'}
            </Button>
          </div>
        </div>

        {/* Confirm Delete Dialog */}
        <ConfirmDialog
          isOpen={!!showConfirmDelete}
          onClose={() => setShowConfirmDelete(null)}
          onConfirm={() => {
            if (showConfirmDelete) {
              handleRemoveMember(showConfirmDelete)
            }
          }}
          title="Remove Member"
          message="Are you sure you want to remove this member from the group? They will need to rejoin with the access code."
          confirmText="Remove"
          cancelText="Cancel"
        />

        {/* Confirm Leave Group Dialog */}
        <ConfirmDialog
          isOpen={showLeaveGroup}
          onClose={() => setShowLeaveGroup(false)}
          onConfirm={handleLeaveGroup}
          title="Leave Group"
          message={`Are you sure you want to leave "${selectedGroup?.name}"? You will lose access to all trips, events, and group data. You'll need an invitation or access code to rejoin.`}
          confirmText={leavingGroup ? 'Leaving...' : 'Leave Group'}
          cancelText="Stay in Group"
        />
      </CardContent>
    </Card>
  )
}