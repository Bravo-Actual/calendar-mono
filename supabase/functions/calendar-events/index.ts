/* Supabase Edge Function: calendar-events
   - GET /?startDate=...&endDate=... - retrieves calendar events for date range
   - GET /?dates=... - retrieves calendar events for specific dates (comma-separated)
   - Used by Mastra AI service to access user's calendar events
*/
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase configuration in environment.");
    return new Response(JSON.stringify({
      error: "Server misconfiguration"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  // Create authenticated client
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });

  // Verify user authentication
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    console.warn("Unauthorized request: ", userError);
    return new Response(JSON.stringify({
      error: "Unauthorized"
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  const user = userData.user;
  const { method } = req;
  const url = new URL(req.url);

  try {
    if (method === "GET") {
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");
      const datesParam = url.searchParams.get("dates");
      const categoryId = url.searchParams.get("categoryId");

      // First, get all event IDs where user has access (via event_users table)
      const { data: eventUserData, error: eventUserError } = await supabase
        .from('event_users')
        .select('event_id')
        .eq('user_id', user.id);

      if (eventUserError) {
        console.error("Error fetching event_users:", eventUserError);
        return new Response(JSON.stringify({
          error: "Failed to fetch user events"
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }

      const eventIds = eventUserData?.map(eu => eu.event_id) || [];

      if (eventIds.length === 0) {
        // User has no events
        return new Response(JSON.stringify({
          success: true,
          events: [],
          message: "No events found"
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }

      // Now query events table with the event IDs, including attendees with their roles
      let query = supabase
        .from('events')
        .select(`
          *,
          event_users(
            user_id,
            role
          )
        `)
        .in('id', eventIds);

      if (datesParam) {
        // Handle array of specific dates
        const dates = datesParam.split(',').map(d => d.trim());
        console.log(`Fetching events for user: ${user.id}, specific dates: ${dates.join(', ')}`);

        // Create date range conditions for each date (start of day to end of day)
        const dateConditions = dates.map(date => {
          const startOfDay = `${date}T00:00:00.000Z`;
          const endOfDay = `${date}T23:59:59.999Z`;
          return `(start_time.gte.${startOfDay},start_time.lte.${endOfDay})`;
        }).join(',');

        query = query.or(dateConditions);
      } else if (startDate && endDate) {
        // Handle date range - find events that overlap with the range
        // An event overlaps if: event_start < range_end AND event_end > range_start
        console.log(`Fetching events for user: ${user.id}, range: ${startDate} to ${endDate}`);
        query = query
          .lt('start_time', endDate)
          .gt('end_time', startDate);
      } else {
        return new Response(JSON.stringify({
          error: "Missing required parameters: either (startDate and endDate) or dates"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }

      // TODO: Category filtering needs to be implemented via event_details_personal table
      // if (categoryId) {
      //   query = query.eq('category_id', categoryId);
      // }

      // Order by start time
      query = query.order('start_time', { ascending: true });

      const { data: events, error } = await query;

      if (error) {
        console.error("Error fetching events:", error);
        return new Response(JSON.stringify({
          error: "Failed to fetch events"
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }

      console.log(`Found ${events?.length || 0} events`);

      // Fetch user profiles for all attendees and attach to event_users
      if (events && events.length > 0) {
        // Collect all unique user IDs from event_users across all events
        const allUserIds = new Set<string>();
        for (const event of events) {
          if (event.event_users && Array.isArray(event.event_users)) {
            for (const eu of event.event_users) {
              allUserIds.add(eu.user_id);
            }
          }
        }

        if (allUserIds.size > 0) {
          // Fetch user profiles for all these users
          const { data: profiles, error: profileError } = await supabase
            .from('user_profiles')
            .select('user_id, email, display_name, first_name, last_name')
            .in('user_id', Array.from(allUserIds));

          if (!profileError && profiles) {
            // Create a map for quick lookup
            const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));

            // Attach profiles to event_users
            for (const event of events) {
              if (event.event_users && Array.isArray(event.event_users)) {
                event.event_users = event.event_users.map((eu: any) => ({
                  ...eu,
                  users: {
                    id: eu.user_id,
                    user_profiles: [profileMap.get(eu.user_id)].filter(Boolean)
                  }
                }));
              }
            }
          }
        }
      }

      const message = datesParam
        ? `Found ${events?.length || 0} events for specified dates`
        : `Found ${events?.length || 0} events between ${startDate} and ${endDate}`;

      return new Response(JSON.stringify({
        success: true,
        events: events || [],
        message
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({
      error: error.message || "Internal server error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});