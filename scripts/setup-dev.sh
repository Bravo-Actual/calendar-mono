#!/bin/bash

# Calendar Mono - Development Setup Script
# This script automates the initial setup for new developers

set -e

echo "🚀 Calendar Mono - Development Setup"
echo "===================================="
echo ""

# Check Node.js version
echo "📌 Checking Node.js version..."
NODE_VERSION=$(node -v)
REQUIRED_NODE="20.9.0"
if [ "$(printf '%s\n' "$REQUIRED_NODE" "${NODE_VERSION#v}" | sort -V | head -n1)" != "$REQUIRED_NODE" ]; then
    echo "❌ Node.js version ${NODE_VERSION} is below required version v${REQUIRED_NODE}"
    echo "   Please install Node.js >= ${REQUIRED_NODE}"
    exit 1
fi
echo "✅ Node.js ${NODE_VERSION} detected"

# Check for pnpm
echo "📌 Checking for pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed"
    echo "   Installing pnpm..."
    npm install -g pnpm@9.0.0
fi
echo "✅ pnpm $(pnpm -v) detected"

# Check for Docker
echo "📌 Checking for Docker..."
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed"
    echo "   Docker is required for Supabase local development"
    echo "   Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    echo ""
    read -p "Continue without Docker? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Docker detected"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Setup environment files
echo ""
echo "🔐 Setting up environment files..."

# Setup calendar app .env.local
if [ ! -f apps/calendar/.env.local ]; then
    echo "   Creating apps/calendar/.env.local..."
    cp apps/calendar/.env.example apps/calendar/.env.local

    # For local dev, use the standard Supabase local keys
    sed -i.bak 's/your_supabase_anon_key_here/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0/g' apps/calendar/.env.local
    rm apps/calendar/.env.local.bak
    echo "   ✅ Created apps/calendar/.env.local"
else
    echo "   ✅ apps/calendar/.env.local already exists"
fi

# Setup calendar-ai app .env.local
if [ ! -f apps/calendar-ai/.env.local ]; then
    echo "   Creating apps/calendar-ai/.env.local..."
    cp apps/calendar-ai/.env.example apps/calendar-ai/.env.local

    # For local dev, use the standard Supabase local keys
    sed -i.bak 's/your_supabase_anon_key_here/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0/g' apps/calendar-ai/.env.local
    sed -i.bak 's/your_supabase_jwt_secret_here/super-secret-jwt-token-with-at-least-32-characters-long/g' apps/calendar-ai/.env.local
    rm apps/calendar-ai/.env.local.bak
    echo "   ✅ Created apps/calendar-ai/.env.local"
else
    echo "   ✅ apps/calendar-ai/.env.local already exists"
fi

# Check for OpenRouter API key
echo ""
echo "🤖 OpenRouter API Key Setup"
echo "   The AI features require an OpenRouter API key"
echo "   Get your key at: https://openrouter.ai/keys"
echo ""
read -p "Do you have an OpenRouter API key? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your OpenRouter API key: " OPENROUTER_KEY
    if [ ! -z "$OPENROUTER_KEY" ]; then
        # Update both .env.local files with the API key
        sed -i.bak "s/your_openrouter_api_key_here/$OPENROUTER_KEY/g" apps/calendar/.env.local 2>/dev/null || true
        sed -i.bak "s/your_openrouter_api_key_here/$OPENROUTER_KEY/g" apps/calendar-ai/.env.local 2>/dev/null || true
        rm -f apps/calendar/.env.local.bak apps/calendar-ai/.env.local.bak
        echo "   ✅ OpenRouter API key configured"
    fi
else
    echo "   ⚠️  Skipping - AI features will not work without an API key"
fi

# Start Supabase
if command -v docker &> /dev/null; then
    echo ""
    echo "🗄️  Starting Supabase local development..."
    npx supabase start

    # Run migrations
    echo ""
    echo "📊 Running database migrations..."
    npx supabase db reset --linked

    # Generate TypeScript types
    echo ""
    echo "📝 Generating TypeScript types..."
    cd packages/supabase && pnpm types:generate && cd ../..

    echo ""
    echo "✅ Supabase is running!"
    echo "   Studio: http://127.0.0.1:55323"
    echo "   API: http://127.0.0.1:55321"
fi

# Final instructions
echo ""
echo "======================================"
echo "🎉 Setup Complete!"
echo ""
echo "To start development:"
echo "  pnpm dev             # Start all services"
echo "  pnpm dev:calendar    # Start frontend only"
echo "  pnpm dev:calendar-ai # Start LangGraph agent only"
echo ""
echo "Services will run on:"
echo "  Frontend:       http://localhost:3010"
echo "  LangGraph Agent: http://localhost:3030"
echo ""
if [ -z "$OPENROUTER_KEY" ]; then
    echo "⚠️  Remember to add your OpenRouter API key to the .env.local files"
    echo "   for AI features to work!"
    echo ""
fi
echo "Happy coding! 🚀"