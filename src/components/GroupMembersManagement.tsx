'use client'

import { useState, useEffect, useContext } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserPlus, Settings, Trash2, Shield, Eye, Edit, Plus } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { getRoleDisplay, getPermissionDisplay } from '@/lib/permissions'
import ConfirmDialog from './ConfirmDialog'
import { useNotify } from '@/hooks/useNotify'
import { GroupContext } from '@/contexts/GroupContext'

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

export default function GroupMembersManagement() {
  const { error } = useNotify()
  const context = useContext(GroupContext)
  
  if (!context) {
    throw new Error('GroupMembersManagement must be used within a GroupProvider')
  }

  const { selectedGroup } = context
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
  const { isAdventurer } = usePermissions()

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
      const response = await fetch(`/api/groups/members?groupId=${selectedGroup.id}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
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
    if (!newMemberName.trim() || !newMemberEmail.trim() || !selectedGroup?.id) return

    try {
      const response = await fetch(`/api/groups/members?groupId=${selectedGroup.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
    if (!selectedGroup?.id) return
    
    try {
      const response = await fetch(`/api/groups/members?groupId=${selectedGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
    try {
      const response = await fetch(`/api/groups/members/${memberId}`, {
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
              {isAdventurer() ? 'Manage member permissions' : 'View group members'}
            </CardDescription>
          </div>
          {isAdventurer() && (
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
                          disabled={member.role === 'adventurer'}
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
                          disabled={member.role === 'adventurer'}
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
                          disabled={member.role === 'adventurer'}
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
                
                {isAdventurer() && member.role !== 'adventurer' && (
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
        {showAddMember && (
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
                  disabled={!newMemberName.trim() || !newMemberEmail.trim()}
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
      </CardContent>
    </Card>
  )
}