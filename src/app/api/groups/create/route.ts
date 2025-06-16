import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'

interface GroupMember {
  name: string
  role: 'adventurer' | 'party member'
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function POST(request: NextRequest) {
  try {
    const { groupName, members, deviceFingerprint }: { 
      groupName: string; 
      members: GroupMember[];
      deviceFingerprint?: string;
    } = await request.json()

    if (!groupName?.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    if (!members?.length || !members[0]?.name?.trim()) {
      return NextResponse.json({ error: 'At least one member is required' }, { status: 400 })
    }

    // Ensure first member is an adventurer
    const validMembers = members.filter(m => m.name.trim())
    if (validMembers[0].role !== 'adventurer') {
      validMembers[0].role = 'adventurer'
    }

    const supabase = createServiceClient()
    
    // Generate unique access code
    let accessCode = generateAccessCode()
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      const { data: existingGroup } = await supabase
        .from('travel_groups')
        .select('id')
        .eq('access_code', accessCode)
        .single()

      if (!existingGroup) break
      
      accessCode = generateAccessCode()
      attempts++
    }

    if (attempts === maxAttempts) {
      return NextResponse.json({ error: 'Unable to generate unique access code' }, { status: 500 })
    }

    // Create the travel group
    const { data: group, error: groupError } = await supabase
      .from('travel_groups')
      .insert({
        name: groupName.trim(),
        access_code: accessCode,
        created_by: null // System-created group
      })
      .select()
      .single()

    if (groupError) {
      console.error('Error creating group:', groupError)
      return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
    }

    // Add group members
    const memberInserts = validMembers.map(member => ({
      group_id: group.id,
      traveler_name: member.name.trim(),
      role: member.role,
      permissions: member.role === 'adventurer' 
        ? { read: true, create: true, modify: true }
        : { read: true, create: false, modify: false }
    }))

    const { data: insertedMembers, error: membersError } = await supabase
      .from('group_members')
      .insert(memberInserts)
      .select('id, traveler_name, role')

    if (membersError || !insertedMembers) {
      console.error('Error adding members:', membersError)
      // Clean up the group if member insertion fails
      await supabase.from('travel_groups').delete().eq('id', group.id)
      return NextResponse.json({ error: 'Failed to add group members' }, { status: 500 })
    }

    // Find the adventurer member ID and update the group's created_by field
    const adventurerMember = insertedMembers.find(member => member.role === 'adventurer')
    if (adventurerMember) {
      await supabase
        .from('travel_groups')
        .update({ created_by: adventurerMember.id })
        .eq('id', group.id)
    }

    // Set session cookies for the group creator (first member)
    const sessionId = `group-${group.id}-${Date.now()}`
    
    const cookieStore = await cookies()
    cookieStore.set('vacation-planner-session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
    
    cookieStore.set('vacation-planner-group-id', group.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
    
    cookieStore.set('vacation-planner-traveler-name', validMembers[0].name.trim(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    // Save device session if fingerprint provided
    if (deviceFingerprint) {
      try {
        const userAgent = request.headers.get('user-agent') || 'unknown'
        const forwardedFor = request.headers.get('x-forwarded-for')
        const realIp = request.headers.get('x-real-ip')
        const ip = forwardedFor?.split(',')[0] || realIp || '127.0.0.1'

        // First, deactivate any existing sessions for this device
        await supabase
          .from('device_sessions')
          .update({ is_active: false })
          .eq('device_fingerprint', deviceFingerprint)
          .eq('is_active', true)

        // Then create/update the session for the current group
        await supabase.rpc('refresh_device_session', {
          p_device_fingerprint: deviceFingerprint,
          p_group_id: group.id,
          p_traveler_name: validMembers[0].name.trim(),
          p_user_agent: userAgent,
          p_ip_address: ip
        })
      } catch (error) {
        // Don't fail the group creation if device session save fails
        console.error('Failed to save device session:', error)
      }
    }

    return NextResponse.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        accessCode: group.access_code
      },
      currentMember: {
        name: validMembers[0].name.trim(),
        role: 'adventurer'
      }
    })

  } catch (error) {
    console.error('Error in group creation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}