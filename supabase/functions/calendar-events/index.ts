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

      let query = supabase
        .from('events')
        .select('*')
        .eq('owner_id', user.id);

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
        // Handle date range
        console.log(`Fetching events for user: ${user.id}, range: ${startDate} to ${endDate}`);
        query = query
          .gte('start_time', startDate)
          .lte('start_time', endDate);
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