'use client'

import { useState, useEffect } from 'react'
import { X, Mail, Copy, Check, UserPlus, Trash2 } from 'lucide-react'

interface GroupMember {
  id: string
  travelerName: string
  email?: string
  role: string
  joinedAt: string
}

interface GroupManagementModalProps {
  groupId: string
  groupName: string
  accessCode: string
  isOpen: boolean
  onClose: () => void
}

export default function GroupManagementModal({
  groupId,
  groupName,
  accessCode,
  isOpen,
  onClose
}: GroupManagementModalProps) {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [emails, setEmails] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadMembers()
    }
  }, [isOpen, groupId])

  const loadMembers = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/groups/${groupId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
      }
    } catch (error) {
      console.error('Error loading members:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEmail = () => {
    const email = emailInput.trim().toLowerCase()
    if (email && email.includes('@') && !emails.includes(email)) {
      setEmails([...emails, email])
      setEmailInput('')
      setError('')
    }
  }

  const handleRemoveEmail = (email: string) => {
    setEmails(emails.filter(e => e !== email))
  }

  const handleInvite = async () => {
    if (emails.length === 0) return

    setInviting(true)
    setError('')

    try {
      const response = await fetch(`/api/groups/${groupId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails })
      })

      if (response.ok) {
        const data = await response.json()
        setEmails([])
        loadMembers() // Reload members list
        
        // Show success message
        const successCount = data.results.filter((r: any) => 
          r.status === 'invited_existing_user' || r.status === 'invited_new_user'
        ).length
        
        if (successCount > 0) {
          setError(`Successfully invited ${successCount} member(s)`)
        }
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to send invitations')
      }
    } catch (error) {
      setError('An error occurred while sending invitations')
    } finally {
      setInviting(false)
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(accessCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Manage Group</h2>
            <p className="text-sm text-gray-500 mt-1">{groupName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Access Code Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Group Access Code</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white rounded border border-gray-200 font-mono text-lg">
                {accessCode}
              </code>
              <button
                onClick={handleCopyCode}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Share this code with others to let them join the group
            </p>
          </div>

          {/* Invite by Email Section */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Invite Members by Email</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                  placeholder="Enter email address"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  onClick={handleAddEmail}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>

              {emails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {emails.map(email => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm"
                    >
                      {email}
                      <button
                        onClick={() => handleRemoveEmail(email)}
                        className="hover:text-teal-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {emails.length > 0 && (
                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  {inviting ? 'Sending Invitations...' : `Invite ${emails.length} Member(s)`}
                </button>
              )}

              {error && (
                <p className={`text-sm ${error.includes('Success') ? 'text-green-600' : 'text-red-600'}`}>
                  {error}
                </p>
              )}
            </div>
          </div>

          {/* Current Members Section */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Current Members</h3>
            {loading ? (
              <p className="text-gray-500">Loading members...</p>
            ) : (
              <div className="space-y-2">
                {members.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{member.travelerName}</div>
                      {member.email && (
                        <div className="text-sm text-gray-500">{member.email}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role === 'adventurer' && (
                        <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs">
                          Leader
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}