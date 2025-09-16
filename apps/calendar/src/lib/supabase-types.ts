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
          persona_name: string
          properties_ext: Json | null
          temperature: number | null
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
          persona_name: string
          properties_ext?: Json | null
          temperature?: number | null
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
          persona_name?: string
          properties_ext?: Json | null
          temperature?: number | null
          traits?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_user_roles: {
        Row: {
          attendance_type: Database["public"]["Enums"]["attendance_type"] | null
          created_at: string | null
          event_id: string
          following: boolean | null
          id: string
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
          id?: string
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
          id?: string
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
          agenda: string | null
          all_day: boolean | null
          allow_forwarding: boolean | null
          created_at: string | null
          creator: string | null
          duration: number
          hide_attendees: boolean | null
          history: Json | null
          id: string
          in_person: boolean | null
          online_chat_link: string | null
          online_event: boolean | null
          online_join_link: string | null
          owner: string
          private: boolean | null
          request_responses: boolean | null
          series_id: string | null
          start_time: string
          title: string
          updated_at: string | null
        }
        Insert: {
          agenda?: string | null
          all_day?: boolean | null
          allow_forwarding?: boolean | null
          created_at?: string | null
          creator?: string | null
          duration: number
          hide_attendees?: boolean | null
          history?: Json | null
          id?: string
          in_person?: boolean | null
          online_chat_link?: string | null
          online_event?: boolean | null
          online_join_link?: string | null
          owner: string
          private?: boolean | null
          request_responses?: boolean | null
          series_id?: string | null
          start_time: string
          title: string
          updated_at?: string | null
        }
        Update: {
          agenda?: string | null
          all_day?: boolean | null
          allow_forwarding?: boolean | null
          created_at?: string | null
          creator?: string | null
          duration?: number
          hide_attendees?: boolean | null
          history?: Json | null
          id?: string
          in_person?: boolean | null
          online_chat_link?: string | null
          online_event?: boolean | null
          online_join_link?: string | null
          owner?: string
          private?: boolean | null
          request_responses?: boolean | null
          series_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_event_categories: {
        Row: {
          color: Database["public"]["Enums"]["event_category"] | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: Database["public"]["Enums"]["event_category"] | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: Database["public"]["Enums"]["event_category"] | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_event_options: {
        Row: {
          ai_instructions: string | null
          ai_managed: boolean | null
          category: string | null
          created_at: string | null
          event_id: string
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
          category?: string | null
          created_at?: string | null
          event_id: string
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
          category?: string | null
          created_at?: string | null
          event_id?: string
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
            foreignKeyName: "user_event_options_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "user_event_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_event_options_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      generate_slug: {
        Args: { input_text: string }
        Returns: string
      }
    }
    Enums: {
      attendance_type: "in_person" | "virtual"
      event_category:
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
      event_category: [
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

