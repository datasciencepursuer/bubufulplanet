import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, DollarSign, Package, Cloud, Clock, Shield } from 'lucide-react'

const features = [
  {
    icon: Calendar,
    title: "Interactive Calendar",
    description: "Visualize your entire trip at a glance with our intuitive calendar interface"
  },
  {
    icon: DollarSign,
    title: "Expense Tracking",
    description: "Monitor your budget in real-time and split costs with travel companions"
  },
  {
    icon: Package,
    title: "Packing Lists",
    description: "Create customizable packing lists and never forget essentials again"
  },
  {
    icon: Cloud,
    title: "Weather Integration",
    description: "Get accurate weather forecasts for your destination and plan accordingly"
  },
  {
    icon: Clock,
    title: "Time Management",
    description: "Schedule activities with time slots and avoid overbooking your days"
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your travel data is encrypted and secure with enterprise-grade protection"
  }
]

export default function Features() {
  return (
    <div className="py-32 bg-gradient-to-b from-white to-teal-50" id="features">
      <div className="container mx-auto px-4">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-bold mb-6">
            <span className="gradient-text">Powerful Features</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Everything you need to create the perfect travel experience, all in one beautiful platform
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="group relative overflow-hidden border-0 bg-white/80">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <CardHeader className="relative">
                <div className="w-14 h-14 gradient-bg rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="relative">
                <CardDescription className="text-base text-gray-600 leading-relaxed">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}