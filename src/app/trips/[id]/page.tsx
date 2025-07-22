import TripDetailClient from './TripDetailClient'
import { fetchTripDataServerSide } from '@/lib/server-data'
import { redirect } from 'next/navigation'

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  try {
    // Prefetch all trip data on the server using Prisma directly
    const initialData = await fetchTripDataServerSide(id)
    
    return (
      <TripDetailClient 
        tripId={id}
        initialData={initialData}
      />
    )
  } catch (error) {
    console.error('Error fetching trip data:', error)
    // Redirect to trips list if trip not found or unauthorized
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      redirect('/auth')
    } else {
      redirect('/trips')
    }
  }
}