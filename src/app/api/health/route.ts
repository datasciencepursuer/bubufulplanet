import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test database connection using Prisma
    const tripsCount = await prisma.trip.count()
    
    return NextResponse.json({
      status: 'ok',
      database: true,
      tripsCount,
      orm: 'Prisma',
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      database: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      orm: 'Prisma',
    }, { status: 500 })
  }
}