import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { groupId } = params
    const body = await request.json()
    const { emails } = body // Array of email addresses

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'Email addresses required' }, { status: 400 })
    }

    // Check if user is leader of the group
    const userGroup = await prisma.userGroup.findUnique({
      where: {
        unique_user_group: {
          userId: user.id,
          groupId
        }
      }
    })

    if (!userGroup || userGroup.role !== 'leader') {
      return NextResponse.json({ error: 'Only group leaders can invite members' }, { status: 403 })
    }

    // Get the group details
    const group = await prisma.travelGroup.findUnique({
      where: { id: groupId }
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const inviteResults = []

    for (const email of emails) {
      try {
        // Check if email is already in group
        const existingMember = await prisma.groupMember.findFirst({
          where: { 
            groupId,
            email: email.toLowerCase()
          }
        })

        if (existingMember) {
          inviteResults.push({
            email,
            status: 'already_member',
            message: 'User is already a member of this group'
          })
          continue
        }

        // Create or update GroupMember with email
        const member = await prisma.groupMember.create({
          data: {
            groupId,
            email: email.toLowerCase(),
            travelerName: email.split('@')[0], // Default name from email
            role: 'party member',
            permissions: {
              read: true,
              create: true,
              modify: false
            }
          }
        })

        // Check if this email has a Supabase account
        const { data: userData } = await supabase.auth.admin.getUserByEmail(email)
        
        if (userData?.user) {
          // User exists, create UserGroup entry
          const existingUserGroup = await prisma.userGroup.findUnique({
            where: {
              unique_user_group: {
                userId: userData.user.id,
                groupId
              }
            }
          })

          if (!existingUserGroup) {
            await prisma.userGroup.create({
              data: {
                userId: userData.user.id,
                groupId,
                role: 'member',
                invitedBy: user.id
              }
            })

            // Update GroupMember with userId
            await prisma.groupMember.update({
              where: { id: member.id },
              data: { userId: userData.user.id }
            })
          }

          inviteResults.push({
            email,
            status: 'invited_existing_user',
            message: 'User added to group'
          })
        } else {
          // User doesn't exist yet, they'll be linked when they sign up
          inviteResults.push({
            email,
            status: 'invited_new_user',
            message: 'Invitation sent. User will be added when they sign up.'
          })
        }
      } catch (error) {
        console.error(`Error inviting ${email}:`, error)
        inviteResults.push({
          email,
          status: 'error',
          message: 'Failed to send invitation'
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      results: inviteResults,
      group: {
        id: group.id,
        name: group.name,
        accessCode: group.accessCode
      }
    })
  } catch (error) {
    console.error('Error inviting users:', error)
    return NextResponse.json({ error: 'Failed to invite users' }, { status: 500 })
  }
}