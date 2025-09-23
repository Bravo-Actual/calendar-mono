// Import Database type first for use in type expressions
import type { Database } from './database.types'

// Export all database types
export * from './database.types'

// Export commonly used table types for convenience
export type Tables = Database['public']['Tables']
export type Enums = Database['public']['Enums']

// Convenience type exports for commonly used tables
export type AIPersona = Database['public']['Tables']['ai_personas']['Row']
export type AIPersonaInsert = Database['public']['Tables']['ai_personas']['Insert']
export type AIPersonaUpdate = Database['public']['Tables']['ai_personas']['Update']

export type Event = Database['public']['Tables']['events']['Row']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type EventUpdate = Database['public']['Tables']['events']['Update']

export type ChatConversation = Database['public']['Tables']['chat_conversations']['Row']
export type ChatConversationInsert = Database['public']['Tables']['chat_conversations']['Insert']
export type ChatConversationUpdate = Database['public']['Tables']['chat_conversations']['Update']

export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']
export type ChatMessageInsert = Database['public']['Tables']['chat_messages']['Insert']
export type ChatMessageUpdate = Database['public']['Tables']['chat_messages']['Update']

// Export enums
export type EventCategory = Database['public']['Enums']['colors']
export type ShowTimeAs = Database['public']['Enums']['show_time_as_extended']
export type AttendanceType = Database['public']['Enums']['attendance_type']