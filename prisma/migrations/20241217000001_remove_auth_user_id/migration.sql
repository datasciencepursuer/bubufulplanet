-- Remove auth_user_id column from group_members as we're using session-based auth
-- This column was added in the RLS migration but not needed for our implementation

BEGIN;

-- Drop RLS policies that reference auth_user_id (if they exist)
DROP POLICY IF EXISTS "group_members_group_visibility" ON group_members;
DROP POLICY IF EXISTS "group_members_conditional_update" ON group_members;
DROP POLICY IF EXISTS "group_members_adventurer_insert" ON group_members;
DROP POLICY IF EXISTS "group_members_adventurer_delete" ON group_members;
DROP POLICY IF EXISTS "device_sessions_own_access" ON device_sessions;

-- Drop helper functions that use auth_user_id
DROP FUNCTION IF EXISTS is_adventurer_in_group(UUID, UUID);
DROP FUNCTION IF EXISTS has_group_permission(UUID, UUID, TEXT);

-- Remove the auth_user_id column
ALTER TABLE group_members DROP COLUMN IF EXISTS auth_user_id;

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_group_members_auth_user_id;

COMMIT;