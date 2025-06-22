'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, X } from 'lucide-react'

interface SuccessMessageProps {
  message: string
  isVisible: boolean
  onClose: () => void
  duration?: number
}

export default function SuccessMessage({ 
  message, 
  isVisible, 
  onClose, 
  duration = 4000 
}: SuccessMessageProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setShow(true)
      const timer = setTimeout(() => {
        setShow(false)
        setTimeout(onClose, 300) // Allow fade out animation
      }, duration)
      
      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  if (!isVisible && !show) return null

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
      show ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
    }`}>
      <div className="bg-green-50 border border-green-200 rounded-lg shadow-lg p-4 max-w-md">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              Success!
            </p>
            <p className="text-sm text-green-700 mt-1">
              {message}
            </p>
          </div>
          <button
            onClick={() => {
              setShow(false)
              setTimeout(onClose, 300)
            }}
            className="text-green-400 hover:text-green-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}