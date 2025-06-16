import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'

// Get group members
export async function GET() {
  try {
    const cookieStore = await cookies()
    const groupId = cookieStore.get('vacation-planner-group-id')?.value
    const travelerName = cookieStore.get('vacation-planner-traveler-name')?.value

    if (!groupId || !travelerName) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get group members
    const { data: members, error } = await supabase
      .from('group_members')
      .select('id, traveler_name, role, permissions, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('Error fetching members:', error)
      return NextResponse.json({ error: 'Failed to fetch group members' }, { status: 500 })
    }

    return NextResponse.json({ members })

  } catch (error) {
    console.error('Error in members GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Update member permissions (adventurers only)
export async function PUT(request: NextRequest) {
  try {
    const { memberId, permissions }: { memberId: string; permissions: { read: boolean; create: boolean; modify: boolean } } = await request.json()

    const cookieStore = await cookies()
    const groupId = cookieStore.get('vacation-planner-group-id')?.value
    const travelerName = cookieStore.get('vacation-planner-traveler-name')?.value

    if (!groupId || !travelerName) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Check if current user is an adventurer
    const { data: currentMember } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('traveler_name', travelerName)
      .single()

    if (!currentMember || currentMember.role !== 'adventurer') {
      return NextResponse.json({ error: 'Only group adventurers can update permissions' }, { status: 403 })
    }

    // Update member permissions
    const { error } = await supabase
      .from('group_members')
      .update({ permissions })
      .eq('id', memberId)
      .eq('group_id', groupId) // Ensure we're only updating members in the same group

    if (error) {
      console.error('Error updating permissions:', error)
      return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in members PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Add new member to group (adventurers only)
export async function POST(request: NextRequest) {
  try {
    const { travelerName, role = 'party member' }: { travelerName: string; role?: 'adventurer' | 'party member' } = await request.json()

    const cookieStore = await cookies()
    const groupId = cookieStore.get('vacation-planner-group-id')?.value
    const currentTravelerName = cookieStore.get('vacation-planner-traveler-name')?.value

    if (!groupId || !currentTravelerName) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    if (!travelerName?.trim()) {
      return NextResponse.json({ error: 'Traveler name is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Check if current user is an adventurer
    const { data: currentMember } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('traveler_name', currentTravelerName)
      .single()

    if (!currentMember || currentMember.role !== 'adventurer') {
      return NextResponse.json({ error: 'Only group adventurers can add members' }, { status: 403 })
    }

    // Check if traveler name already exists in group
    const { data: existingMember } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('traveler_name', travelerName.trim())
      .single()

    if (existingMember) {
      return NextResponse.json({ error: 'Traveler name already exists in this group' }, { status: 400 })
    }

    // Add new member
    const { error } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        traveler_name: travelerName.trim(),
        role,
        permissions: role === 'adventurer' 
          ? { read: true, create: true, modify: true }
          : { read: true, create: false, modify: false },
        created_by: currentTravelerName
      })

    if (error) {
      console.error('Error adding member:', error)
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in members POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}