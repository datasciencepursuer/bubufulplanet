import { Button } from '@/components/ui/button'
import { ArrowRight, Plane, Map, Users } from 'lucide-react'

export default function Hero({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="relative overflow-hidden gradient-bg-light min-h-screen flex items-center">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float" style={{ animationDelay: '4s' }}></div>
      </div>
      
      <div className="container mx-auto px-4 py-24 sm:py-32 relative z-10">
        <div className="text-center">
          <h1 className="text-6xl sm:text-7xl font-extrabold mb-6">
            <span className="text-gray-900">Plan Your Perfect</span>
            <br />
            <span className="gradient-text">Vacation</span>
          </h1>
          <p className="text-xl text-gray-700 mb-10 max-w-3xl mx-auto leading-relaxed">
            Transform your travel dreams into reality with our intuitive planning tools. 
            Create detailed itineraries, track expenses, and collaborate with your travel companions.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={onGetStarted} className="gap-2 shadow-glow">
              Start Planning <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" className="backdrop-blur-md">
              Watch Demo
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32">
          <div className="text-center group">
            <div className="w-20 h-20 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-6 transform group-hover:scale-110 transition-transform duration-300 shadow-lg">
              <Map className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">Detailed Itineraries</h3>
            <p className="text-gray-600 leading-relaxed">Plan each day with precision. Add events, activities, and manage your time effortlessly</p>
          </div>
          <div className="text-center group">
            <div className="w-20 h-20 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-6 transform group-hover:scale-110 transition-transform duration-300 shadow-lg">
              <Plane className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">Smart Organization</h3>
            <p className="text-gray-600 leading-relaxed">Keep all your travel details in one place. Never lose track of important information</p>
          </div>
          <div className="text-center group">
            <div className="w-20 h-20 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-6 transform group-hover:scale-110 transition-transform duration-300 shadow-lg">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">Real-time Collaboration</h3>
            <p className="text-gray-600 leading-relaxed">Plan together seamlessly. Share updates instantly with your travel companions</p>
          </div>
        </div>
      </div>
    </div>
  )
}