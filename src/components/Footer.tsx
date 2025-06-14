export default function Footer() {
  return (
    <footer className="relative bg-gray-900 text-gray-300 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-900/20 to-pink-900/20"></div>
      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <h3 className="text-3xl font-bold gradient-text mb-6">Vacation Planner</h3>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Transform your travel dreams into reality with our intuitive planning tools. 
              Create memories that last a lifetime with perfectly organized trips.
            </p>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                <span className="text-white">f</span>
              </div>
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                <span className="text-white">t</span>
              </div>
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                <span className="text-white">in</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 text-lg">Features</h4>
            <ul className="space-y-3">
              <li><a href="#" className="hover:text-teal-400 transition-colors duration-300">Calendar View</a></li>
              <li><a href="#" className="hover:text-teal-400 transition-colors duration-300">Expense Tracking</a></li>
              <li><a href="#" className="hover:text-teal-400 transition-colors duration-300">Packing Lists</a></li>
              <li><a href="#" className="hover:text-teal-400 transition-colors duration-300">Weather Info</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-6 text-lg">Support</h4>
            <ul className="space-y-3">
              <li><a href="#" className="hover:text-teal-400 transition-colors duration-300">Help Center</a></li>
              <li><a href="#" className="hover:text-teal-400 transition-colors duration-300">Contact Us</a></li>
              <li><a href="#" className="hover:text-teal-400 transition-colors duration-300">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-teal-400 transition-colors duration-300">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-12 pt-8 text-center">
          <p className="text-gray-400">&copy; 2024 Vacation Planner. Made with ❤️ for travelers.</p>
        </div>
      </div>
    </footer>
  )
}