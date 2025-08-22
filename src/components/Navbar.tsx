'use client'

import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function Navbar() {
  const router = useRouter()
  const handleLogout = async () => {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (!error) {
        router.push('/login')
        router.refresh()
      } else {
        console.error('Logout failed:', error.message)
      }
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  return (
    <nav className="fixed top-0 w-full bg-white z-50 border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">Vacation Planner</h1>
          </div>
          
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}