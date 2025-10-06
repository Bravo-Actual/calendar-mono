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
      ai_evals: {
        Row: {
          agent_name: string
          created_at: string
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
          created_at?: string
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
      ai_memory: {
        Row: {
          content: string
          content_embedding: string | null
          content_json: Json | null
          content_search: unknown | null
          created_at: string
          expires_at: string | null
          importance: string | null
          memory_id: string
          memory_type: string
          persona_id: string
          resource_id: string | null
          source_thread_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          content_embedding?: string | null
          content_json?: Json | null
          content_search?: unknown | null
          created_at?: string
          expires_at?: string | null
          importance?: string | null
          memory_id?: string
          memory_type: string
          persona_id: string
          resource_id?: string | null
          source_thread_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          content_embedding?: string | null
          content_json?: Json | null
          content_search?: unknown | null
          created_at?: string
          expires_at?: string | null
          importance?: string | null
          memory_id?: string
          memory_type?: string
          persona_id?: string
          resource_id?: string | null
          source_thread_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memory_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "ai_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_memory_source_thread_id_fkey"
            columns: ["source_thread_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["thread_id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          created_at: string
          created_at_z: string | null
          message_embedding: string | null
          message_id: string
          persona_id: string | null
          resource_id: string | null
          role: string
          thread_id: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_at_z?: string | null
          message_embedding?: string | null
          message_id: string
          persona_id?: string | null
          resource_id?: string | null
          role: string
          thread_id: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_at_z?: string | null
          message_embedding?: string | null
          message_id?: string
          persona_id?: string | null
          resource_id?: string | null
          role?: string
          thread_id?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["thread_id"]
          },
          {
            foreignKeyName: "ai_messages_thread_owner_fk"
            columns: ["thread_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["thread_id", "user_id"]
          },
        ]
      }
      ai_metadata: {
        Row: {
          created_at: string
          key: string
          memory_id: string | null
          message_id: string | null
          metadata_id: string
          persona_id: string | null
          persona_ref: string | null
          resource_id: string | null
          thread_id: string | null
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          memory_id?: string | null
          message_id?: string | null
          metadata_id?: string
          persona_id?: string | null
          persona_ref?: string | null
          resource_id?: string | null
          thread_id?: string | null
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          memory_id?: string | null
          message_id?: string | null
          metadata_id?: string
          persona_id?: string | null
          persona_ref?: string | null
          resource_id?: string | null
          thread_id?: string | null
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_metadata_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "ai_memory"
            referencedColumns: ["memory_id"]
          },
          {
            foreignKeyName: "ai_metadata_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "ai_metadata_persona_ref_fkey"
            columns: ["persona_ref"]
            isOneToOne: false
            referencedRelation: "ai_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_metadata_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["thread_id"]
          },
        ]
      }
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
      ai_scorers: {
        Row: {
          additional_context: Json | null
          analyze_prompt: string | null
          analyze_step_result: Json | null
          created_at: string
          entity: Json | null
          entity_id: string | null
          entity_type: string | null
          extract_prompt: string | null
          extract_step_result: Json | null
          generate_reason_prompt: string | null
          generate_score_prompt: string | null
          id: string
          input: Json
          metadata: Json | null
          output: Json
          preprocess_prompt: string | null
          preprocess_step_result: Json | null
          reason: string | null
          reason_prompt: string | null
          resource_id: string | null
          run_id: string
          runtime_context: Json | null
          score: number
          scorer: Json
          scorer_id: string
          source: string
          span_id: string | null
          thread_id: string | null
          trace_id: string | null
          updated_at: string
        }
        Insert: {
          additional_context?: Json | null
          analyze_prompt?: string | null
          analyze_step_result?: Json | null
          created_at?: string
          entity?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          extract_prompt?: string | null
          extract_step_result?: Json | null
          generate_reason_prompt?: string | null
          generate_score_prompt?: string | null
          id: string
          input: Json
          metadata?: Json | null
          output: Json
          preprocess_prompt?: string | null
          preprocess_step_result?: Json | null
          reason?: string | null
          reason_prompt?: string | null
          resource_id?: string | null
          run_id: string
          runtime_context?: Json | null
          score: number
          scorer: Json
          scorer_id: string
          source: string
          span_id?: string | null
          thread_id?: string | null
          trace_id?: string | null
          updated_at?: string
        }
        Update: {
          additional_context?: Json | null
          analyze_prompt?: string | null
          analyze_step_result?: Json | null
          created_at?: string
          entity?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          extract_prompt?: string | null
          extract_step_result?: Json | null
          generate_reason_prompt?: string | null
          generate_score_prompt?: string | null
          id?: string
          input?: Json
          metadata?: Json | null
          output?: Json
          preprocess_prompt?: string | null
          preprocess_step_result?: Json | null
          reason?: string | null
          reason_prompt?: string | null
          resource_id?: string | null
          run_id?: string
          runtime_context?: Json | null
          score?: number
          scorer?: Json
          scorer_id?: string
          source?: string
          span_id?: string | null
          thread_id?: string | null
          trace_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_spans: {
        Row: {
          attributes: Json | null
          created_at: string
          ended_at: string | null
          error: Json | null
          input: Json | null
          is_event: boolean
          links: Json | null
          metadata: Json | null
          name: string
          output: Json | null
          parent_span_id: string | null
          scope: Json | null
          span_id: string
          span_type: string
          started_at: string
          trace_id: string
          updated_at: string | null
        }
        Insert: {
          attributes?: Json | null
          created_at?: string
          ended_at?: string | null
          error?: Json | null
          input?: Json | null
          is_event?: boolean
          links?: Json | null
          metadata?: Json | null
          name: string
          output?: Json | null
          parent_span_id?: string | null
          scope?: Json | null
          span_id: string
          span_type: string
          started_at: string
          trace_id: string
          updated_at?: string | null
        }
        Update: {
          attributes?: Json | null
          created_at?: string
          ended_at?: string | null
          error?: Json | null
          input?: Json | null
          is_event?: boolean
          links?: Json | null
          metadata?: Json | null
          name?: string
          output?: Json | null
          parent_span_id?: string | null
          scope?: Json | null
          span_id?: string
          span_type?: string
          started_at?: string
          trace_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_threads: {
        Row: {
          created_at: string
          created_at_z: string | null
          metadata: string | null
          persona_id: string | null
          resource_id: string | null
          thread_id: string
          title: string | null
          updated_at: string
          updated_at_z: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_at_z?: string | null
          metadata?: string | null
          persona_id?: string | null
          resource_id?: string | null
          thread_id: string
          title?: string | null
          updated_at?: string
          updated_at_z?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_at_z?: string | null
          metadata?: string | null
          persona_id?: string | null
          resource_id?: string | null
          thread_id?: string
          title?: string | null
          updated_at?: string
          updated_at_z?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_threads_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "ai_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_traces: {
        Row: {
          attributes: Json | null
          created_at: string
          end_time: number
          events: Json | null
          id: string
          kind: number
          links: Json | null
          name: string
          other: string | null
          parent_span_id: string | null
          scope: string
          start_time: number
          status: Json | null
          trace_id: string
        }
        Insert: {
          attributes?: Json | null
          created_at?: string
          end_time: number
          events?: Json | null
          id: string
          kind: number
          links?: Json | null
          name: string
          other?: string | null
          parent_span_id?: string | null
          scope: string
          start_time: number
          status?: Json | null
          trace_id: string
        }
        Update: {
          attributes?: Json | null
          created_at?: string
          end_time?: number
          events?: Json | null
          id?: string
          kind?: number
          links?: Json | null
          name?: string
          other?: string | null
          parent_span_id?: string | null
          scope?: string
          start_time?: number
          status?: Json | null
          trace_id?: string
        }
        Relationships: []
      }
      ai_workflow_snapshot: {
        Row: {
          created_at: string
          resource_id: string | null
          run_id: string
          snapshot: string
          updated_at: string
          workflow_name: string
        }
        Insert: {
          created_at?: string
          resource_id?: string | null
          run_id: string
          snapshot: string
          updated_at?: string
          workflow_name: string
        }
        Update: {
          created_at?: string
          resource_id?: string | null
          run_id?: string
          snapshot?: string
          updated_at?: string
          workflow_name?: string
        }
        Relationships: []
      }
      event_details_personal: {
        Row: {
          ai_instructions: string | null
          ai_managed: boolean
          calendar_id: string | null
          category_id: string | null
          created_at: string | null
          event_id: string
          show_time_as: Database["public"]["Enums"]["show_time_as"] | null
          time_defense_level:
            | Database["public"]["Enums"]["time_defense_level"]
            | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_instructions?: string | null
          ai_managed?: boolean
          calendar_id?: string | null
          category_id?: string | null
          created_at?: string | null
          event_id: string
          show_time_as?: Database["public"]["Enums"]["show_time_as"] | null
          time_defense_level?:
            | Database["public"]["Enums"]["time_defense_level"]
            | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_instructions?: string | null
          ai_managed?: boolean
          calendar_id?: string | null
          category_id?: string | null
          created_at?: string | null
          event_id?: string
          show_time_as?: Database["public"]["Enums"]["show_time_as"] | null
          time_defense_level?:
            | Database["public"]["Enums"]["time_defense_level"]
            | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_details_personal_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "user_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_details_personal_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "user_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_details_personal_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_details_personal_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_resolved"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          attendance_type: Database["public"]["Enums"]["attendance_type"]
          created_at: string | null
          event_id: string
          following: boolean
          note: string | null
          rsvp_status: Database["public"]["Enums"]["rsvp_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendance_type?: Database["public"]["Enums"]["attendance_type"]
          created_at?: string | null
          event_id: string
          following?: boolean
          note?: string | null
          rsvp_status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendance_type?: Database["public"]["Enums"]["attendance_type"]
          created_at?: string | null
          event_id?: string
          following?: boolean
          note?: string | null
          rsvp_status?: Database["public"]["Enums"]["rsvp_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_resolved"
            referencedColumns: ["id"]
          },
        ]
      }
      event_users: {
        Row: {
          created_at: string | null
          event_id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_users_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_users_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_resolved"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          agenda: string | null
          all_day: boolean
          allow_forwarding: boolean
          allow_reschedule_request: boolean
          created_at: string | null
          discovery: Database["public"]["Enums"]["event_discovery_types"]
          end_time: string
          end_time_ms: number | null
          hide_attendees: boolean
          history: Json | null
          id: string
          in_person: boolean
          join_model: Database["public"]["Enums"]["event_join_model_types"]
          online_chat_link: string | null
          online_event: boolean
          online_join_link: string | null
          owner_id: string
          private: boolean
          request_responses: boolean
          series_id: string | null
          start_time: string
          start_time_ms: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agenda?: string | null
          all_day?: boolean
          allow_forwarding?: boolean
          allow_reschedule_request?: boolean
          created_at?: string | null
          discovery?: Database["public"]["Enums"]["event_discovery_types"]
          end_time: string
          end_time_ms?: number | null
          hide_attendees?: boolean
          history?: Json | null
          id?: string
          in_person?: boolean
          join_model?: Database["public"]["Enums"]["event_join_model_types"]
          online_chat_link?: string | null
          online_event?: boolean
          online_join_link?: string | null
          owner_id: string
          private?: boolean
          request_responses?: boolean
          series_id?: string | null
          start_time: string
          start_time_ms?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agenda?: string | null
          all_day?: boolean
          allow_forwarding?: boolean
          allow_reschedule_request?: boolean
          created_at?: string | null
          discovery?: Database["public"]["Enums"]["event_discovery_types"]
          end_time?: string
          end_time_ms?: number | null
          hide_attendees?: boolean
          history?: Json | null
          id?: string
          in_person?: boolean
          join_model?: Database["public"]["Enums"]["event_join_model_types"]
          online_chat_link?: string | null
          online_event?: boolean
          online_join_link?: string | null
          owner_id?: string
          private?: boolean
          request_responses?: boolean
          series_id?: string | null
          start_time?: string
          start_time_ms?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_annotations: {
        Row: {
          created_at: string | null
          emoji_icon: string | null
          end_time: string
          end_time_ms: number | null
          event_id: string | null
          expires_at: string | null
          id: string
          message: string | null
          start_time: string
          start_time_ms: number | null
          title: string | null
          type: Database["public"]["Enums"]["annotation_type"]
          updated_at: string | null
          user_id: string
          visible: boolean | null
        }
        Insert: {
          created_at?: string | null
          emoji_icon?: string | null
          end_time: string
          end_time_ms?: number | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          message?: string | null
          start_time: string
          start_time_ms?: number | null
          title?: string | null
          type: Database["public"]["Enums"]["annotation_type"]
          updated_at?: string | null
          user_id: string
          visible?: boolean | null
        }
        Update: {
          created_at?: string | null
          emoji_icon?: string | null
          end_time?: string
          end_time_ms?: number | null
          event_id?: string | null
          expires_at?: string | null
          id?: string
          message?: string | null
          start_time?: string
          start_time_ms?: number | null
          title?: string | null
          type?: Database["public"]["Enums"]["annotation_type"]
          updated_at?: string | null
          user_id?: string
          visible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "user_annotations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_annotations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_resolved"
            referencedColumns: ["id"]
          },
        ]
      }
      user_calendars: {
        Row: {
          color: Database["public"]["Enums"]["colors"] | null
          created_at: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["calendar_type"]
          updated_at: string | null
          user_id: string
          visible: boolean
        }
        Insert: {
          color?: Database["public"]["Enums"]["colors"] | null
          created_at?: string | null
          id?: string
          name: string
          type?: Database["public"]["Enums"]["calendar_type"]
          updated_at?: string | null
          user_id: string
          visible?: boolean
        }
        Update: {
          color?: Database["public"]["Enums"]["colors"] | null
          created_at?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["calendar_type"]
          updated_at?: string | null
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      user_categories: {
        Row: {
          color: Database["public"]["Enums"]["colors"] | null
          created_at: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: Database["public"]["Enums"]["colors"] | null
          created_at?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: Database["public"]["Enums"]["colors"] | null
          created_at?: string | null
          id?: string
          is_default?: boolean
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
          time_format: Database["public"]["Enums"]["time_format"] | null
          timezone: string | null
          title: string | null
          updated_at: string | null
          user_id: string
          week_start_day: Database["public"]["Enums"]["weekday"] | null
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
          user_id: string
          week_start_day?: Database["public"]["Enums"]["weekday"] | null
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
          user_id?: string
          week_start_day?: Database["public"]["Enums"]["weekday"] | null
        }
        Relationships: []
      }
      user_work_periods: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          start_time: string
          updated_at: string | null
          user_id: string | null
          weekday: number
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          start_time: string
          updated_at?: string | null
          user_id?: string | null
          weekday: number
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string | null
          user_id?: string | null
          weekday?: number
        }
        Relationships: []
      }
    }
    Views: {
      events_resolved: {
        Row: {
          agenda: string | null
          ai_instructions: string | null
          ai_managed: boolean | null
          all_day: boolean | null
          allow_forwarding: boolean | null
          allow_reschedule_request: boolean | null
          attendance_type: Database["public"]["Enums"]["attendance_type"] | null
          calendar_color: Database["public"]["Enums"]["colors"] | null
          calendar_id: string | null
          calendar_name: string | null
          category_color: Database["public"]["Enums"]["colors"] | null
          category_id: string | null
          category_name: string | null
          computed_following: boolean | null
          computed_role: string | null
          created_at: string | null
          discovery: Database["public"]["Enums"]["event_discovery_types"] | null
          end_time: string | null
          hide_attendees: boolean | null
          history: Json | null
          id: string | null
          in_person: boolean | null
          join_model:
            | Database["public"]["Enums"]["event_join_model_types"]
            | null
          online_chat_link: string | null
          online_event: boolean | null
          online_join_link: string | null
          owner_id: string | null
          private: boolean | null
          request_responses: boolean | null
          rsvp_following: boolean | null
          rsvp_note: string | null
          rsvp_status: Database["public"]["Enums"]["rsvp_status"] | null
          search_vector: unknown | null
          series_id: string | null
          show_time_as: Database["public"]["Enums"]["show_time_as"] | null
          start_time: string | null
          time_defense_level:
            | Database["public"]["Enums"]["time_defense_level"]
            | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          user_role: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "event_details_personal_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "user_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_details_personal_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "user_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_work_hours_view: {
        Row: {
          end_time: string | null
          start_time: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string | null
          weekday: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      ai_search_messages_vector: {
        Args: {
          p_query: string
          p_resource_id?: string
          p_thread_id?: string
          p_top_k?: number
        }
        Returns: {
          content: string
          created_at: string
          message_id: string
          role: string
          similarity: number
          thread_id: string
        }[]
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      create_default_calendar: {
        Args: { user_id_param: string }
        Returns: string
      }
      create_default_category: {
        Args: { user_id_param: string }
        Returns: string
      }
      create_default_persona: {
        Args: { user_id_param: string }
        Returns: string
      }
      get_user_free_time: {
        Args: {
          p_dates?: string[]
          p_end_date?: string
          p_min_duration_minutes?: number
          p_slot_increment_minutes?: number
          p_start_date?: string
          p_timezone?: string
          p_user_id: string
          p_work_end_hour?: number
          p_work_start_hour?: number
        }
        Returns: {
          date_context: string
          duration_minutes: number
          end_time: string
          end_time_ms: number
          start_time: string
          start_time_ms: number
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      search_memories: {
        Args: {
          p_limit?: number
          p_persona_id: string
          p_query: string
          p_user_id: string
        }
        Returns: {
          content: string
          created_at: string
          expires_at: string
          importance: string
          memory_id: string
          memory_type: string
          metadata: Json
          persona_id: string
          rank: number
          source_thread_id: string
          updated_at: string
          user_id: string
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      annotation_type: "ai_event_highlight" | "ai_time_highlight"
      attendance_type: "in_person" | "virtual" | "unknown"
      calendar_type: "default" | "archive" | "user"
      colors:
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
      show_time_as: "free" | "tentative" | "busy" | "oof" | "working_elsewhere"
      time_defense_level: "flexible" | "normal" | "high" | "hard_block"
      time_format: "12_hour" | "24_hour"
      user_role:
        | "viewer"
        | "contributor"
        | "owner"
        | "delegate_full"
        | "attendee"
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
      annotation_type: ["ai_event_highlight", "ai_time_highlight"],
      attendance_type: ["in_person", "virtual", "unknown"],
      calendar_type: ["default", "archive", "user"],
      colors: [
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
      show_time_as: ["free", "tentative", "busy", "oof", "working_elsewhere"],
      time_defense_level: ["flexible", "normal", "high", "hard_block"],
      time_format: ["12_hour", "24_hour"],
      user_role: [
        "viewer",
        "contributor",
        "owner",
        "delegate_full",
        "attendee",
      ],
      weekday: ["0", "1", "2", "3", "4", "5", "6"],
    },
  },
} as const

