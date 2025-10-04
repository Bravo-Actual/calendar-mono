# Calendar Mono

An advanced AI-powered calendar application built with modern TypeScript stack, featuring intelligent scheduling assistants, dynamic personas, and seamless conversation management.

## 🚀 Features

- **AI-Powered Calendar Assistant** - Intelligent scheduling with persona-based responses
- **Dynamic Persona System** - Multiple AI personalities with custom traits and behaviors
- **Persistent Conversations** - Seamless chat history across sessions
- **Real-time Streaming** - Smooth AI responses with streaming technology
- **Advanced Calendar Views** - Expandable day views, drag & drop events, time blocking
- **Command Palette** - Quick actions via Ctrl+/ shortcut
- **Modern UI** - Clean, responsive design with smooth animations

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui
- **AI Agent**: Mastra v0.20+ framework with AI SDK v5
- **Database**: Supabase (PostgreSQL) with RLS
- **State Management**: Zustand + TanStack Query
- **Animations**: Framer Motion
- **AI Integration**: Custom MastraSupabaseStore adapter
- **Package Manager**: PNPM (required)

### Project Structure
```
calendar-mono/
├── apps/
│   ├── calendar/     # Next.js frontend (port 3010)
│   └── agent/        # Mastra AI service (port 3020)
├── docs/
│   └── api/          # AI SDK documentation
└── supabase/         # Database migrations & config
```

## 📦 Package Management

**⚠️ Important**: This project uses **PNPM** exclusively. Do not use npm or yarn.

```bash
# Install dependencies
pnpm install

# Add a package to specific workspace
pnpm --filter calendar add package-name
pnpm --filter agent add package-name
```

## 🛠️ Quick Start

### Automated Setup (Recommended)
```bash
# Clone the repository
git clone <your-repo-url>
cd calendar-mono

# Run the automated setup script
./scripts/setup-dev.sh
```

This script will:
- ✅ Check Node.js version (>=20.9.0)
- ✅ Install pnpm if needed
- ✅ Install all dependencies
- ✅ Create .env.local files from examples
- ✅ Configure Supabase local keys
- ✅ Start Supabase and run migrations
- ✅ Generate TypeScript types
- ✅ Prompt for OpenRouter API key

## 🛠️ Manual Development Setup

### Prerequisites
- Node.js >=20.9.0
- Docker (for Supabase)
- Git

### ⚡ Quick Start (New Developers)
```bash
# 1. Clone the repository
git clone <repo-url>
cd calendar-mono

# 2. Run automated setup (handles everything!)
npm run setup
```

The setup script will:
- ✅ Check Node.js version requirements
- ✅ Install PNPM if needed
- ✅ Verify Docker is running
- ✅ Install all dependencies
- ✅ Copy environment file templates
- ✅ Start Supabase and setup database
- ✅ Optionally start development servers

### Manual Setup (Alternative)
```bash
# 1. Clone and install
git clone <repo-url>
cd calendar-mono
pnpm install

# 2. Copy environment files
cp apps/calendar/.env.example apps/calendar/.env.local
cp apps/agent/.env.example apps/agent/.env.local

# 3. Start Supabase (required first)
npx supabase start

# 4. Setup database
npx supabase db reset

# 5. Start all development servers
pnpm dev

# Individual services (alternative)
cd apps/calendar && pnpm dev  # Frontend on :3010
cd apps/agent && pnpm dev    # AI agent on :3020
```

### 🔑 API Keys Configuration
For AI features to work, you'll need to configure API keys:

1. **OpenRouter API Key** (Required for AI chat):
   - Sign up at https://openrouter.ai/keys
   - Add your key to both `.env.local` files:
     ```bash
     # Replace "your_openrouter_api_key_here" with your actual key
     NEXT_PUBLIC_OPENROUTER_API_KEY=sk-or-v1-your-actual-key
     OPENROUTER_API_KEY=sk-or-v1-your-actual-key
     ```

### Environment URLs
- **Frontend**: http://localhost:3010
- **AI Agent API**: http://localhost:3020 (Swagger: /api/docs)
- **Supabase Studio**: http://127.0.0.1:55323
- **Database**: postgresql://postgres:postgres@127.0.0.1:55322/postgres

## 🤖 AI Features

### Persona System
- **Dynamic Personalities**: Each AI assistant has unique traits, communication style, and expertise
- **Model Flexibility**: Support for multiple LLM providers (OpenAI, OpenRouter, etc.)
- **Temperature Control**: Fine-tune response creativity per persona
- **Memory Persistence**: Conversations remember context across sessions

### Conversation Management
- **Smart Threading**: Conversations automatically linked to personas
- **Message Persistence**: Full chat history stored in Supabase
- **Seamless Switching**: Jump between conversations without losing context
- **Title Generation**: Automatic conversation titles via Mastra

### Streaming & Performance
- **Real-time Responses**: AI SDK v5 with DefaultChatTransport for smooth streaming
- **Optimized Memory**:
  - calendar-assistant-agent: Working memory disabled to prevent multiple LLM calls
  - cal-agent: Resource-level working memory for user preferences
