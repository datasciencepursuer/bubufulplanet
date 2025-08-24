import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = user.email?.toLowerCase()
    const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Traveler'

    // Check for pending invitations by email first
    if (userEmail) {
      const pendingInvitations = await prisma.groupMember.findMany({
        where: {
          email: userEmail,
          userId: null // Not yet linked to a user
        }
      })

      // Link all pending invitations to this user
      for (const invitation of pendingInvitations) {
        const updatedTravelerName = invitation.travelerName !== invitation.email?.split('@')[0] 
          ? invitation.travelerName  // Keep custom name if it was provided
          : userName // Use OAuth name if only default email-based name was used

        await prisma.groupMember.update({
          where: { id: invitation.id },
          data: { 
            userId: user.id,
            travelerName: updatedTravelerName
          }
        })

        // Create UserGroup entry
        await prisma.userGroup.upsert({
          where: {
            unique_user_group: {
              userId: user.id,
              groupId: invitation.groupId
            }
          },
          update: {},
          create: {
            userId: user.id,
            groupId: invitation.groupId,
            role: invitation.role === 'adventurer' ? 'leader' : 'member'
          }
        })
      }
    }

    // Check if user has any groups (including newly linked ones)
    const userGroups = await prisma.userGroup.findMany({
      where: { userId: user.id },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            accessCode: true
          }
        }
      }
    })

    // At this point, all users (OAuth and email) should have groups
    // OAuth users get groups from callback, email users get groups from setup-check
    if (userGroups.length === 0) {
      console.log('Setup API: No groups found - this should not happen after auth flow. User needs re-authentication.')
      return NextResponse.json({ 
        success: false,
        error: 'Authentication incomplete - please sign in again',
        redirect: '/login'
      })
    }

    return NextResponse.json({ 
      success: true, 
      needsSetup: false, // All users have groups at this point
      groupCount: userGroups.length,
      redirect: userGroups.length > 1 ? '/groups' : '/app'
    })

  } catch (error) {
    console.error('Error setting up new user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}