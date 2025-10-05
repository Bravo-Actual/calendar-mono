import { MCPServer } from '@mastra/mcp';
import { navigateCalendarMCP } from './tools/calendar-navigation-mcp.js';
import { getCalendarEventsMCP, updateCalendarEventMCP } from './tools/event-management-mcp.js';
import { findFreeTimeMCP } from './tools/free-time-mcp.js';
import {
  createUserCalendarMCP,
  deleteUserCalendarMCP,
  getUserCalendarsMCP,
  updateUserCalendarMCP,
} from './tools/user-calendars-mcp.js';
import {
  createUserCategoryMCP,
  deleteUserCategoryMCP,
  getUserCategoriesMCP,
  updateUserCategoryMCP,
} from './tools/user-categories-mcp.js';
import {
  getUserTimeSettingsMCP,
  updateUserTimeSettingsMCP,
} from './tools/user-time-settings-mcp.js';

export const calendarUserSettingsMCPServer = new MCPServer({
  name: 'calendarUserSettings',
  description:
    'Calendar user settings, calendars, categories, event management, free time analysis, and navigation server',
  version: '1.0.0',
  tools: {
    getUserTimeSettings: getUserTimeSettingsMCP,
    updateUserTimeSettings: updateUserTimeSettingsMCP,
    getUserCalendars: getUserCalendarsMCP,
    createUserCalendar: createUserCalendarMCP,
    updateUserCalendar: updateUserCalendarMCP,
    deleteUserCalendar: deleteUserCalendarMCP,
    getUserCategories: getUserCategoriesMCP,
    createUserCategory: createUserCategoryMCP,
    updateUserCategory: updateUserCategoryMCP,
    deleteUserCategory: deleteUserCategoryMCP,
    getCalendarEvents: getCalendarEventsMCP,
    updateCalendarEvent: updateCalendarEventMCP,
    findFreeTime: findFreeTimeMCP,
    navigateCalendar: navigateCalendarMCP,
  },
  resources: {},
});
