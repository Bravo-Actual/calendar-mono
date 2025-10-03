/**
 * Database types for Supabase
 * This is a simplified version - full types can be generated via supabase gen types
 */

export interface Database {
  public: {
    Tables: {
      ai_personas: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          avatar_url: string | null;
          traits: string | null;
          instructions: string | null;
          greeting: string | null;
          agent_id: string | null;
          model_id: string | null;
          temperature: number | null;
          top_p: number | null;
          is_default: boolean;
          properties_ext: any;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['ai_personas']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['ai_personas']['Insert']>;
      };
      // Add more tables as needed
    };
    Views: {
      events_resolved: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          start_time: string;
          end_time: string;
          user_id: string;
          calendar_id: string | null;
          calendar_name: string | null;
          category_id: string | null;
          category_name: string | null;
          // ... other fields
          [key: string]: any;
        };
      };
    };
  };
}
