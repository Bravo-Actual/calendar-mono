import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Event request (handles both create and update with personal details)
interface EventRequest {
  // ID only for updates, not for creates
  id?: string;

  // All possible event fields (server generates owner_id for creates)
  owner_id?: string;
  series_id?: string;
  title?: string;
  agenda?: string;
  online_event?: boolean;
  online_join_link?: string;
  online_chat_link?: string;
  in_person?: boolean;
  start_time?: string; // ISO string
  end_time?: string;   // ISO string
  all_day?: boolean;
  private?: boolean;
  request_responses?: boolean;
  allow_forwarding?: boolean;
  allow_reschedule_request?: boolean;
  hide_attendees?: boolean;
  history?: any;
  discovery?: string;
  join_model?: string;
  created_at?: string;
  updated_at?: string;

  // Personal details
  personal_details?: {
    calendar_id?: string;
    category_id?: string;
    show_time_as?: string;
    time_defense_level?: string;
    ai_managed?: boolean;
    ai_instructions?: string;
  };
}

interface DeleteEventRequest {
  id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get user from JWT
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // POST - Create Event
    if (req.method === 'POST') {
      const eventPayload = await req.json() as EventRequest
      console.log('🔍 [EDGE DEBUG] Edge function received POST payload:', JSON.stringify(eventPayload, null, 2))
      console.log('🔍 [EDGE DEBUG] Payload keys:', Object.keys(eventPayload))
      console.log('🔍 [EDGE DEBUG] User ID from JWT:', user.id)

      // Extract main event fields and personal details
      const { personal_details, ...eventFields } = eventPayload

      // Only owners can create events - let database handle timestamps
      const eventData = {
        ...eventFields,
        owner_id: user.id,
      }

      const { data: createdEvent, error: eventError } = await supabaseClient
        .from('events')
        .insert(eventData)
        .select()
        .single()

      if (eventError) {
        console.error('Event creation error:', eventError)
        return new Response(
          JSON.stringify({ error: eventError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Database triggers automatically create event_users and event_rsvps for the owner
      // Now update event_details_personal if provided (triggers create the row)
      if (personal_details) {
        const { error: edpError } = await supabaseClient
          .from('event_details_personal')
          .update(personal_details)
          .eq('event_id', createdEvent.id)
          .eq('user_id', user.id)

        if (edpError) {
          console.error('Event details personal error:', edpError)
          // Event was created successfully, so don't fail the whole operation
        }
      }

      // Fetch all related records created by triggers to return complete resolved structure
      const [eventUserResult, eventRsvpResult, eventDetailsResult] = await Promise.all([
        supabaseClient
          .from('event_users')
          .select('*')
          .eq('event_id', createdEvent.id)
          .eq('user_id', user.id)
          .single(),
        supabaseClient
          .from('event_rsvps')
          .select('*')
          .eq('event_id', createdEvent.id)
          .eq('user_id', user.id)
          .single(),
        supabaseClient
          .from('event_details_personal')
          .select('*')
          .eq('event_id', createdEvent.id)
          .eq('user_id', user.id)
          .single()
      ])

      return new Response(
        JSON.stringify({
          success: true,
          event: createdEvent,
          event_user: eventUserResult.data,
          event_rsvp: eventRsvpResult.data,
          event_details_personal: eventDetailsResult.data
        }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // PATCH - Update Event and/or Related Data
    else if (req.method === 'PATCH') {
      const eventPayload = await req.json() as EventRequest

      const { id: event_id, personal_details, ...eventFields } = eventPayload

      if (!event_id) {
        return new Response(
          JSON.stringify({ error: 'Event ID required for update' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Check if user is the owner
      const { data: eventCheck } = await supabaseClient
        .from('events')
        .select('owner_id')
        .eq('id', event_id)
        .single()

      const isOwner = eventCheck?.owner_id === user.id

      // Update main event (only owner can do this) - let database handle updated_at
      const hasEventFields = Object.keys(eventFields).length > 0
      if (hasEventFields && isOwner) {
        const eventData = {
          ...eventFields,
        }

        const { error: eventError } = await supabaseClient
          .from('events')
          .update(eventData)
          .eq('id', event_id)
          .eq('owner_id', user.id)

        if (eventError) {
          console.error('Event update error:', eventError)
          return new Response(
            JSON.stringify({ error: eventError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
      } else if (hasEventFields && !isOwner) {
        return new Response(
          JSON.stringify({ error: 'Only event owner can update main event fields' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Update event_details_personal (both owners and attendees can update their personal details)
      if (personal_details) {
        const { error: edpError } = await supabaseClient
          .from('event_details_personal')
          .update(personal_details)
          .eq('event_id', event_id)
          .eq('user_id', user.id)

        if (edpError) {
          console.error('Event details personal update error:', edpError)
          return new Response(
            JSON.stringify({ error: edpError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // DELETE - Delete Event
    else if (req.method === 'DELETE') {
      const { id: event_id } = await req.json() as DeleteEventRequest

      if (!event_id) {
        return new Response(
          JSON.stringify({ error: 'Event ID required for delete' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Only owners can delete events
      const { error: deleteError } = await supabaseClient
        .from('events')
        .delete()
        .eq('id', event_id)
        .eq('owner_id', user.id)

      if (deleteError) {
        console.error('Event deletion error:', deleteError)
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})