'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Edit2, Check, X } from 'lucide-react'

interface TravelerNameEditorProps {
  currentName: string
  onNameUpdate: (newName: string) => Promise<void>
  className?: string
}

export default function TravelerNameEditor({ currentName, onNameUpdate, className = '' }: TravelerNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(currentName)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStartEdit = () => {
    setIsEditing(true)
    setEditValue(currentName)
    setError('')
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue(currentName)
    setError('')
  }

  const handleSave = async () => {
    if (!editValue.trim()) {
      setError('Name cannot be empty')
      return
    }

    if (editValue.trim() === currentName) {
      setIsEditing(false)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await onNameUpdate(editValue.trim())
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update name')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter traveler name"
            className="flex-1"
            autoFocus
            disabled={isLoading}
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading || !editValue.trim()}
            className="gap-1"
          >
            <Check className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="gap-1"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="font-medium">{currentName}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleStartEdit}
        className="gap-1 h-6 px-2 text-gray-500 hover:text-gray-700"
        title="Edit traveler name"
      >
        <Edit2 className="w-3 h-3" />
      </Button>
    </div>
  )
}