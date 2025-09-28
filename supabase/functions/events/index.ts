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

      // Extract main event fields and personal details
      const { personal_details, ...eventFields } = eventPayload

      // Ensure owner_id is set to current user (security)
      const eventData = {
        ...eventFields,
        owner_id: user.id,
      }

      // Create the event using UPSERT to handle client-generated IDs
      const { data: createdEvent, error: eventError } = await supabaseClient
        .from('events')
        .upsert(eventData)
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

      let resultEvent = createdEvent

      // Handle personal details if provided
      if (personal_details) {
        const eventId = createdEvent.id

        const { error: edpError } = await supabaseClient
          .from('event_details_personal')
          .insert({
            event_id: eventId,
            user_id: user.id,
            ...personal_details
          })

        if (edpError) {
          console.error('Event details personal error:', edpError)
          return new Response(
            JSON.stringify({ error: edpError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
      }

      // Return success
      return new Response(
        JSON.stringify({
          success: true,
          event: resultEvent
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // PATCH - Update Event
    else if (req.method === 'PATCH') {
      const eventPayload = await req.json() as EventRequest
      console.log('🔍 [EDGE DEBUG] Edge function received PATCH payload:', JSON.stringify(eventPayload, null, 2))

      // Extract main event fields and personal details
      const { personal_details, ...eventFields } = eventPayload

      if (!eventFields.id) {
        return new Response(
          JSON.stringify({ error: 'Event ID required for updates' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Verify ownership
      const { data: eventCheck } = await supabaseClient
        .from('events')
        .select('owner_id')
        .eq('id', eventFields.id)
        .single()

      if (!eventCheck) {
        return new Response(
          JSON.stringify({ error: 'Event not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (eventCheck.owner_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Only event owner can update event' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      let resultEvent = null

      // Update event fields if provided
      const hasEventFields = Object.keys(eventFields).filter(key => key !== 'id').length > 0
      if (hasEventFields) {
        const updateData = { ...eventFields }
        delete updateData.id // Don't include ID in the update data

        const { data: updatedEvent, error: eventError } = await supabaseClient
          .from('events')
          .update(updateData)
          .eq('id', eventFields.id)
          .select()
          .single()

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

        resultEvent = updatedEvent
      }

      // Handle personal details (both owners and attendees can update their personal details)
      if (personal_details) {
        const eventId = (resultEvent as any)?.id || eventFields.id

        if (!eventId) {
          return new Response(
            JSON.stringify({ error: 'Event ID required for personal details update' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        const { error: edpError } = await supabaseClient
          .from('event_details_personal')
          .upsert({
            event_id: eventId,
            user_id: user.id,
            ...personal_details
          })

        if (edpError) {
          console.error('Event details personal error:', edpError)
          return new Response(
            JSON.stringify({ error: edpError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
      }

      // Return success
      return new Response(
        JSON.stringify({
          success: true,
          event: resultEvent
        }),
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