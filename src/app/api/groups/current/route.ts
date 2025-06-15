import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'

// Get current user's group information
export async function GET() {
  try {
    const cookieStore = await cookies()
    const groupId = cookieStore.get('vacation-planner-group-id')?.value
    const travelerName = cookieStore.get('vacation-planner-traveler-name')?.value

    if (!groupId || !travelerName) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get group details
    const { data: group, error: groupError } = await supabase
      .from('travel_groups')
      .select('id, name, access_code, created_at')
      .eq('id', groupId)
      .single()

    if (groupError || !group) {
      console.error('Error fetching group:', groupError)
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Get current user's member info
    const { data: member, error: memberError } = await supabase
      .from('group_members')
      .select('id, traveler_name, role, permissions, joined_at')
      .eq('group_id', groupId)
      .eq('traveler_name', travelerName)
      .single()

    if (memberError || !member) {
      console.error('Error fetching member:', memberError)
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Get all group members
    const { data: allMembers, error: allMembersError } = await supabase
      .from('group_members')
      .select('id, traveler_name, role, permissions, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true })

    if (allMembersError) {
      console.error('Error fetching all members:', allMembersError)
      return NextResponse.json({ error: 'Failed to fetch group members' }, { status: 500 })
    }

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        accessCode: group.access_code,
        createdAt: group.created_at
      },
      currentMember: {
        id: member.id,
        name: member.traveler_name,
        role: member.role,
        permissions: member.permissions,
        joinedAt: member.joined_at
      },
      allMembers: allMembers || []
    })

  } catch (error) {
    console.error('Error in current group GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}