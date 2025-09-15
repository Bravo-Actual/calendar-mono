# Calendar Mono - Claude Development Notes

## Project Overview
Advanced calendar application built with Next.js, TypeScript, Supabase, and modern React patterns. Features expandable day views, AI-suggested events, command palette, and smooth animations.

## Architecture
- **Frontend**: Next.js 15 with TypeScript
- **UI**: shadcn/ui components with Tailwind CSS
- **Animations**: Framer Motion
- **State Management**: Zustand with persistence
- **Database**: Supabase (PostgreSQL) with local development
- **API**: Supabase REST API (with pg_graphql available)

## Development Setup
**Package Management**: We use PNPM for package management. Do not install shit with other package managers unless I authorize it!


### Prerequisites
- Node.js and pnpm
- Docker (for Supabase local development)
- Supabase CLI (available via npx)

### Getting Started
```bash
# Start the development server
pnpm dev

# Start Supabase local instance
npx supabase start

# Apply database migrations
npx supabase db reset

# Stop Supabase
npx supabase stop
```

### Environment Configuration
- **Frontend Dev Server**: http://localhost:3010
- **Supabase API**: http://127.0.0.1:55321
- **Supabase GraphQL**: http://127.0.0.1:55321/graphql/v1
- **Supabase Studio**: http://127.0.0.1:55323
- **Database**: postgresql://postgres:postgres@127.0.0.1:55322/postgres

### Supabase Keys (Local Development)
```
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

## Key Features Implemented

### 1. Calendar Core Components
- **CalendarWeek**: Main calendar container with week/workweek view
- **DayColumn**: Individual day column with grid lines and events
- **EventCard**: Event display with category colors, meeting types, drag/resize
- **ActionBar**: Event management actions with animations
- **NowMoment**: Current time indicator

### 2. Expandable Day View
- Click day headers to expand single day to full width
- Smooth framer-motion animations with spring physics
- Flexbox-based layout maintains grid integrity
- Toggle between expanded and collapsed states

### 3. Event Card Animations
- AnimatePresence for enter/exit animations during navigation
- Subtle scale transitions (0.95→1 enter, 1→0.9 exit)
- Staggered timing (20ms delay between cards)
- Unique keys based on event ID + date for proper exit animations

### 4. Command Palette
- **Trigger**: Ctrl+/ to open, Escape to close
- **Search**: Filter commands, support for '/' commands and '?'/'ai:' AI queries
- **Built-in Commands**:
  - Create Event (Ctrl+N) - Ready for implementation
  - Toggle View (V) - Working! Switches 5-day/7-day
  - Go Today (T) - Ready for implementation
  - Settings - Ready for implementation
- **State Management**: Zustand store with command palette state
- **Animations**: Smooth scale/fade with framer-motion

### 5. State Management (Zustand)
- **App State**: Date selection, days (5/7), sidebar state
- **Command Palette State**: Query, results, loading, navigation
- **Persistence**: Days selection and sidebar state saved to localStorage

### 6. Event System
- **Types**: Full TypeScript interfaces for events, time ranges, drag states
- **Categories**: 10 color categories (neutral, slate, orange, yellow, green, blue, indigo, violet, fuchsia, rose)
- **Meeting Types**: Online/in-person indicators
- **AI Suggestions**: Special gradient border styling
- **Drag & Drop**: Move and resize with snap-to-grid

## Database Schema

### Tables Created
```sql
-- Events table
CREATE TABLE events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  all_day boolean DEFAULT false,
  ai_suggested boolean DEFAULT false,
  show_time_as show_time_as DEFAULT 'busy',
  category event_category DEFAULT 'neutral',
  is_online_meeting boolean DEFAULT false,
  is_in_person boolean DEFAULT false,
  meta jsonb DEFAULT '{}',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Time highlights (AI suggestions)
CREATE TABLE time_highlights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  day_idx integer NOT NULL,
  start_ms_in_day bigint NOT NULL,
  end_ms_in_day bigint NOT NULL,
  intent text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- System slots (system suggestions)
CREATE TABLE system_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  start_abs timestamptz NOT NULL,
  end_abs timestamptz NOT NULL,
  reason text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
```

### Enums
```sql
CREATE TYPE event_category AS ENUM (
  'neutral', 'slate', 'orange', 'yellow', 'green',
  'blue', 'indigo', 'violet', 'fuchsia', 'rose'
);

CREATE TYPE show_time_as AS ENUM ('busy', 'tentative', 'free');
```

### Extensions
- `pg_graphql` enabled for GraphQL API access
- Row Level Security (RLS) enabled on all tables
- Indexes for performance on user_id and time fields

## File Structure
```
apps/calendar/src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── calendar-week.tsx    # Main calendar component
│   ├── day-column.tsx       # Day column with events
│   ├── event-card.tsx       # Individual event display
│   ├── action-bar.tsx       # Event actions toolbar
│   ├── command-palette.tsx  # Ctrl+/ command interface
│   └── types.ts            # TypeScript type definitions
├── store/
│   └── app.ts              # Zustand state management
├── lib/
│   └── utils.ts            # Utility functions
├── hooks/
│   └── useTimeSuggestions.ts # AI time suggestions hook
└── supabase/
    ├── config.toml         # Supabase local configuration
    └── migrations/         # Database migrations
```

## Key TypeScript Types
```typescript
interface CalEvent {
  id: EventId;
  title: string;
  start: number; // epoch ms UTC
  end: number;   // epoch ms UTC
  allDay?: boolean;
  aiSuggested?: boolean;
  showTimeAs?: ShowTimeAs;
  category?: EventCategory;
  isOnlineMeeting?: boolean;
  isInPerson?: boolean;
  meta?: Record<string, unknown>;
}

type EventCategory = "neutral" | "slate" | "orange" | "yellow" | "green" | "blue" | "indigo" | "violet" | "fuchsia" | "rose";
type ShowTimeAs = "busy" | "tentative" | "free";
```

## Recent Commits
1. `feat: add smooth event card animations for date navigation` - Event card enter/exit animations
2. `feat: implement command palette with Ctrl+/ shortcut` - Full command palette system with Zustand integration

## Next Steps / TODO
- [ ] Finalize database schema design
- [ ] Create Supabase client integration with TypeScript types
- [ ] Implement event CRUD operations
- [ ] Add authentication system
- [ ] Connect command palette actions to real functionality
- [ ] Add real-time collaboration features
- [ ] Implement AI time suggestions
- [ ] Add event search and filtering

## Development Notes
- Use custom ports (55321-55327) for Supabase to avoid conflicts with other projects
- Command palette uses cmdk library with shadcn/ui styling
- All animations use framer-motion with spring physics
- Event positioning uses complex layout algorithms for overlap handling
- Drag and drop supports both move and resize operations with snap-to-grid

## Package Dependencies
### Core
- `@supabase/supabase-js` - Database client
- `zustand` - State management
- `framer-motion` - Animations
- `@js-temporal/polyfill` - Date/time handling

### UI
- `@radix-ui/*` - Headless UI components
- `tailwindcss` - Styling
- `lucide-react` - Icons
- `cmdk` - Command palette functionality

## Testing
- Frontend available at http://localhost:3010
- Database accessible via Supabase Studio at http://127.0.0.1:55323
- GraphQL endpoint testable at http://127.0.0.1:55321/graphql/v1

## Performance Considerations
- Event positioning calculations are memoized
- AnimatePresence used for smooth transitions
- Database indexes on frequently queried fields
- Staggered animations to avoid overwhelming the browser