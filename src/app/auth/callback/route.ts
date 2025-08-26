import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin
  const redirectTo = requestUrl.searchParams.get('redirect_to')?.toString()
  const next = requestUrl.searchParams.get('next') ?? '/app'

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && user) {
      try {
        const userEmail = user.email?.toLowerCase()
        const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Traveler'

        // Check for pending invitations by email
        if (userEmail) {
          const pendingInvitations = await prisma.groupMember.findMany({
            where: {
              email: userEmail,
              userId: null // Not yet linked to a user
            }
          })

          // Link all pending invitations to this user
          for (const invitation of pendingInvitations) {
            // Update GroupMember with userId but keep the invited name if it exists
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

        let isFirstTimeUser = false

        if (userGroups.length === 0) {
          // Double-check to prevent race conditions with concurrent requests
          const existingGroups = await prisma.userGroup.findMany({
            where: { userId: user.id }
          })
          
          if (existingGroups.length === 0) {
            isFirstTimeUser = true
            // No groups found, create a default one with temporary name
            const groupName = `${userName}'s Travel Group`
            const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase()
            
            console.log('OAuth callback: Creating new group for first-time user:', user.id, user.email)
            
            const newGroup = await prisma.travelGroup.create({
              data: {
                name: groupName,
                accessCode,
                createdById: user.id,
                groupMembers: {
                  create: {
                    travelerName: userName, // Use OAuth display name, editable in setup
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

            console.log('OAuth callback: Created new group:', newGroup.id, 'for user:', user.id)

            // Create UserGroup entry
            await prisma.userGroup.create({
              data: {
                userId: user.id,
                groupId: newGroup.id,
                role: 'leader'
              }
            })
            
            console.log('OAuth callback: Created UserGroup entry for user:', user.id, 'group:', newGroup.id)
            
            // Update userGroups array to include the newly created group
            userGroups.push({
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
            })
          } else {
            console.log('OAuth callback: Groups found in race condition check, skipping creation')
            // Re-fetch userGroups to include existing groups
            const refreshedGroups = await prisma.userGroup.findMany({
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
            userGroups.push(...refreshedGroups)
          }
        }
        
        // Redirect first-time users to setup
        if (isFirstTimeUser) {
          console.log('OAuth callback: Redirecting first-time user to setup')
          return NextResponse.redirect(`${origin}/setup`)
        }
        
        // If user has multiple groups, redirect to group selection
        if (userGroups.length > 1) {
          console.log('OAuth callback: Redirecting to group selection, user has', userGroups.length, 'groups')
          return NextResponse.redirect(`${origin}/groups`)
        }
        
        // Single group user, redirect to app
        console.log('OAuth callback: Redirecting single-group user to app')
      } catch (dbError) {
        console.error('Error processing user groups:', dbError)
        // Continue with redirect even if group operations fail
      }
    }

    if (!error) {
      // Successful authentication
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error occurred
  return NextResponse.redirect(`${origin}/login?message=Could not authenticate user`)
}