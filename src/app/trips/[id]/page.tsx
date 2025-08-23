import TripDetailClient from './TripDetailClient'
import { fetchTripDataServerSide } from '@/lib/server-data'
import { redirect } from 'next/navigation'

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  try {
    // Prefetch all trip data on the server using Prisma directly
    // Note: This uses the user's first group, which might not be the current group
    // The client component will handle group context and reload if needed
    const initialData = await fetchTripDataServerSide(id)
    
    return (
      <TripDetailClient 
        tripId={id}
        initialData={initialData}
      />
    )
  } catch (error) {
    console.error('Error fetching trip data:', error)
    // If server-side fails, let client handle it (might be wrong group context)
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      redirect('/auth')
    } else {
      // Don't redirect for "Trip not found" - let client try with correct group context
      return (
        <TripDetailClient 
          tripId={id}
        />
      )
    }
  }
}