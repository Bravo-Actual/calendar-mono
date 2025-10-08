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

  // Attendee changes
  attendee_changes?: {
    invite_users?: Array<{ userId: string; role: string }>;
    update_users?: Array<{ userId: string; role: string }>;
    remove_users?: string[];
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

    // Create service role client for privileged operations
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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

      // Extract main event fields, personal details, and invite_users
      const { personal_details, invite_users, ...eventFields } = eventPayload

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

      // Handle personal details if provided - only UPDATE, never CREATE (DB creates it)
      if (personal_details) {
        const eventId = createdEvent.id

        const { error: edpError } = await supabaseClient
          .from('event_details_personal')
          .update(personal_details)
          .eq('event_id', eventId)
          .eq('user_id', user.id)

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

      // Handle invite_users if provided
      if (invite_users && invite_users.length > 0) {
        const eventId = createdEvent.id

        for (const invitee of invite_users) {
          // Insert into event_users using service role (creating records for other users)
          const { error: inviteError } = await supabaseServiceClient
            .from('event_users')
            .insert({
              event_id: eventId,
              user_id: invitee.user_id,
              role: invitee.role || 'attendee'
            })

          if (inviteError) {
            console.error('Error inviting user:', inviteError)
            // Continue with other invites even if one fails
          }

          // Insert into event_rsvps with the provided status using service role
          const { error: rsvpError } = await supabaseServiceClient
            .from('event_rsvps')
            .insert({
              event_id: eventId,
              user_id: invitee.user_id,
              rsvp_status: invitee.rsvp_status || 'tentative'
            })

          if (rsvpError) {
            console.error('Error creating RSVP:', rsvpError)
            // Continue with other RSVPs even if one fails
          }

          // Create event_details_personal for the invitee
          // Get their default calendar and category
          const { data: userCalendar } = await supabaseClient
            .from('user_calendars')
            .select('id')
            .eq('user_id', invitee.user_id)
            .eq('type', 'default')
            .limit(1)
            .single()

          const { data: userCategory } = await supabaseClient
            .from('user_categories')
            .select('id')
            .eq('user_id', invitee.user_id)
            .eq('is_default', true)
            .limit(1)
            .single()

          const { error: edpError } = await supabaseServiceClient
            .from('event_details_personal')
            .insert({
              event_id: eventId,
              user_id: invitee.user_id,
              calendar_id: userCalendar?.id || null,
              category_id: userCategory?.id || null,
              show_time_as: 'busy',
              time_defense_level: 'normal'
            })

          if (edpError) {
            console.error('Error creating event_details_personal for invitee:', edpError)
            // Continue even if this fails
          }
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

      // Extract main event fields, personal details, and attendee changes
      const { personal_details, attendee_changes, ...eventFields } = eventPayload

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

      const isOwner = eventCheck.owner_id === user.id
      let resultEvent = null

      // Update event fields if provided (only owners can do this)
      const hasEventFields = Object.keys(eventFields).filter(key => key !== 'id').length > 0
      if (hasEventFields) {
        if (!isOwner) {
          return new Response(
            JSON.stringify({ error: 'Only event owner can update event fields' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }
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
          console.error('❌ [ERROR] No event ID for personal details update')
          return new Response(
            JSON.stringify({ error: 'Event ID required for personal details update' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        console.log('✅ [DEBUG] Updating personal details for event:', eventId, 'user:', user.id)

        const { error: edpError } = await supabaseClient
          .from('event_details_personal')
          .upsert({
            event_id: eventId,
            user_id: user.id,
            ...personal_details
          })

        if (edpError) {
          console.error('❌ [ERROR] Event details personal error:', edpError)
          console.error('❌ [ERROR] Payload was:', JSON.stringify({
            event_id: eventId,
            user_id: user.id,
            ...personal_details
          }, null, 2))
          return new Response(
            JSON.stringify({ error: edpError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        console.log('✅ [DEBUG] Successfully updated personal details')
      }

      // Handle attendee changes (only owners can do this for now)
      if (attendee_changes) {
        if (!isOwner) {
          return new Response(
            JSON.stringify({ error: 'Only event owner can manage attendees' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        const eventId = (resultEvent as any)?.id || eventFields.id

        // Remove users
        if (attendee_changes.remove_users && attendee_changes.remove_users.length > 0) {
          for (const userId of attendee_changes.remove_users) {
            // Delete from event_users (triggers will handle RSVP cleanup)
            const { error: removeError } = await supabaseClient
              .from('event_users')
              .delete()
              .eq('event_id', eventId)
              .eq('user_id', userId)

            if (removeError) {
              console.error('Error removing user:', removeError)
            }
          }
        }

        // Update existing users
        if (attendee_changes.update_users && attendee_changes.update_users.length > 0) {
          for (const { userId, role } of attendee_changes.update_users) {
            const { error: updateError } = await supabaseClient
              .from('event_users')
              .update({ role })
              .eq('event_id', eventId)
              .eq('user_id', userId)

            if (updateError) {
              console.error('Error updating user role:', updateError)
            }
          }
        }

        // Add new users
        if (attendee_changes.invite_users && attendee_changes.invite_users.length > 0) {
          for (const { userId, role } of attendee_changes.invite_users) {
            // Insert into event_users
            const { error: inviteError } = await supabaseClient
              .from('event_users')
              .insert({
                event_id: eventId,
                user_id: userId,
                role: role || 'attendee'
              })

            if (inviteError) {
              console.error('Error inviting user:', inviteError)
              continue // Skip creating related records if user insert failed
            }

            // Get or create default calendar for the new user
            const { data: userCalendar } = await supabaseClient
              .from('user_calendars')
              .select('id')
              .eq('user_id', userId)
              .eq('type', 'default')
              .limit(1)
              .single()

            let calendarId = userCalendar?.id
            if (!calendarId) {
              // Create default calendar using RPC function (SECURITY DEFINER)
              const { data: newCalendarId } = await supabaseClient
                .rpc('create_default_calendar', { user_id_param: userId })
              calendarId = newCalendarId
            }

            // Get or create default category for the new user
            const { data: userCategory } = await supabaseClient
              .from('user_categories')
              .select('id')
              .eq('user_id', userId)
              .eq('is_default', true)
              .limit(1)
              .single()

            let categoryId = userCategory?.id
            if (!categoryId) {
              // Create default category using RPC function (SECURITY DEFINER)
              const { data: newCategoryId } = await supabaseClient
                .rpc('create_default_category', { user_id_param: userId })
              categoryId = newCategoryId
            }

            // Determine default show_time_as based on whether user is the owner
            const showTimeAs = userId === user.id ? 'busy' : 'tentative'

            // Create event_details_personal for this user using service role client
            const { error: edpError } = await supabaseServiceClient
              .from('event_details_personal')
              .insert({
                event_id: eventId,
                user_id: userId,
                calendar_id: calendarId,
                category_id: categoryId,
                show_time_as: showTimeAs,
                time_defense_level: 'normal'
              })

            if (edpError) {
              console.error('Error creating event_details_personal:', edpError)
            }

            // Create event_rsvps record for this user using service role client
            const rsvpStatus = userId === user.id ? 'accepted' : 'no_response'
            const { error: rsvpError } = await supabaseServiceClient
              .from('event_rsvps')
              .insert({
                event_id: eventId,
                user_id: userId,
                rsvp_status: rsvpStatus,
                attendance_type: 'unknown',
                following: false
              })

            if (rsvpError) {
              console.error('Error creating event_rsvps:', rsvpError)
            }
          }
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