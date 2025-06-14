import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  try {
    // Fetch trip days without user filtering
    const { data: tripDays, error } = await supabase
      .from('trip_days')
      .select('*')
      .eq('trip_id', id)
      .order('day_number')

    if (error) {
      console.error('Error fetching trip days:', error)
      return NextResponse.json({ error: 'Failed to fetch trip days' }, { status: 500 })
    }

    return NextResponse.json({ tripDays })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}