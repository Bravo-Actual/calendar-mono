#!/bin/bash

# Script to regenerate Supabase types after database schema changes
# This ensures we have a single source of truth for database types

echo "🔄 Regenerating Supabase types..."

# Generate types to the shared package location
npx supabase gen types typescript --local 2>/dev/null > packages/supabase/database.types.ts

if [ $? -eq 0 ]; then
    echo "✅ Types regenerated successfully in packages/supabase/database.types.ts"
    echo "📦 All apps will use the updated types via @repo/supabase"
else
    echo "❌ Failed to regenerate types"
    exit 1
fi