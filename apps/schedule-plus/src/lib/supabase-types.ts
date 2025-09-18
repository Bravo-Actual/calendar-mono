export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_personas: {
        Row: {
          avatar_url: string | null
          created_at: string
          greeting: string | null
          id: string
          instructions: string | null
          is_default: boolean | null
          model_id: string | null
          name: string
          properties_ext: Json | null
          temperature: number | null
          top_p: number | null
          traits: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          greeting?: string | null
          id?: string
          instructions?: string | null
          is_default?: boolean | null
          model_id?: string | null
          name: string
          properties_ext?: Json | null
          temperature?: number | null
          top_p?: number | null
          traits?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          greeting?: string | null
          id?: string
          instructions?: string | null
          is_default?: boolean | null
          model_id?: string | null
          name?: string
          properties_ext?: Json | null
          temperature?: number | null
          top_p?: number | null
          traits?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_details: {
        Row: {
          agenda: string | null
          created_at: string | null
          id: string
          in_person: boolean | null
          online_chat_link: string | null
          online_event: boolean | null
          online_join_link: string | null
          owner_id: string
          request_responses: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agenda?: string | null
          created_at?: string | null
          id: string
          in_person?: boolean | null
          online_chat_link?: string | null
          online_event?: boolean | null
          online_join_link?: string | null
          owner_id: string
          request_responses?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agenda?: string | null
          created_at?: string | null
          id?: string
          in_person?: boolean | null
          online_chat_link?: string | null
          online_event?: boolean | null
          online_join_link?: string | null
          owner_id?: string
          request_responses?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_details_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_details_personal: {
        Row: {
          ai_instructions: string | null
          ai_managed: boolean | null
          calendar_id: string | null
          category_id: string | null
          created_at: string | null
          id: string
          show_time_as:
            | Database["public"]["Enums"]["show_time_as_extended"]
            | null
          time_defense_level:
            | Database["public"]["Enums"]["time_defense_level"]
            | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_instructions?: string | null
          ai_managed?: boolean | null
          calendar_id?: string | null
          category_id?: string | null
          created_at?: string | null
          id: string
          show_time_as?:
            | Database["public"]["Enums"]["show_time_as_extended"]
            | null
          time_defense_level?:
            | Database["public"]["Enums"]["time_defense_level"]
            | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_instructions?: string | null
          ai_managed?: boolean | null
          calendar_id?: string | null
          category_id?: string | null
          created_at?: string | null
          id?: string
          show_time_as?:
            | Database["public"]["Enums"]["show_time_as_extended"]
            | null
          time_defense_level?:
            | Database["public"]["Enums"]["time_defense_level"]
            | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_details_personal_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_details_personal_calendar"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "user_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_details_personal_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "user_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      event_user_roles: {
        Row: {
          attendance_type: Database["public"]["Enums"]["attendance_type"] | null
          created_at: string | null
          event_id: string
          following: boolean | null
          invite_type: Database["public"]["Enums"]["invite_type"]
          role: Database["public"]["Enums"]["user_role"] | null
          rsvp: Database["public"]["Enums"]["rsvp_status"] | null
          rsvp_timestamp: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendance_type?:
            | Database["public"]["Enums"]["attendance_type"]
            | null
          created_at?: string | null
          event_id: string
          following?: boolean | null
          invite_type: Database["public"]["Enums"]["invite_type"]
          role?: Database["public"]["Enums"]["user_role"] | null
          rsvp?: Database["public"]["Enums"]["rsvp_status"] | null
          rsvp_timestamp?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendance_type?:
            | Database["public"]["Enums"]["attendance_type"]
            | null
          created_at?: string | null
          event_id?: string
          following?: boolean | null
          invite_type?: Database["public"]["Enums"]["invite_type"]
          role?: Database["public"]["Enums"]["user_role"] | null
          rsvp?: Database["public"]["Enums"]["rsvp_status"] | null
          rsvp_timestamp?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_user_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean | null
          allow_forwarding: boolean | null
          allow_reschedule_proposals: boolean | null
          created_at: string | null
          discovery: Database["public"]["Enums"]["event_discovery_types"] | null
          end_time: string
          hide_attendees: boolean | null
          id: string
          is_private: boolean | null
          join_model:
            | Database["public"]["Enums"]["event_join_model_types"]
            | null
          start_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          allow_forwarding?: boolean | null
          allow_reschedule_proposals?: boolean | null
          created_at?: string | null
          discovery?:
            | Database["public"]["Enums"]["event_discovery_types"]
            | null
          end_time: string
          hide_attendees?: boolean | null
          id?: string
          is_private?: boolean | null
          join_model?:
            | Database["public"]["Enums"]["event_join_model_types"]
            | null
          start_time: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          allow_forwarding?: boolean | null
          allow_reschedule_proposals?: boolean | null
          created_at?: string | null
          discovery?:
            | Database["public"]["Enums"]["event_discovery_types"]
            | null
          end_time?: string
          hide_attendees?: boolean | null
          id?: string
          is_private?: boolean | null
          join_model?:
            | Database["public"]["Enums"]["event_join_model_types"]
            | null
          start_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_calendars: {
        Row: {
          color: Database["public"]["Enums"]["event_colors"] | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
          visible: boolean | null
        }
        Insert: {
          color?: Database["public"]["Enums"]["event_colors"] | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
          visible?: boolean | null
        }
        Update: {
          color?: Database["public"]["Enums"]["event_colors"] | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
          visible?: boolean | null
        }
        Relationships: []
      }
      user_categories: {
        Row: {
          color: Database["public"]["Enums"]["event_colors"] | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: Database["public"]["Enums"]["event_colors"] | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: Database["public"]["Enums"]["event_colors"] | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          organization: string | null
          slug: string | null
          timezone: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          organization?: string | null
          slug?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization?: string | null
          slug?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_default_calendar: {
        Args: { user_id_param: string }
        Returns: string
      }
    }
    Enums: {
      attendance_type: "in_person" | "virtual"
      event_colors:
        | "neutral"
        | "slate"
        | "orange"
        | "yellow"
        | "green"
        | "blue"
        | "indigo"
        | "violet"
        | "fuchsia"
        | "rose"
      event_discovery_types: "audience_only" | "tenant_only" | "public"
      event_join_model_types: "invite_only" | "request_to_join" | "open_join"
      invite_type: "required" | "optional"
      rsvp_status: "tentative" | "accepted" | "declined"
      show_time_as_extended:
        | "free"
        | "tentative"
        | "busy"
        | "oof"
        | "working_elsewhere"
      time_defense_level: "flexible" | "normal" | "high" | "hard_block"
      user_role: "viewer" | "contributor" | "owner" | "delegate_full"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attendance_type: ["in_person", "virtual"],
      event_colors: [
        "neutral",
        "slate",
        "orange",
        "yellow",
        "green",
        "blue",
        "indigo",
        "violet",
        "fuchsia",
        "rose",
      ],
      event_discovery_types: ["audience_only", "tenant_only", "public"],
      event_join_model_types: ["invite_only", "request_to_join", "open_join"],
      invite_type: ["required", "optional"],
      rsvp_status: ["tentative", "accepted", "declined"],
      show_time_as_extended: [
        "free",
        "tentative",
        "busy",
        "oof",
        "working_elsewhere",
      ],
      time_defense_level: ["flexible", "normal", "high", "hard_block"],
      user_role: ["viewer", "contributor", "owner", "delegate_full"],
    },
  },
} as const

