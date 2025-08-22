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
          where: { userId: user.id }
        })

        let isFirstTimeUser = false

        if (userGroups.length === 0) {
          isFirstTimeUser = true
          // No groups found, create a default one with temporary name
          const groupName = `${userName}'s Travel Group`
          const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase()
          
          const newGroup = await prisma.travelGroup.create({
            data: {
              name: groupName,
              accessCode,
              createdById: user.id,
              groupMembers: {
                create: {
                  travelerName: 'New Traveler', // Temporary name that will be updated in setup
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

          // Create UserGroup entry
          await prisma.userGroup.create({
            data: {
              userId: user.id,
              groupId: newGroup.id,
              role: 'leader'
            }
          })
        }
        
        // Redirect first-time users to setup
        if (isFirstTimeUser) {
          return NextResponse.redirect(`${origin}/setup`)
        }
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