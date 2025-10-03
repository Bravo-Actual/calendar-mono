#!/bin/bash

# Get current hostname (use .local for mDNS/Bonjour)
NETWORK_HOST=$(hostname)

if [ -z "$NETWORK_HOST" ]; then
    echo "❌ Could not detect hostname"
    exit 1
fi

echo "🌐 Using hostname: $NETWORK_HOST"

# Supabase local development keys
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

# Update hostname in .env.network files (preserving existing files if they have API keys)
sed -i.bak "s|http://[^:]*:|http://$NETWORK_HOST:|g" apps/calendar/.env.network apps/calendar-ai/.env.network 2>/dev/null || true
rm -f apps/calendar/.env.network.bak apps/calendar-ai/.env.network.bak 2>/dev/null || true

echo "✅ Updated .env.network files with hostname: $NETWORK_HOST"