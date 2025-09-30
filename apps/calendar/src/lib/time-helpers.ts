/**
 * Helper functions for time formatting using date-fns
 */

import {
  differenceInMinutes,
  format,
  formatDistanceToNow,
  isThisWeek,
  isThisYear,
  isToday,
  isYesterday,
} from 'date-fns';

/**
 * Format a timestamp into a friendly relative time or date
 * - "just now" for < 1 minute
 * - "X minutes ago" for < 1 hour
 * - "12:45 PM" for today
 * - "Yesterday" for yesterday
 * - "Mon" for this week
 * - "Dec 15" for this year
 * - "Dec 15, 2023" for older
 */
export function getFriendlyTime(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return '';

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const minutesDiff = differenceInMinutes(now, date);

  // Less than 1 minute
  if (minutesDiff < 1) {
    return 'just now';
  }

  // Less than 60 minutes - use relative time
  if (minutesDiff < 60) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  // Today - show time
  if (isToday(date)) {
    return format(date, 'h:mm a'); // "3:30 PM"
  }

  // Yesterday
  if (isYesterday(date)) {
    return 'Yesterday';
  }

  // This week - show day name
  if (isThisWeek(date, { weekStartsOn: 1 })) {
    // Monday as start of week
    return format(date, 'EEE'); // "Mon", "Tue", etc.
  }

  // This year - show month and day
  if (isThisYear(date)) {
    return format(date, 'MMM d'); // "Dec 15"
  }

  // Older - show full date
  return format(date, 'MMM d, yyyy'); // "Dec 15, 2023"
}

/**
 * Get a short snippet from message content for display
 */
export function getMessageSnippet(content: any, maxLength: number = 50): string {
  if (!content) return '';

  let text = '';

  if (typeof content === 'string') {
    text = content;
  } else if (typeof content === 'object') {
    // Handle structured content (like from AI messages)
    if (content.text) {
      text = content.text;
    } else if (content.parts && Array.isArray(content.parts)) {
      // Find first text part
      const textPart = content.parts.find((part: any) => part.type === 'text');
      text = textPart?.text || '';
    } else {
      text = JSON.stringify(content);
    }
  }

  // Clean up and truncate
  text = text.replace(/\n/g, ' ').trim();
  if (text.length > maxLength) {
    return `${text.substring(0, maxLength)}...`;
  }
  return text;
}
