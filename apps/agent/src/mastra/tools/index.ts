// Domain-based tool exports
// Tools are organized by data domain for clarity and maintainability

// Events domain - calendar event CRUD operations
export {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
} from './events/calendar-events.js';

// Navigation domain - calendar UI navigation (client-side execution)
export { navigateCalendar } from './navigation/calendar-navigation.js';

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
