import { CheckCircle } from 'lucide-react'

const steps = [
  {
    number: "1",
    title: "Select Your Dates",
    description: "Click and drag on the calendar to choose your vacation dates",
    image: "/api/placeholder/600/400"
  },
  {
    number: "2",
    title: "Create Your Itinerary",
    description: "Add daily activities, events, and appointments with time slots",
    image: "/api/placeholder/600/400"
  },
  {
    number: "3",
    title: "Track Expenses",
    description: "Monitor your budget and categorize expenses as you plan",
    image: "/api/placeholder/600/400"
  },
  {
    number: "4",
    title: "Pack & Prepare",
    description: "Use our packing lists and preparation tools to get ready",
    image: "/api/placeholder/600/400"
  }
]

export default function HowItWorks() {
  return (
    <div className="py-24 bg-white" id="how-it-works">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get started with vacation planning in just a few simple steps
          </p>
        </div>

        <div className="space-y-24">
          {steps.map((step, index) => (
            <div key={index} className={`flex flex-col lg:flex-row items-center gap-12 ${index % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}>
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                    {step.number}
                  </div>
                  <h3 className="text-2xl font-semibold">{step.title}</h3>
                </div>
                <p className="text-lg text-gray-600 mb-6">{step.description}</p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Easy to use interface</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Real-time updates and syncing</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">Accessible from any device</span>
                  </li>
                </ul>
              </div>
              <div className="flex-1">
                <div className="bg-gray-100 rounded-lg h-80 flex items-center justify-center">
                  <span className="text-gray-400">Screenshot placeholder</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}