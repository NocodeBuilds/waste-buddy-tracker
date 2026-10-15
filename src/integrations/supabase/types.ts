export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          row_id: string | null
          site_id: string | null
          snapshot: Json | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          row_id?: string | null
          site_id?: string | null
          snapshot?: Json | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          row_id?: string | null
          site_id?: string | null
          snapshot?: Json | null
          table_name?: string
        }
        Relationships: []
      }
      disposal_batches: {
        Row: {
          status: "pending" | "approved" | "rejected"
          approved_by: string | null
          approved_at: string | null
          requested_at: string | null
          rejection_reason: string | null
          created_at: string
          disposed_by: string | null
          disposed_date: string
          id: string
          notes: string | null
          site_id: string
        }
        Insert: {
          status?: "pending" | "approved" | "rejected"
          approved_by?: string | null
          approved_at?: string | null
          requested_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          disposed_by?: string | null
          disposed_date: string
          id?: string
          notes?: string | null
          site_id: string
        }
        Update: {
          status?: "pending" | "approved" | "rejected"
          approved_by?: string | null
          approved_at?: string | null
          requested_at?: string | null
          rejection_reason?: string | null
          created_at?: string
          disposed_by?: string | null
          disposed_date?: string
          id?: string
          notes?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disposal_batches_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_access_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          note: string | null
          site_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          site_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          site_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_access_requests_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_locations: {
        Row: {
          code: string
          created_at: string
          id: string
          is_common: boolean
          label: string | null
          site_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_common?: boolean
          label?: string | null
          site_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_common?: boolean
          label?: string | null
          site_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_locations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          location: string | null
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          site_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sites: {
        Row: {
          created_at: string
          id: string
          site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          site_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sites_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_entries: {
        Row: {
          expected_photo_count: number
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string
          created_by: string | null
          disposal_batch_id: string | null
          generated_date: string
          id: string
          location: string | null
          notes: string | null
          piece_count: number | null
          quantity: number | null
          site_id: string
          updated_at: string
          waste_category: Database["public"]["Enums"]["waste_category"]
          waste_type_id: string
          weight_kg: number
        }
        Insert: {
          expected_photo_count?: number
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          created_by?: string | null
          disposal_batch_id?: string | null
          generated_date: string
          id?: string
          location?: string | null
          notes?: string | null
          piece_count?: number | null
          quantity?: number | null
          site_id: string
          updated_at?: string
          waste_category?: Database["public"]["Enums"]["waste_category"]
          waste_type_id: string
          weight_kg?: number
        }
        Update: {
          expected_photo_count?: number
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          created_by?: string | null
          disposal_batch_id?: string | null
          generated_date?: string
          id?: string
          location?: string | null
          notes?: string | null
          piece_count?: number | null
          quantity?: number | null
          site_id?: string
          updated_at?: string
          waste_category?: Database["public"]["Enums"]["waste_category"]
          waste_type_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "waste_entries_disposal_batch_id_fkey"
            columns: ["disposal_batch_id"]
            isOneToOne: false
            referencedRelation: "disposal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_entries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_entry_photos: {
        Row: {
          created_at: string
          id: string
          site_id: string
          storage_path: string
          uploaded_by: string | null
          waste_entry_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          site_id: string
          storage_path: string
          uploaded_by?: string | null
          waste_entry_id: string
        }
        Update: {
          created_at?: string
          id?: string
          site_id?: string
          storage_path?: string
          uploaded_by?: string | null
          waste_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_entry_photos_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_entry_photos_waste_entry_id_fkey"
            columns: ["waste_entry_id"]
            isOneToOne: false
            referencedRelation: "waste_entries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_disposal_request: { Args: { p_id: string; p_site_id: string; p_date: string; p_entry_ids: string[]; p_notes?: string | null }; Returns: string }
      decide_disposal: { Args: { p_batch_id: string; p_site_id: string; p_action: string; p_reason?: string | null }; Returns: undefined }
      manage_site_access: { Args: { p_action: string; p_site_id: string; p_user_id?: string | null; p_role?: "admin" | "manager" | "member"; p_request_id?: string | null; p_note?: string | null }; Returns: undefined }
      admin_exists: { Args: never; Returns: boolean }
      has_site_access: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
      has_site_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _site_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_any_admin: { Args: { _user_id: string }; Returns: boolean }
      is_site_admin_or_manager: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
      user_site_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      activity_type: "breakdown" | "preventive" | "5s" | "others"
      app_role: "admin" | "manager" | "member"
      waste_category: "hazardous" | "non_hazardous" | "e_waste" | "other_wastes"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: ["breakdown", "preventive", "5s", "others"],
      app_role: ["admin", "manager", "member"],
      waste_category: ["hazardous", "non_hazardous", "e_waste", "other_wastes"],
    },
  },
} as const
