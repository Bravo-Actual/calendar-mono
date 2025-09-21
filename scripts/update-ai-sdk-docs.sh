#!/bin/bash

# Script to update AI SDK documentation from Vercel's repository
# This fetches the latest docs from https://github.com/vercel/ai/tree/main/content

set -e

echo "📚 Updating AI SDK documentation..."

# Create temp directory
TEMP_DIR=$(mktemp -d)
echo "Using temp directory: $TEMP_DIR"

# Clone the repository with sparse checkout (only content folder)
echo "📥 Fetching latest documentation from Vercel AI SDK..."
cd "$TEMP_DIR"
git clone --depth 1 --filter=blob:none --sparse https://github.com/vercel/ai.git ai-docs-temp
cd ai-docs-temp
git sparse-checkout set content

# Get the project root (where this script is called from)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCS_DIR="$PROJECT_ROOT/docs/ai-sdk"

# Backup existing docs (optional)
if [ -d "$DOCS_DIR" ]; then
    echo "📦 Backing up existing documentation..."
    rm -rf "$DOCS_DIR.backup"
    cp -r "$DOCS_DIR" "$DOCS_DIR.backup"
fi

# Copy new documentation
echo "📝 Updating documentation files..."
rm -rf "$DOCS_DIR"
mkdir -p "$DOCS_DIR"
cp -r "$TEMP_DIR/ai-docs-temp/content/"* "$DOCS_DIR/"

# Count files
FILE_COUNT=$(find "$DOCS_DIR" -type f -name "*.mdx" | wc -l | tr -d ' ')
echo "✅ Successfully updated $FILE_COUNT MDX documentation files"

# Get latest commit info from AI SDK repo
cd "$TEMP_DIR/ai-docs-temp"
LATEST_COMMIT=$(git rev-parse --short HEAD)
COMMIT_DATE=$(git log -1 --format=%cd --date=short)
echo "📌 Updated to AI SDK commit: $LATEST_COMMIT ($COMMIT_DATE)"

# Clean up
rm -rf "$TEMP_DIR"

echo "🎉 AI SDK documentation update complete!"
echo "   Location: $DOCS_DIR"
echo "   Backup: $DOCS_DIR.backup (if existed)"