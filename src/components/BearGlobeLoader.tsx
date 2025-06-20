'use client'

export default function BearGlobeLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {/* Bear and Globe Container */}
        <div className="relative inline-block mb-8">
          {/* Globe */}
          <div className="relative">
            <svg
              className="w-32 h-32 animate-spin-slow"
              viewBox="0 0 128 128"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Globe Circle */}
              <circle cx="64" cy="64" r="60" fill="#3B82F6" opacity="0.9"/>
              {/* Continents simplified */}
              <path
                d="M40 50c5-3 15-5 20 0s5 15 0 20s-15 5-20 0s-5-15 0-20z"
                fill="#10B981"
                opacity="0.8"
              />
              <path
                d="M70 40c3-2 9-3 12 0s3 9 0 12s-9 3-12 0s-3-9 0-12z"
                fill="#10B981"
                opacity="0.8"
              />
              <path
                d="M85 65c4-2 12-4 16 0s4 12 0 16s-12 4-16 0s-4-12 0-16z"
                fill="#10B981"
                opacity="0.8"
              />
              {/* Globe lines */}
              <ellipse cx="64" cy="64" rx="60" ry="20" fill="none" stroke="white" strokeWidth="1" opacity="0.3"/>
              <ellipse cx="64" cy="64" rx="60" ry="40" fill="none" stroke="white" strokeWidth="1" opacity="0.3"/>
              <ellipse cx="64" cy="64" rx="20" ry="60" fill="none" stroke="white" strokeWidth="1" opacity="0.3"/>
              <ellipse cx="64" cy="64" rx="40" ry="60" fill="none" stroke="white" strokeWidth="1" opacity="0.3"/>
            </svg>
          </div>
          
          {/* Bear pushing the globe */}
          <div className="absolute -left-16 top-1/2 -translate-y-1/2 animate-push">
            <svg
              className="w-24 h-24"
              viewBox="0 0 96 96"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Bear Body */}
              <ellipse cx="48" cy="60" rx="25" ry="30" fill="white"/>
              {/* Bear Head */}
              <circle cx="48" cy="35" r="20" fill="white"/>
              {/* Bear Ears - Outer black */}
              <circle cx="35" cy="25" r="8" fill="black"/>
              <circle cx="61" cy="25" r="8" fill="black"/>
              {/* Bear Ears - Inner pink */}
              <circle cx="35" cy="25" r="5" fill="#FFC0CB"/>
              <circle cx="61" cy="25" r="5" fill="#FFC0CB"/>
              {/* Bear Face */}
              <circle cx="42" cy="35" r="2" fill="black"/>
              <circle cx="54" cy="35" r="2" fill="black"/>
              <ellipse cx="48" cy="40" rx="5" ry="4" fill="#F5F5F5"/>
              <circle cx="48" cy="39" r="2" fill="black"/>
              {/* Bear Arms pushing */}
              <ellipse cx="65" cy="55" rx="8" ry="15" fill="white" transform="rotate(45 65 55)"/>
              <ellipse cx="65" cy="45" rx="8" ry="15" fill="white" transform="rotate(-45 65 45)"/>
              {/* Bear Legs */}
              <ellipse cx="40" cy="80" rx="10" ry="15" fill="white"/>
              <ellipse cx="56" cy="80" rx="10" ry="15" fill="white"/>
              {/* Bear outline for better visibility */}
              <ellipse cx="48" cy="60" rx="25" ry="30" fill="none" stroke="#E5E5E5" strokeWidth="1"/>
              <circle cx="48" cy="35" r="20" fill="none" stroke="#E5E5E5" strokeWidth="1"/>
              {/* Bear effort lines */}
              <path d="M20 35 L25 35" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" className="animate-pulse"/>
              <path d="M20 40 L27 40" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" className="animate-pulse" style={{animationDelay: '0.2s'}}/>
              <path d="M20 45 L25 45" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" className="animate-pulse" style={{animationDelay: '0.4s'}}/>
            </svg>
          </div>
        </div>
        
        {/* Loading Text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-800">Loading Your Adventure</h2>
          <p className="text-gray-600 animate-pulse">Bear with us while we prepare your trip...</p>
        </div>
        
        {/* Progress dots */}
        <div className="flex justify-center space-x-2 mt-6">
          <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
          <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
        </div>
      </div>
    </div>
  )
}