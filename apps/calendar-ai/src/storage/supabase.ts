import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";
import { env } from "../env.js";

type Thread = Database["public"]["Tables"]["ai_threads"]["Row"];
type ThreadInsert = Database["public"]["Tables"]["ai_threads"]["Insert"];
type Message = Database["public"]["Tables"]["ai_messages"]["Row"];
type MessageInsert = Database["public"]["Tables"]["ai_messages"]["Insert"];
type Persona = Database["public"]["Tables"]["ai_personas"]["Row"];
type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
type WorkPeriod = Database["public"]["Tables"]["user_work_periods"]["Row"];
type Memory = Database["public"]["Tables"]["ai_memory"]["Row"];
type MemoryInsert = Database["public"]["Tables"]["ai_memory"]["Insert"];

// Simple in-memory cache for personas with 5-minute TTL
const personaCache = new Map<string, { persona: Persona; expiresAt: number }>();
const userProfileCache = new Map<string, { profile: UserProfile; expiresAt: number }>();
const workPeriodsCache = new Map<string, { periods: WorkPeriod[]; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class SupabaseStorage {
  private supabase: SupabaseClient<Database>;

  constructor(authToken?: string) {
    this.supabase = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      authToken
        ? {
            global: { headers: { Authorization: `Bearer ${authToken}` } },
          }
        : undefined
    );
  }

  // Thread operations
  async createThread(data: ThreadInsert): Promise<Thread> {
    const { data: thread, error } = await this.supabase
      .from("ai_threads")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return thread;
  }

  async getThread(threadId: string): Promise<Thread | null> {
    const { data, error } = await this.supabase
      .from("ai_threads")
      .select("*")
      .eq("thread_id", threadId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw error;
    }
    return data;
  }

  async getThreads(userId: string, personaId?: string): Promise<Thread[]> {
    let query = this.supabase
      .from("ai_threads")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (personaId) {
      query = query.eq("persona_id", personaId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async updateThread(
    threadId: string,
    updates: { title?: string; metadata?: Database["public"]["Tables"]["ai_threads"]["Row"]["metadata"] }
  ): Promise<Thread> {
    const { data, error } = await this.supabase
      .from("ai_threads")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("thread_id", threadId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteThread(threadId: string): Promise<void> {
    const { error } = await this.supabase.from("ai_threads").delete().eq("thread_id", threadId);
    if (error) throw error;
  }

  // Message operations
  async addMessage(data: MessageInsert): Promise<Message> {
    const { data: message, error } = await this.supabase
      .from("ai_messages")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return message;
  }

  async getMessages(threadId: string, limit: number = 50): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from("ai_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // Persona operations
  async getPersona(personaId: string): Promise<Persona | null> {
    // Check cache first
    const cached = personaCache.get(personaId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.persona;
    }

    // Fetch from database
    const { data, error } = await this.supabase
      .from("ai_personas")
      .select("*")
      .eq("id", personaId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw error;
    }

    // Cache the result
    if (data) {
      personaCache.set(personaId, {
        persona: data,
        expiresAt: Date.now() + CACHE_TTL,
      });
    }

    return data;
  }

  // User profile operations
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    // Check cache first
    const cached = userProfileCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.profile;
    }

    // Fetch from database
    const { data, error } = await this.supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw error;
    }

    // Cache the result
    if (data) {
      userProfileCache.set(userId, {
        profile: data,
        expiresAt: Date.now() + CACHE_TTL,
      });
    }

    return data;
  }

  async getWorkPeriods(userId: string): Promise<WorkPeriod[]> {
    // Check cache first
    const cached = workPeriodsCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.periods;
    }

    // Fetch from database
    const { data, error } = await this.supabase
      .from("user_work_periods")
      .select("*")
      .eq("user_id", userId)
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) throw error;

    const periods = data || [];

    // Cache the result
    workPeriodsCache.set(userId, {
      periods,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return periods;
  }

  // Memory operations
  async saveMemory(data: MemoryInsert): Promise<Memory> {
    const { data: memory, error } = await this.supabase
      .from("ai_memory")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return memory;
  }

  async getMemories(userId: string, personaId: string): Promise<Memory[]> {
    const { data, error } = await this.supabase
      .from("ai_memory")
      .select("*")
      .eq("user_id", userId)
      .eq("persona_id", personaId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateMemory(memoryId: string, updates: Partial<Omit<Memory, "memory_id" | "user_id" | "persona_id" | "created_at">>): Promise<Memory> {
    const { data, error } = await this.supabase
      .from("ai_memory")
      .update(updates)
      .eq("memory_id", memoryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteMemory(memoryId: string): Promise<void> {
    const { error } = await this.supabase
      .from("ai_memory")
      .delete()
      .eq("memory_id", memoryId);

    if (error) throw error;
  }

  async deleteExpiredMemories(): Promise<number> {
    const { data, error } = await this.supabase
      .from("ai_memory")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("memory_id");

    if (error) throw error;
    return data?.length || 0;
  }
}

export type { Thread, ThreadInsert, Message, MessageInsert, Persona, UserProfile, WorkPeriod, Memory, MemoryInsert };