- **Smart Caching**: 24-hour persona cache with intelligent invalidation
- **Custom Storage**: MastraSupabaseStore with JWT-based RLS enforcement
- **Message Format**: AI SDK v5 (v2) format with content.parts structure
- **Error Recovery**: Graceful handling of network issues

## 🗄️ Database Schema

### Key Tables
- **ai_personas** - AI personality configurations
- **ai_threads** - Mastra conversation threads (resourceId = userId:personaId)
- **ai_messages** - Mastra messages with v2 format
- **ai_memory** - Working memory storage (resource and thread level)
- **events** - Calendar events with AI suggestions
- **user_annotations** - AI time highlights and suggestions
- **users** - User profiles and preferences

### Development Database
```bash
# Reset database with latest schema
npx supabase db reset

# Access Supabase Studio
open http://127.0.0.1:55323

# View tables via Docker (preferred for debugging)
docker exec -it supabase_db_calendar-mono psql -U postgres -d postgres
```

## 🔧 Development Commands

### Core Development
```bash
# Start all services
pnpm dev

# Build for production
pnpm build

# Run type checking
pnpm type-check

# Lint code
pnpm lint
```

### Database Management
```bash
# Start Supabase
npx supabase start

# Stop Supabase
npx supabase stop

# Reset database with migrations
npx supabase db reset

# Generate TypeScript types
npx supabase gen types typescript --local > types/supabase.ts
```

### Process Management (Windows)
```bash
# Find process using port
netstat -ano | findstr :3020

# Kill process (use Windows format)
taskkill //PID 12345 //F

# Don't try to delete Mastra lock files - kill the process instead
```

## 🚨 Troubleshooting

### Setup Issues
- **Node.js version**: Ensure you have Node.js >=20.9.0 installed
- **PNPM not found**: Run `npm install -g pnpm` to install globally
- **Docker not running**: Start Docker Desktop before running setup
- **Permission errors**: On Windows, run terminal as Administrator if needed
- **Environment files**: Make sure `.env.local` files are created from `.env.example`

### Port Conflicts
- **Port 3020 in use**: Kill the process, don't delete lock files
- **Supabase conflicts**: Ensure Docker is running, check port 55321-55327
- **Frontend issues**: Clear Next.js cache with `rm -rf .next`

### API Key Issues
- **AI features not working**: Check that OpenRouter API key is correctly set in both `.env.local` files
- **Invalid API key**: Verify your key at https://openrouter.ai/keys
- **Missing key**: Replace placeholder values in environment files

### AI Agent Issues
- **Multiple responses**: Check that working memory is disabled in calendar-assistant-agent config
- **Persona not working**: Verify persona data is sent in `data` block with kebab-case keys
- **Memory issues**: Ensure resourceId format is `userId:personaId`
- **Message storage failing**: Check that userId and personaId are in runtime context
- **RLS errors**: Verify JWT token is being passed in Authorization header

### Database Issues
- **Connection errors**: Restart Supabase with `npx supabase stop && npx supabase start`
- **Migration failures**: Reset database with `npx supabase db reset`
- **Type errors**: Regenerate types after schema changes
- **Supabase won't start**: Check Docker is running and ports 55321-55327 are available

### Development Server Issues
- **Services won't start**: Run the setup script again with `npm run setup`
- **Build failures**: Clear node_modules and reinstall with `rm -rf node_modules && pnpm install`
- **Hot reload not working**: Restart development servers with `pnpm dev`

## 📚 Documentation

### Framework Documentation
- **Mastra**: Use the MCP server for latest Mastra docs and examples
- **AI SDK**: Reference `docs/api/` directory for React AI SDK patterns
- **Supabase**: https://supabase.com/docs
- **Next.js**: https://nextjs.org/docs

### Key Files
- `CLAUDE.md` - Comprehensive development guide
- `docs/api/ai_sdk_usechat.md` - Chat implementation patterns
- `apps/agent/src/mastra/index.ts` - Main agent configuration
- `apps/calendar/src/components/ai-assistant-panel.tsx` - Chat UI

## 🚀 Deployment

### Build & Deploy
```bash
# Build all apps
pnpm build

# Deploy calendar app (Vercel)
cd apps/calendar && vercel

# Deploy agent (your hosting provider)
cd apps/agent && pnpm build && pnpm start
```

### Environment Variables
Required for production:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_JWT_SECRET` - JWT secret for auth
- `OPENAI_API_KEY` - Or your preferred LLM provider
- `DATABASE_URL` - PostgreSQL connection string

## 🤝 Contributing

1. **Use PNPM**: Only use pnpm for package management
2. **Follow Conventions**: Check existing code style and patterns
3. **Test Locally**: Ensure all services start and work together
4. **Update Docs**: Keep README and CLAUDE.md current

## 🔗 Resources

- **Project Documentation**: See `CLAUDE.md` for detailed development notes
- **Mastra Framework**: https://mastra.ai
- **AI SDK React**: https://sdk.vercel.ai/docs
- **Supabase Platform**: https://supabase.com
- **Turborepo**: https://turborepo.org

---

Built with ❤️ using PNPM, TypeScript, and modern web technologies.