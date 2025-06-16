'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check, AlertCircle } from 'lucide-react'

interface AccessCodeConfirmationProps {
  groupName: string
  accessCode: string
  adventurerName: string
  onContinue: () => void
  className?: string
}

export function AccessCodeConfirmation({
  groupName,
  accessCode,
  adventurerName,
  onContinue,
  className = ''
}: AccessCodeConfirmationProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(accessCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = accessCode
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-green-900 flex items-center justify-center gap-2">
            <Check className="w-6 h-6" />
            Group Created Successfully!
          </CardTitle>
          <CardDescription className="text-green-700">
            Your travel group &quot;{groupName}&quot; has been created
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-green-900">Your Group Access Code</h3>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="group relative bg-white border-2 border-green-300 rounded-lg px-6 py-4 hover:border-green-400 hover:bg-green-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-mono font-bold text-green-900 tracking-wider">
                      {accessCode}
                    </span>
                    {copied ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5 text-green-600 group-hover:text-green-700" />
                    )}
                  </div>
                  {copied && (
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-800 text-white text-xs px-2 py-1 rounded">
                      Copied!
                    </div>
                  )}
                </button>
              </div>
              <p className="text-sm text-green-700">
                Click the code above to copy it to your clipboard
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <h4 className="font-semibold text-amber-900">Important: Save This Access Code</h4>
                <div className="text-sm text-amber-800 space-y-1">
                  <p>• Share this code with other travelers to let them join your group</p>
                  <p>• Keep this code safe - you&apos;ll need it to log back in later</p>
                  <p>• Anyone with this code can join your travel group</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-blue-900">Group Details</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Group Name:</strong> {groupName}</p>
                <p><strong>Group Adventurer:</strong> {adventurerName}</p>
                <p><strong>Access Code:</strong> <span className="font-mono">{accessCode}</span></p>
              </div>
            </div>
          </div>

          <Button
            onClick={onContinue}
            className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800"
            size="lg"
          >
            Continue to Your Group
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}