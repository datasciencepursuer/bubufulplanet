import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export default function CTA({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 gradient-bg"></div>
      <div className="absolute inset-0 bg-black/20"></div>
      
      <div className="container mx-auto px-4 text-center relative z-10">
        <h2 className="text-5xl font-bold text-white mb-8 animate-pulse-slow">
          Ready to Plan Your Next Adventure?
        </h2>
        <p className="text-2xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed">
          Join thousands of travelers who use Vacation Planner to create unforgettable trips.
          Start planning today - it&apos;s completely free!
        </p>
        <div className="flex gap-6 justify-center flex-wrap">
          <Button 
            size="lg" 
            onClick={onGetStarted}
            className="bg-white text-teal-800 hover:bg-gray-100 hover:scale-105 hover:shadow-2xl gap-2 px-8"
          >
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            className="bg-transparent text-white border-2 border-white hover:bg-white hover:text-teal-800 backdrop-blur-sm"
          >
            Watch Demo
          </Button>
        </div>
        
        <div className="mt-16 flex justify-center gap-8 text-white/80">
          <div>
            <div className="text-4xl font-bold">10K+</div>
            <div className="text-sm">Active Users</div>
          </div>
          <div>
            <div className="text-4xl font-bold">50K+</div>
            <div className="text-sm">Trips Planned</div>
          </div>
          <div>
            <div className="text-4xl font-bold">4.9★</div>
            <div className="text-sm">User Rating</div>
          </div>
        </div>
      </div>
    </div>
  )
}