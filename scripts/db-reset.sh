#!/bin/bash

# Database reset script that ensures types are always regenerated
# This prevents type mismatches between database schema and TypeScript

echo "🔄 Resetting database and regenerating types..."

# Reset the database
echo "📦 Resetting database..."
npx supabase db reset

if [ $? -ne 0 ]; then
    echo "❌ Failed to reset database"
    exit 1
fi

# Always regenerate types after database changes
echo "🔄 Regenerating TypeScript types..."
npx supabase gen types typescript --local 2>/dev/null > packages/supabase/database.types.ts

if [ $? -eq 0 ]; then
    echo "✅ Database reset and types regenerated successfully!"
    echo "📍 Types location: packages/supabase/database.types.ts"
    echo "📦 Import from: @repo/supabase"

    # Remove any duplicate type files to prevent confusion
    if [ -f "apps/calendar/src/lib/database.types.ts" ]; then
        echo "🗑️  Removing duplicate types file: apps/calendar/src/lib/database.types.ts"
        rm apps/calendar/src/lib/database.types.ts
    fi
else
    echo "❌ Failed to regenerate types"
    exit 1
fi

echo ""
echo "✨ Database is ready! Types are up to date."