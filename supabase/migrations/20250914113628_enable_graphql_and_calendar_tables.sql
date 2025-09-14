-- Enable the pg_graphql extension
create extension if not exists pg_graphql;

-- Create enum types for calendar events
create type event_category as enum (
  'neutral', 'slate', 'orange', 'yellow', 'green',
  'blue', 'indigo', 'violet', 'fuchsia', 'rose'
);

create type show_time_as as enum ('busy', 'tentative', 'free');

-- Create events table
create table events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  all_day boolean default false,
  ai_suggested boolean default false,
  show_time_as show_time_as default 'busy',
  category event_category default 'neutral',
  is_online_meeting boolean default false,
  is_in_person boolean default false,
  meta jsonb default '{}',
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create time_highlights table for AI suggestions
create table time_highlights (
  id uuid default gen_random_uuid() primary key,
  day_idx integer not null,
  start_ms_in_day bigint not null, -- milliseconds from 00:00 local
  end_ms_in_day bigint not null,   -- milliseconds from 00:00 local
  intent text,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Create system_slots table for system-suggested time slots
create table system_slots (
  id uuid default gen_random_uuid() primary key,
  start_abs timestamptz not null, -- absolute timestamp UTC
  end_abs timestamptz not null,   -- absolute timestamp UTC
  reason text,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table events enable row level security;
alter table time_highlights enable row level security;
alter table system_slots enable row level security;

-- Create RLS policies for events
create policy "Users can CRUD their own events"
  on events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create RLS policies for time_highlights
create policy "Users can CRUD their own time highlights"
  on time_highlights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create RLS policies for system_slots
create policy "Users can CRUD their own system slots"
  on system_slots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create indexes for better performance
create index events_user_id_idx on events(user_id);
create index events_start_time_idx on events(start_time);
create index events_end_time_idx on events(end_time);
create index events_ai_suggested_idx on events(ai_suggested);

create index time_highlights_user_id_idx on time_highlights(user_id);
create index system_slots_user_id_idx on system_slots(user_id);
create index system_slots_start_abs_idx on system_slots(start_abs);

-- Function to automatically set updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to automatically update updated_at on events
create trigger update_events_updated_at
  before update on events
  for each row
  execute function update_updated_at_column();