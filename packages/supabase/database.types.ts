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
          agent_id: string | null
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
          agent_id?: string | null
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
          agent_id?: string | null
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
      mastra_evals: {
        Row: {
          agent_name: string
          created_at: string
          created_atZ: string | null
          createdAt: string | null
          createdAtZ: string | null
          global_run_id: string
          input: string
          instructions: string
          metric_name: string
          output: string
          result: Json
          run_id: string
          test_info: Json | null
        }
        Insert: {
          agent_name: string
          created_at: string
          created_atZ?: string | null
          createdAt?: string | null
          createdAtZ?: string | null
          global_run_id: string
          input: string
          instructions: string
          metric_name: string
          output: string
          result: Json
          run_id: string
          test_info?: Json | null
        }
        Update: {
          agent_name?: string
          created_at?: string
          created_atZ?: string | null
          createdAt?: string | null
          createdAtZ?: string | null
          global_run_id?: string
          input?: string
          instructions?: string
          metric_name?: string
          output?: string
          result?: Json
          run_id?: string
          test_info?: Json | null
        }
        Relationships: []
      }
      mastra_messages: {
        Row: {
          content: string
          createdAt: string
          createdAtZ: string | null
          id: string
          resourceId: string | null
          role: string
          thread_id: string
          type: string
        }
        Insert: {
          content: string
          createdAt: string
          createdAtZ?: string | null
          id: string
          resourceId?: string | null
          role: string
          thread_id: string
          type: string
        }
        Update: {
          content?: string
          createdAt?: string
          createdAtZ?: string | null
          id?: string
          resourceId?: string | null
          role?: string
          thread_id?: string
          type?: string
        }
        Relationships: []
      }
      mastra_resources: {
        Row: {
          createdAt: string
          createdAtZ: string | null
          id: string
          metadata: Json | null
          updatedAt: string
          updatedAtZ: string | null
          workingMemory: string | null
        }
        Insert: {
          createdAt: string
          createdAtZ?: string | null
          id: string
          metadata?: Json | null
          updatedAt: string
          updatedAtZ?: string | null
          workingMemory?: string | null
        }
        Update: {
          createdAt?: string
          createdAtZ?: string | null
          id?: string
          metadata?: Json | null
          updatedAt?: string
          updatedAtZ?: string | null
          workingMemory?: string | null
        }
        Relationships: []
      }
      mastra_scorers: {
        Row: {
          additionalContext: Json | null
          analyzePrompt: string | null
          analyzeStepResult: Json | null
          createdAt: string
          createdAtZ: string | null
          entity: Json | null
          entityId: string | null
          entityType: string | null
          extractPrompt: string | null
          extractStepResult: Json | null
          generateReasonPrompt: string | null
          generateScorePrompt: string | null
          id: string
          input: Json
          metadata: Json | null
          output: Json
          preprocessPrompt: string | null
          preprocessStepResult: Json | null
          reason: string | null
          reasonPrompt: string | null
          resourceId: string | null
          runId: string
          runtimeContext: Json | null
          score: number
          scorer: Json
          scorerId: string
          source: string
          threadId: string | null
          traceId: string | null
          updatedAt: string
          updatedAtZ: string | null
        }
        Insert: {
          additionalContext?: Json | null
          analyzePrompt?: string | null
          analyzeStepResult?: Json | null
          createdAt: string
          createdAtZ?: string | null
          entity?: Json | null
          entityId?: string | null
          entityType?: string | null
          extractPrompt?: string | null
          extractStepResult?: Json | null
          generateReasonPrompt?: string | null
          generateScorePrompt?: string | null
          id: string
          input: Json
          metadata?: Json | null
          output: Json
          preprocessPrompt?: string | null
          preprocessStepResult?: Json | null
          reason?: string | null
          reasonPrompt?: string | null
          resourceId?: string | null
          runId: string
          runtimeContext?: Json | null
          score: number
          scorer: Json
          scorerId: string
          source: string
          threadId?: string | null
          traceId?: string | null
          updatedAt: string
          updatedAtZ?: string | null
        }
        Update: {
          additionalContext?: Json | null
          analyzePrompt?: string | null
          analyzeStepResult?: Json | null
          createdAt?: string
          createdAtZ?: string | null
          entity?: Json | null
          entityId?: string | null
          entityType?: string | null
          extractPrompt?: string | null
          extractStepResult?: Json | null
          generateReasonPrompt?: string | null
          generateScorePrompt?: string | null
          id?: string
          input?: Json
          metadata?: Json | null
          output?: Json
          preprocessPrompt?: string | null
          preprocessStepResult?: Json | null
          reason?: string | null
          reasonPrompt?: string | null
          resourceId?: string | null
          runId?: string
          runtimeContext?: Json | null
          score?: number
          scorer?: Json
          scorerId?: string
          source?: string
          threadId?: string | null
          traceId?: string | null
          updatedAt?: string
          updatedAtZ?: string | null
        }
        Relationships: []
      }
      mastra_threads: {
        Row: {
          createdAt: string
          createdAtZ: string | null
          id: string
          metadata: string | null
          resourceId: string
          title: string
          updatedAt: string
          updatedAtZ: string | null
        }
        Insert: {
          createdAt: string
          createdAtZ?: string | null
          id: string
          metadata?: string | null
          resourceId: string
          title: string
          updatedAt: string
          updatedAtZ?: string | null
        }
        Update: {
          createdAt?: string
          createdAtZ?: string | null
          id?: string
          metadata?: string | null
          resourceId?: string
          title?: string
          updatedAt?: string
          updatedAtZ?: string | null
        }
        Relationships: []
      }
      mastra_traces: {
        Row: {
          attributes: Json | null
          createdAt: string
          createdAtZ: string | null
          endTime: number
          events: Json | null
          id: string
          kind: number
          links: Json | null
          name: string
          other: string | null
          parentSpanId: string | null
          scope: string
          startTime: number
          status: Json | null
          traceId: string
        }
        Insert: {
          attributes?: Json | null
          createdAt: string
          createdAtZ?: string | null
          endTime: number
          events?: Json | null
          id: string
          kind: number
          links?: Json | null
          name: string
          other?: string | null
          parentSpanId?: string | null
          scope: string
          startTime: number
          status?: Json | null
          traceId: string
        }
        Update: {
          attributes?: Json | null
          createdAt?: string
          createdAtZ?: string | null
          endTime?: number
          events?: Json | null
          id?: string
          kind?: number
          links?: Json | null
          name?: string
          other?: string | null
          parentSpanId?: string | null
          scope?: string
          startTime?: number
          status?: Json | null
          traceId?: string
        }
        Relationships: []
      }
      mastra_workflow_snapshot: {
        Row: {
          createdAt: string
          createdAtZ: string | null
          resourceId: string | null
          run_id: string
          snapshot: string
          updatedAt: string
          updatedAtZ: string | null
          workflow_name: string
        }
        Insert: {
          createdAt: string
          createdAtZ?: string | null
          resourceId?: string | null
          run_id: string
          snapshot: string
          updatedAt: string
          updatedAtZ?: string | null
          workflow_name: string
        }
        Update: {
          createdAt?: string
          createdAtZ?: string | null
          resourceId?: string | null
          run_id?: string
          snapshot?: string
          updatedAt?: string
          updatedAtZ?: string | null
          workflow_name?: string
        }
        Relationships: []
      }
      user_event_calendars: {
        Row: {
          color: Database["public"]["Enums"]["event_category"] | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
          visible: boolean | null
        }
        Insert: {
          color?: Database["public"]["Enums"]["event_category"] | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
          visible?: boolean | null
        }
        Update: {
          color?: Database["public"]["Enums"]["event_category"] | null
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
      user_event_categories: {
        Row: {
          color: Database["public"]["Enums"]["event_category"] | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: Database["public"]["Enums"]["event_category"] | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: Database["public"]["Enums"]["event_category"] | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
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
          calendar_id: string | null
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
          calendar_id?: string | null
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
          calendar_id?: string | null
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
            foreignKeyName: "user_event_options_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "user_event_calendars"
            referencedColumns: ["id"]
          },
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
          time_format: Database["public"]["Enums"]["time_format"] | null
          timezone: string | null
          title: string | null
          updated_at: string | null
          week_start_day: Database["public"]["Enums"]["weekday"] | null
          work_schedule: Json | null
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
          time_format?: Database["public"]["Enums"]["time_format"] | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          week_start_day?: Database["public"]["Enums"]["weekday"] | null
          work_schedule?: Json | null
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
          time_format?: Database["public"]["Enums"]["time_format"] | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          week_start_day?: Database["public"]["Enums"]["weekday"] | null
          work_schedule?: Json | null
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
      time_format: "12_hour" | "24_hour"
      user_role: "viewer" | "contributor" | "owner" | "delegate_full"
      weekday: "0" | "1" | "2" | "3" | "4" | "5" | "6"
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
      time_format: ["12_hour", "24_hour"],
      user_role: ["viewer", "contributor", "owner", "delegate_full"],
      weekday: ["0", "1", "2", "3", "4", "5", "6"],
    },
  },
} as const

