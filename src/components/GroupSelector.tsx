'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Users, Plus, Settings } from 'lucide-react'

interface Group {
  id: string
  name: string
  accessCode: string
  role: string
  memberCount: number
  tripCount: number
}

interface GroupSelectorProps {
  currentGroupId: string | null
  onGroupChange: (groupId: string) => void
  onManageGroup?: (groupId: string) => void
  onCreateGroup?: () => void
}

export default function GroupSelector({ 
  currentGroupId, 
  onGroupChange, 
  onManageGroup,
  onCreateGroup 
}: GroupSelectorProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = async () => {
    try {
      const response = await fetch('/api/user/groups')
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
        
        // Auto-select first group if no current selection
        if (!currentGroupId && data.groups?.length > 0) {
          onGroupChange(data.groups[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentGroup = groups.find(g => g.id === currentGroupId)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 text-white transition-all duration-200"
        disabled={loading}
      >
        <Users className="w-4 h-4" />
        <span className="font-medium">
          {loading ? 'Loading...' : (currentGroup?.name || 'Select Group')}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !loading && (
        <div className="absolute top-full mt-2 left-0 right-0 min-w-[280px] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
          <div className="max-h-96 overflow-y-auto">
            {groups.map(group => (
              <div
                key={group.id}
                className={`border-b border-gray-100 last:border-0 ${
                  group.id === currentGroupId ? 'bg-teal-50' : ''
                }`}
              >
                <button
                  onClick={() => {
                    onGroupChange(group.id)
                    setIsOpen(false)
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{group.name}</div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                        <span>{group.memberCount} members</span>
                        <span>{group.tripCount} trips</span>
                        {group.role === 'leader' && (
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs">
                            Leader
                          </span>
                        )}
                      </div>
                    </div>
                    {group.role === 'leader' && onManageGroup && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onManageGroup(group.id)
                          setIsOpen(false)
                        }}
                        className="ml-2 p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Manage Group"
                      >
                        <Settings className="w-4 h-4 text-gray-600" />
                      </button>
                    )}
                  </div>
                </button>
              </div>
            ))}
          </div>

          {groups.length < 5 && onCreateGroup && (
            <button
              onClick={() => {
                onCreateGroup()
                setIsOpen(false)
              }}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium flex items-center justify-center gap-2 border-t border-gray-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Group
            </button>
          )}

          {groups.length >= 5 && (
            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 text-center border-t border-gray-200">
              Maximum of 5 groups reached
            </div>
          )}
        </div>
      )}
    </div>
  )
}