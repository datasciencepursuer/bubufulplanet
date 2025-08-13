import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, userName } = body

    if (!userId || !userName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify the user is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has a group
    const existingGroup = await prisma.travelGroup.findFirst({
      where: { createdById: userId }
    })

    if (existingGroup) {
      return NextResponse.json({ group: existingGroup })
    }

    // Generate a unique access code
    const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase()
    
    // Create new travel group for the user
    const group = await prisma.travelGroup.create({
      data: {
        name: `${userName}'s Travel Group`,
        accessCode,
        createdById: userId,
        groupMembers: {
          create: {
            travelerName: userName,
            role: 'adventurer',
            permissions: {
              read: true,
              create: true,
              modify: true
            }
          }
        }
      },
      include: {
        groupMembers: true
      }
    })

    return NextResponse.json({ group })
  } catch (error) {
    console.error('Error creating group for user:', error)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
}