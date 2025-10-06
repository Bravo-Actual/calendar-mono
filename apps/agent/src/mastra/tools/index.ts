// Domain-based tool exports
// Tools are organized by data domain for clarity and maintainability

// Events domain - calendar event CRUD operations
export {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
} from './events/calendar-events.js';
export { searchCalendarEvents } from './events/search-calendar-events.js';

// Navigation domain - calendar UI navigation (client-side execution)
// Also exposed via MCP server for external clients
export { navigateToEvent } from './navigation/navigate-to-event.js';
export { navigateToWorkWeek } from './navigation/navigate-to-work-week.js';
export { navigateToWeek } from './navigation/navigate-to-week.js';
export { navigateToDateRange } from './navigation/navigate-to-date-range.js';
export { navigateToDates } from './navigation/navigate-to-dates.js';

// Time domain - time analysis and scheduling
export { findFreeTime } from './time/time-analysis.js';

// User Calendars domain - user calendar management
export {
  createUserCalendarTool,
  deleteUserCalendarTool,
  getUserCalendarsTool,
  updateUserCalendarTool,
} from './user-calendars/index.js';

// User Categories domain - event category management
export {
  createUserCategoryTool,
  deleteUserCategoryTool,
  getUserCategoriesTool,
  updateUserCategoryTool,
} from './user-categories/index.js';

// User Settings domain - user preferences and configuration
export {
  getUserTimeSettingsTool,
  updateUserTimeSettingsTool,
} from './user-settings/index.js';

// Annotations domain - AI-generated highlights and notes (mostly client-side)
// These are primarily handled client-side but kept here for reference
// export { aiCalendarHighlightsTool } from './annotations/ai-calendar-highlights.js';
