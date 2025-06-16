export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      trips: {
        Row: {
          id: string
          name: string
          start_date: string
          end_date: string
          destination: string | null
          created_at: string
          updated_at: string
          user_id: string
          group_id: string | null
        }
        Insert: {
          id?: string
          name: string
          start_date: string
          end_date: string
          destination?: string | null
          created_at?: string
          updated_at?: string
          user_id: string
          group_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          start_date?: string
          end_date?: string
          destination?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string
          group_id?: string | null
        }
      }
      trip_days: {
        Row: {
          id: string
          trip_id: string
          day_number: number
          date: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          day_number: number
          date: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          day_number?: number
          date?: string
          notes?: string | null
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          day_id: string
          title: string
          start_time: string
          end_time: string | null
          start_date: string
          end_date: string | null
          location: string | null
          notes: string | null
          weather: string | null
          loadout: string | null
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          day_id: string
          title: string
          start_time: string
          end_time?: string | null
          start_date: string
          end_date?: string | null
          location?: string | null
          notes?: string | null
          weather?: string | null
          loadout?: string | null
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          day_id?: string
          title?: string
          start_time?: string
          end_time?: string | null
          start_date?: string
          end_date?: string | null
          location?: string | null
          notes?: string | null
          weather?: string | null
          loadout?: string | null
          color?: string
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          event_id: string | null
          day_id: string
          description: string
          amount: number
          category: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id?: string | null
          day_id: string
          description: string
          amount: number
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string | null
          day_id?: string
          description?: string
          amount?: number
          category?: string | null
          created_at?: string
        }
      }
      packing_items: {
        Row: {
          id: string
          trip_id: string
          item_name: string
          quantity: number
          packed: boolean
          category: string | null
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          item_name: string
          quantity?: number
          packed?: boolean
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          item_name?: string
          quantity?: number
          packed?: boolean
          category?: string | null
          created_at?: string
        }
      }
      travel_groups: {
        Row: {
          id: string
          name: string
          access_code: string
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          access_code: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          access_code?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      device_sessions: {
        Row: {
          id: string
          device_fingerprint: string
          group_id: string
          traveler_name: string
          session_data: Json | null
          user_agent: string | null
          ip_address: string | null
          is_active: boolean
          last_used: string
          created_at: string
        }
        Insert: {
          id?: string
          device_fingerprint: string
          group_id: string
          traveler_name: string
          session_data?: Json | null
          user_agent?: string | null
          ip_address?: string | null
          is_active?: boolean
          last_used?: string
          created_at?: string
        }
        Update: {
          id?: string
          device_fingerprint?: string
          group_id?: string
          traveler_name?: string
          session_data?: Json | null
          user_agent?: string | null
          ip_address?: string | null
          is_active?: boolean
          last_used?: string
          created_at?: string
        }
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          traveler_name: string
          role: string
          permissions: Json
          joined_at: string
          created_by: string | null
          auth_user_id: string | null
        }
        Insert: {
          id?: string
          group_id: string
          traveler_name: string
          role?: string
          permissions?: Json
          joined_at?: string
          created_by?: string | null
          auth_user_id?: string | null
        }
        Update: {
          id?: string
          group_id?: string
          traveler_name?: string
          role?: string
          permissions?: Json
          joined_at?: string
          created_by?: string | null
          auth_user_id?: string | null
        }
      }
    }
  }
}