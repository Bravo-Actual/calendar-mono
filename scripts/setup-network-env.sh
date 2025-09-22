#!/bin/bash

# Get current network IP
NETWORK_IP=$(ipconfig getifaddr en0)

if [ -z "$NETWORK_IP" ]; then
    echo "❌ Could not detect network IP address"
    echo "Make sure you're connected to a network and en0 interface exists"
    exit 1
fi

echo "🌐 Detected network IP: $NETWORK_IP"

# Check if .env.network exists and preserve secrets
ENV_FILE="apps/agent/.env.network"
TEMP_FILE=$(mktemp)

# Extract existing secrets if file exists
EXISTING_OPENROUTER_KEY=""
EXISTING_SUPABASE_ANON_KEY=""
EXISTING_SUPABASE_JWT_SECRET=""

if [ -f "$ENV_FILE" ]; then
    echo "📋 Preserving existing secrets from .env.network"
    EXISTING_OPENROUTER_KEY=$(grep "^OPENROUTER_API_KEY=" "$ENV_FILE" | cut -d'=' -f2-)
    EXISTING_SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" "$ENV_FILE" | cut -d'=' -f2-)
    EXISTING_SUPABASE_JWT_SECRET=$(grep "^SUPABASE_JWT_SECRET=" "$ENV_FILE" | cut -d'=' -f2-)
fi

# Use existing secrets or fallback to defaults
OPENROUTER_KEY=${EXISTING_OPENROUTER_KEY:-"# OPENROUTER_API_KEY=your-key-here"}
SUPABASE_ANON_KEY=${EXISTING_SUPABASE_ANON_KEY:-"# SUPABASE_ANON_KEY=your-anon-key-here"}
SUPABASE_JWT_SECRET=${EXISTING_SUPABASE_JWT_SECRET:-"super-secret-jwt-token-with-at-least-32-characters-long"}

# Create updated .env.network file with preserved secrets
cat > "$ENV_FILE" << EOF
# Network Development Environment
# For access from other machines on your local network
# Auto-generated with current IP: $NETWORK_IP

# Agent Service Configuration
NODE_ENV=development
PORT=3020

# OpenRouter AI Configuration
OPENROUTER_API_KEY=$OPENROUTER_KEY

# Supabase Configuration
# For network development - accessible from other machines on local network
SUPABASE_URL=http://$NETWORK_IP:55321
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_JWT_SECRET=$SUPABASE_JWT_SECRET

# Database Configuration
# PostgreSQL connection string for Mastra's PostgresStore
DATABASE_URL=postgresql://postgres:postgres@$NETWORK_IP:55322/postgres

# Service URLs
# URLs for cross-service communication on the network
APP_URL=http://$NETWORK_IP:3010
AGENT_URL=http://$NETWORK_IP:3020
EOF

echo "✅ Updated apps/agent/.env.network with IP: $NETWORK_IP"
echo "🔐 Preserved existing secrets (if any were found)"