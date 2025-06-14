import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_USER_ID } from '@/lib/constants'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Test database connection
    const { data, error } = await supabase
      .from('trips')
      .select('count')
      .single()
    
    if (error) {
      return NextResponse.json({
        status: 'error',
        database: false,
        defaultUserId: DEFAULT_USER_ID,
        error: error.message,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      }, { status: 500 })
    }
    
    return NextResponse.json({
      status: 'ok',
      database: true,
      defaultUserId: DEFAULT_USER_ID,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      defaultUserId: DEFAULT_USER_ID,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    }, { status: 500 })
  }
}