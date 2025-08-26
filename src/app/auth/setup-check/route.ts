import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin

  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      console.log('Setup check: No authenticated user, redirecting to login')
      return NextResponse.redirect(`${origin}/login`)
    }

    const userEmail = user.email?.toLowerCase()
    const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Traveler'

    console.log('Setup check: Processing user:', user.id, user.email, 'Provider:', user.app_metadata?.provider)

    // Check for pending invitations by email first (same as OAuth callback)
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
          : userName // Use user name if only default email-based name was used

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
    let userGroups = await prisma.userGroup.findMany({
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

    let isFirstTimeUser = false

    if (userGroups.length === 0) {
      // Double-check to prevent race conditions with concurrent requests
      const existingGroups = await prisma.userGroup.findMany({
        where: { userId: user.id }
      })
      
      if (existingGroups.length === 0) {
        isFirstTimeUser = true
        console.log('Setup check: Creating new group for first-time user:', user.id, user.email)
        
        // Create a default group for the user
        const groupName = `${userName}'s Travel Group`
        const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase()
        
        const newGroup = await prisma.travelGroup.create({
          data: {
            name: groupName,
            accessCode,
            createdById: user.id,
            groupMembers: {
              create: {
                travelerName: userName,
                email: userEmail,
                userId: user.id,
                role: 'adventurer',
                permissions: {
                  read: true,
                  create: true,
                  modify: true
                }
              }
            }
          }
        })

        console.log('Setup check: Created new group:', newGroup.id, 'for user:', user.id)

        // Create UserGroup entry
        await prisma.userGroup.create({
          data: {
            userId: user.id,
            groupId: newGroup.id,
            role: 'leader'
          }
        })
        
        console.log('Setup check: Created UserGroup entry for user:', user.id, 'group:', newGroup.id)
        
        // Update userGroups array to include the newly created group
        userGroups = [{
          id: '', // Not used in redirect logic
          userId: user.id,
          groupId: newGroup.id,
          role: 'leader',
          joinedAt: new Date(),
          lastActiveAt: new Date(),
          lastActiveTripId: null,
          invitedBy: null,
          group: {
            id: newGroup.id,
            name: groupName,
            accessCode
          }
        }]
      } else {
        console.log('Setup check: Groups found in race condition check, using existing groups')
        userGroups = await prisma.userGroup.findMany({
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
      }
    }
    
    // Redirect first-time users to setup (same as OAuth)
    if (isFirstTimeUser) {
      console.log('Setup check: Redirecting first-time user to setup')
      return NextResponse.redirect(`${origin}/setup`)
    }
    
    // If user has multiple groups, redirect to group selection (same as OAuth)
    if (userGroups.length > 1) {
      console.log('Setup check: Redirecting to group selection, user has', userGroups.length, 'groups')
      return NextResponse.redirect(`${origin}/groups`)
    }
    
    // Single group user, redirect to app (same as OAuth)
    console.log('Setup check: Redirecting single-group user to app')
    return NextResponse.redirect(`${origin}/app`)

  } catch (error) {
    console.error('Error in setup check:', error)
    return NextResponse.redirect(`${origin}/login?message=Setup check failed`)
  }
}