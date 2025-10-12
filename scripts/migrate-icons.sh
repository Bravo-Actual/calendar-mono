#!/bin/bash

# Fluent Icons Migration Script
# Replaces Lucide icons with Fluent icons across the codebase

echo "🔄 Starting icon migration from Lucide to Fluent..."

# Define the root directory
ROOT_DIR="/Users/mbrasket/dev/calendar-mono/apps/calendar/src"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to replace icons in files
replace_icons() {
  echo -e "${BLUE}Replacing icon imports and usages...${NC}"

  # Find all TypeScript/TSX files
  find "$ROOT_DIR" -type f \( -name "*.ts" -o -name "*.tsx" \) | while read -r file; do
    # Skip if file doesn't contain lucide-react
    if ! grep -q "from 'lucide-react'" "$file"; then
      continue
    fi

    echo "Processing: $file"

    # Common replacements (Regular variant only - no state changes)
    sed -i '' 's/Plus/Add20Regular/g' "$file"
    sed -i '' 's/Trash2/Delete20Regular/g' "$file"
    sed -i '' 's/\bX\b/Dismiss20Regular/g' "$file"
    sed -i '' 's/XIcon/Dismiss20Regular/g' "$file"
    sed -i '' 's/Check\b/Checkmark20Regular/g' "$file"
    sed -i '' 's/CheckIcon/Checkmark20Regular/g' "$file"
    sed -i '' 's/ChevronDown\b/ChevronDown20Regular/g' "$file"
    sed -i '' 's/ChevronDownIcon/ChevronDown20Regular/g' "$file"
    sed -i '' 's/ChevronUp\b/ChevronUp20Regular/g' "$file"
    sed -i '' 's/ChevronUpIcon/ChevronUp20Regular/g' "$file"
    sed -i '' 's/ChevronLeft\b/ChevronLeft20Regular/g' "$file"
    sed -i '' 's/ChevronLeftIcon/ChevronLeft20Regular/g' "$file"
    sed -i '' 's/ChevronRight\b/ChevronRight20Regular/g' "$file"
    sed -i '' 's/ChevronRightIcon/ChevronRight20Regular/g' "$file"
    sed -i '' 's/Loader2/Spinner20Regular/g' "$file"
    sed -i '' 's/Loader2Icon/Spinner20Regular/g' "$file"
    sed -i '' 's/Search\b/Search20Regular/g' "$file"
    sed -i '' 's/SearchIcon/Search20Regular/g' "$file"
    sed -i '' 's/Video/Video20Regular/g' "$file"
    sed -i '' 's/PersonStanding/Person20Regular/g' "$file"
    sed -i '' 's/\bUser\b/Person20Regular/g' "$file"
    sed -i '' 's/Users/People20Regular/g' "$file"
    sed -i '' 's/MessageSquare/Comment20Regular/g' "$file"
    sed -i '' 's/MessageCircle/ChatBubble20Regular/g' "$file"
    sed -i '' 's/MessageCircleIcon/ChatBubble20Regular/g' "$file"
    sed -i '' 's/Clock/Clock20Regular/g' "$file"
    sed -i '' 's/Calendar/Calendar20Regular/g' "$file"
    sed -i '' 's/\bTag\b/Tag20Regular/g' "$file"
    sed -i '' 's/\bBell\b/Alert20Regular/g' "$file"
    sed -i '' 's/Globe/Globe20Regular/g' "$file"
    sed -i '' 's/\bZap\b/Flash20Regular/g' "$file"
    sed -i '' 's/\bBot\b/Bot20Regular/g' "$file"
    sed -i '' 's/BotIcon/Bot20Regular/g' "$file"
    sed -i '' 's/Brain\b/Brain20Regular/g' "$file"
    sed -i '' 's/BrainIcon/Brain20Regular/g' "$file"
    sed -i '' 's/Sparkles/Sparkle20Regular/g' "$file"
    sed -i '' 's/ArrowRight\b/ArrowRight20Regular/g' "$file"
    sed -i '' 's/ArrowRightIcon/ArrowRight20Regular/g' "$file"
    sed -i '' 's/ArrowLeft\b/ArrowLeft20Regular/g' "$file"
    sed -i '' 's/ArrowLeftIcon/ArrowLeft20Regular/g' "$file"
    sed -i '' 's/ArrowDown\b/ArrowDown20Regular/g' "$file"
    sed -i '' 's/ArrowDownIcon/ArrowDown20Regular/g' "$file"
    sed -i '' 's/\bBook\b/Book20Regular/g' "$file"
    sed -i '' 's/BookIcon/Book20Regular/g' "$file"
    sed -i '' 's/\bBox\b/Box20Regular/g' "$file"
    sed -i '' 's/Camera/Camera20Regular/g' "$file"
    sed -i '' 's/Command/Keyboard20Regular/g' "$file"
    sed -i '' 's/\bCopy\b/Copy20Regular/g' "$file"
    sed -i '' 's/CopyIcon/Copy20Regular/g' "$file"
    sed -i '' 's/\bDot\b/CircleSmall20Regular/g' "$file"
    sed -i '' 's/DotIcon/CircleSmall20Regular/g' "$file"
    sed -i '' 's/\bEdit\b/Edit20Regular/g' "$file"
    sed -i '' 's/ExternalLink/Open20Regular/g' "$file"
    sed -i '' 's/ExternalLinkIcon/Open20Regular/g' "$file"
    sed -i '' 's/\bEye\b/Eye20Regular/g' "$file"
    sed -i '' 's/EyeOff/EyeOff20Regular/g' "$file"
    sed -i '' 's/GripVertical/ReOrder20Regular/g' "$file"
    sed -i '' 's/GripVerticalIcon/ReOrder20Regular/g' "$file"
    sed -i '' 's/Minus\b/Subtract20Regular/g' "$file"
    sed -i '' 's/MinusIcon/Subtract20Regular/g' "$file"
    sed -i '' 's/MoreHorizontal/MoreHorizontal20Regular/g' "$file"
    sed -i '' 's/MoreHorizontalIcon/MoreHorizontal20Regular/g' "$file"
    sed -i '' 's/PanelLeft/PanelLeft20Regular/g' "$file"
    sed -i '' 's/PanelLeftIcon/PanelLeft20Regular/g' "$file"
    sed -i '' 's/RotateCw/ArrowClockwise20Regular/g' "$file"
    sed -i '' 's/Target/Target20Regular/g' "$file"
    sed -i '' 's/Upload/ArrowUpload20Regular/g' "$file"
    sed -i '' 's/ZoomIn/ZoomIn20Regular/g' "$file"
    sed -i '' 's/GalleryVerticalEnd/AppsList20Regular/g' "$file"
    sed -i '' 's/ChevronsUpDown/ChevronUpDown20Regular/g' "$file"
    sed -i '' 's/\bCircle\b/Circle20Regular/g' "$file"
    sed -i '' 's/CircleIcon/Circle20Regular/g' "$file"

    # Replace the import statement
    sed -i '' "s/from 'lucide-react'/from '@fluentui\/react-icons'/g" "$file"

    # Replace type imports
    sed -i '' 's/type LucideIcon/type FluentIcon/g' "$file"
    sed -i '' 's/import.*LucideIcon/import type { FluentIcon }/g' "$file"

  done

  echo -e "${GREEN}✅ Icon replacements complete!${NC}"
}

# Run the replacement
replace_icons

echo -e "${GREEN}🎉 Migration complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Review the changes with 'git diff'"
echo "2. Test the application"
echo "3. Fix any icons that need Filled variants for active states"
echo "4. Remove lucide-react from package.json"
