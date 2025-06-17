import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test database connection using Prisma
    await prisma.$queryRaw`SELECT 1`
    
    return NextResponse.json({
      status: 'ok',
      database: true,
      orm: 'Prisma',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      database: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      orm: 'Prisma',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}