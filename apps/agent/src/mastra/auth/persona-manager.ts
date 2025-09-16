// apps/agent/src/mastra/auth/persona-manager.ts

// No longer using global JWT storage - JWT passed as parameter

export interface AiPersona {
  id: string;
  user_id: string;
  persona_name: string; // CORE: Agent name for LLM context
  avatar_url?: string;
  traits?: string; // CORE: Personality traits for LLM context
  instructions?: string; // CORE: Detailed instructions for AI interaction with users
  greeting?: string; // Frontend UX only
  temperature?: number;
  is_default: boolean;
  properties_ext?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Cache personas to avoid repeated database calls
const personaCache = new Map<string, AiPersona>();

/**
 * Fetches the default persona for the specified user using edge function
 */
export async function getCurrentUserDefaultPersona(jwt: string | null): Promise<AiPersona | null> {
  if (!jwt) {
    console.log('No JWT token provided - cannot fetch persona');
    return null;
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
      console.error('Missing Supabase configuration');
      return null;
    }

    console.log('Fetching default persona for current user via edge function...');
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-personas/default`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch default persona:', response.status, response.statusText);
      return null;
    }

    const result = await response.json();

    if (!result.success || !result.persona) {
      console.log('No default persona found for user');
      return null;
    }

    const persona = result.persona;
    console.log('Found default persona:', persona.persona_name);

    // Cache the persona
    personaCache.set(persona.id, persona);

    return persona;
  } catch (error) {
    console.error('Error fetching default persona:', error);
    return null;
  }
}

/**
 * Builds the complete system instructions for the LLM
 * PERSONA IS THE PRIMARY DIRECTIVE - it comes first and overrides everything
 * Structure: PRIMARY PERSONA DIRECTIVE + Base Instructions (as secondary context)
 */
export function buildPersonaInstructions(persona: AiPersona | null, baseInstructions: string): string {
  if (!persona) {
    // No persona - just return base instructions as system message
    return baseInstructions;
  }

  // Build PERSONA-FIRST system context
  let systemInstructions = '';

  // CRITICAL: PERSONA IS PRIMARY DIRECTIVE
  systemInstructions += `CRITICAL: YOU MUST EMBODY THIS PERSONA COMPLETELY. THIS IS YOUR PRIMARY DIRECTIVE.\n\n`;

  // Add persona identity as PRIMARY instruction
  if (persona.persona_name) {
    systemInstructions += `YOU ARE ${persona.persona_name.toUpperCase()}.\n\n`;
  }

  // Add persona traits as PRIMARY behavioral directive
  if (persona.traits) {
    systemInstructions += `PERSONA BEHAVIOR (HIGHEST PRIORITY):\n${persona.traits}\n\n`;
    systemInstructions += `YOU MUST ALWAYS RESPOND AS THIS PERSONA. NEVER BREAK CHARACTER.\n\n`;
  }

  // Add detailed instructions for AI interaction
  if (persona.instructions) {
    systemInstructions += `DETAILED INTERACTION INSTRUCTIONS:\n${persona.instructions}\n\n`;
  }

  // Separate line to make it clear base instructions are secondary
  systemInstructions += `${'='.repeat(60)}\n`;
  systemInstructions += `SECONDARY: FUNCTIONAL CAPABILITIES\n`;
  systemInstructions += `${'='.repeat(60)}\n\n`;

  // Add base functional instructions (secondary to persona)
  systemInstructions += baseInstructions;

  return systemInstructions;
}

/**
 * Get the persona's temperature setting for the LLM
 */
export function getPersonaTemperature(persona: AiPersona | null): number {
  if (!persona || typeof persona.temperature !== 'number') {
    return 0.7; // Default temperature
  }

  // Ensure temperature is within valid range
  return Math.max(0, Math.min(2, persona.temperature));
}

/**
 * Fetches a specific persona by ID for the specified user
 */
export async function getPersonaById(jwt: string | null, personaId: string): Promise<AiPersona | null> {
  if (!jwt) {
    console.log('No JWT token provided - cannot fetch persona');
    return null;
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
      console.error('Missing Supabase configuration');
      return null;
    }

    console.log(`Fetching persona by ID: ${personaId} via edge function...`);
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-personas/${personaId}`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch persona by ID:', response.status, response.statusText);
      return null;
    }

    const result = await response.json();

    if (!result.success || !result.persona) {
      console.log(`No persona found with ID: ${personaId}`);
      return null;
    }

    const persona = result.persona;
    console.log(`Found persona: ${persona.persona_name}`);

    // Cache the persona
    personaCache.set(persona.id, persona);

    return persona;
  } catch (error) {
    console.error('Error fetching persona by ID:', error);
    return null;
  }
}

/**
 * Gets the effective persona for the specified user
 * If personaId is provided, fetches that specific persona
 * Otherwise, falls back to the user's default persona
 */
export async function getEffectivePersona(jwt: string | null, personaId?: string): Promise<AiPersona | null> {
  try {
    if (personaId) {
      console.log(`Using specific persona ID: ${personaId}`);
      const persona = await getPersonaById(jwt, personaId);
      if (persona) {
        return persona;
      }
      console.log(`Persona ${personaId} not found, falling back to default`);
    }

    console.log('Using default persona');
    const persona = await getCurrentUserDefaultPersona(jwt);

    if (!persona) {
      console.log('No default persona found for user');
    }

    return persona;
  } catch (error) {
    console.error('Error getting effective persona:', error);
    return null;
  }
}

/**
 * Clears persona cache (useful for development/testing)
 */
export function clearPersonaCache(): void {
  personaCache.clear();
  console.log('Persona cache cleared');
}