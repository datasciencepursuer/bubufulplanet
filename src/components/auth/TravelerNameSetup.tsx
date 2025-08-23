'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { User, MapPin } from 'lucide-react'

interface TravelerNameSetupProps {
  defaultName?: string
  onComplete: (travelerName: string) => Promise<void>
  onSkip?: () => void
}

export default function TravelerNameSetup({ defaultName = '', onComplete, onSkip }: TravelerNameSetupProps) {
  const [travelerName, setTravelerName] = useState(defaultName)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!travelerName.trim()) {
      setError('Please enter a traveler name')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await onComplete(travelerName.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save traveler name')
      setIsLoading(false)
    }
  }

  const handleSkip = () => {
    if (onSkip) {
      onSkip()
    } else {
      // If no skip handler, use the default name
      onComplete(defaultName || 'Traveler')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-cyan-900 to-teal-800 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md mx-auto">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="inline-block p-3 bg-gradient-to-br from-teal-400/20 to-cyan-500/20 rounded-2xl mx-auto">
              <User className="w-12 h-12 text-teal-300" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-teal-300 via-cyan-300 to-teal-200 bg-clip-text text-transparent">
                Welcome Adventurer!
              </CardTitle>
              <CardDescription className="text-teal-200 mt-2">
                Confirm or edit your traveler name for your adventures
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="travelerName" className="text-sm font-medium text-teal-200">
                  Your Traveler Name
                </label>
                <Input
                  id="travelerName"
                  type="text"
                  value={travelerName}
                  onChange={(e) => setTravelerName(e.target.value)}
                  placeholder="Enter your traveler name"
                  className="bg-white/10 border-white/20 text-white placeholder:text-teal-300/60 focus:border-teal-400 focus:ring-teal-400"
                  autoFocus
                  disabled={isLoading}
                />
                <p className="text-xs text-teal-300/70">
                  This is how other group members will see you in the app
                </p>
              </div>
              
              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-3">
                <Button
                  type="submit"
                  disabled={isLoading || !travelerName.trim()}
                  className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-semibold py-3"
                >
                  {isLoading ? 'Setting up...' : 'Continue to Adventure'}
                </Button>
                
                {onSkip && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSkip}
                    disabled={isLoading}
                    className="w-full text-teal-200 hover:text-white hover:bg-white/10"
                  >
                    Skip for now
                  </Button>
                )}
              </div>
            </form>
            
            {/* Features Preview */}
            <div className="pt-6 border-t border-white/20">
              <p className="text-center text-sm text-teal-200 mb-4">Get ready to:</p>
              <div className="grid grid-cols-2 gap-3">
                <FeatureItem icon="🗺️" text="Plan trips" />
                <FeatureItem icon="👥" text="Invite friends" />
                <FeatureItem icon="💰" text="Track expenses" />
                <FeatureItem icon="📍" text="Save locations" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-teal-200">
      <span className="text-lg">{icon}</span>
      <span className="text-sm">{text}</span>
    </div>
  )
}