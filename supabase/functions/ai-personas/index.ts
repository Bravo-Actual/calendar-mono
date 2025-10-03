/* Supabase Edge Function: ai-personas
   - GET /default - retrieves user's default AI persona
   - GET /{persona_id} - retrieves specific AI persona by ID
   - Used by LangGraph AI service to access persona configurations
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
  const path = url.pathname.split('/').pop();

  try {
    if (method === "GET" && path === "default") {
      console.log(`Fetching default persona for user: ${user.id}`);

      // Get user's default persona
      const { data: personas, error } = await supabase
        .from('ai_personas')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error fetching default persona:", error);
        return new Response(JSON.stringify({
          error: "Failed to fetch default persona"
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }

      const persona = personas && personas.length > 0 ? personas[0] : null;

      if (persona) {
        console.log(`Found default persona: ${persona.persona_name}`);
      } else {
        console.log("No default persona found for user");
      }

      return new Response(JSON.stringify({
        success: true,
        persona: persona
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    if (method === "GET" && path && path !== "default") {
      console.log(`Fetching persona by ID: ${path} for user: ${user.id}`);

      // Get specific persona by ID
      const { data: persona, error } = await supabase
        .from('ai_personas')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', path)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return new Response(JSON.stringify({
            error: "Persona not found"
          }), {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }

        console.error("Error fetching persona by ID:", error);
        return new Response(JSON.stringify({
          error: "Failed to fetch persona"
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }

      console.log(`Found persona: ${persona.persona_name}`);

      return new Response(JSON.stringify({
        success: true,
        persona: persona
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    return new Response(JSON.stringify({
      error: "Invalid endpoint. Use /default or /{persona_id}"
    }), {
      status: 400,
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