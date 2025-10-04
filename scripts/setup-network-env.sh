#!/bin/bash

# Get hostname (more stable than IP address)
NETWORK_HOST=$(hostname -s).local

if [ -z "$NETWORK_HOST" ]; then
    echo "❌ Could not detect hostname"
    exit 1
fi

echo "🌐 Using hostname: $NETWORK_HOST"

# Check if .env.network exists and preserve secrets
ENV_FILE="apps/agent/.env.network"
TEMP_FILE=$(mktemp)

# Extract existing secrets if file exists
EXISTING_OPENROUTER_KEY=""
EXISTING_SUPABASE_ANON_KEY=""
EXISTING_SUPABASE_SERVICE_ROLE_KEY=""
EXISTING_SUPABASE_JWT_SECRET=""

if [ -f "$ENV_FILE" ]; then
    echo "📋 Preserving existing secrets from .env.network"
    EXISTING_OPENROUTER_KEY=$(grep "^OPENROUTER_API_KEY=" "$ENV_FILE" | cut -d'=' -f2-)
    EXISTING_SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" "$ENV_FILE" | cut -d'=' -f2-)
    EXISTING_SUPABASE_SERVICE_ROLE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" "$ENV_FILE" | cut -d'=' -f2-)
    EXISTING_SUPABASE_JWT_SECRET=$(grep "^SUPABASE_JWT_SECRET=" "$ENV_FILE" | cut -d'=' -f2-)
fi

# Use existing secrets or fallback to defaults
OPENROUTER_KEY=${EXISTING_OPENROUTER_KEY:-"# OPENROUTER_API_KEY=your-key-here"}
SUPABASE_ANON_KEY=${EXISTING_SUPABASE_ANON_KEY:-"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"}
SUPABASE_SERVICE_ROLE_KEY=${EXISTING_SUPABASE_SERVICE_ROLE_KEY:-"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"}
SUPABASE_JWT_SECRET=${EXISTING_SUPABASE_JWT_SECRET:-"super-secret-jwt-token-with-at-least-32-characters-long"}

# Create updated .env.network file with preserved secrets
cat > "$ENV_FILE" << EOF
# Network Development Environment
# For access from other machines on your local network
# Auto-generated with hostname: $NETWORK_HOST

# Agent Service Configuration
NODE_ENV=development
PORT=3020

# OpenRouter AI Configuration
OPENROUTER_API_KEY=$OPENROUTER_KEY

# Supabase Configuration
# For network development - accessible from other machines on local network
SUPABASE_URL=http://$NETWORK_HOST:55321
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET

# Database Configuration
# PostgreSQL connection string for Mastra's PostgresStore
DATABASE_URL=postgresql://postgres:postgres@$NETWORK_HOST:55322/postgres

# Service URLs
# URLs for cross-service communication on the network
APP_URL=http://$NETWORK_HOST:3010
AGENT_URL=http://$NETWORK_HOST:3020
EOF

echo "✅ Updated apps/agent/.env.network with hostname: $NETWORK_HOST"
echo "🔐 Preserved existing secrets (if any were found)"