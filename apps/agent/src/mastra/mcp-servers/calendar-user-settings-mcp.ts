import { MCPServer } from '@mastra/mcp';
import { getUserTimeSettingsMCP, updateUserTimeSettingsMCP } from './tools/user-time-settings-mcp.js';
import { getUserCalendarsMCP, createUserCalendarMCP, updateUserCalendarMCP, deleteUserCalendarMCP } from './tools/user-calendars-mcp.js';
import { getUserCategoriesMCP, createUserCategoryMCP, updateUserCategoryMCP, deleteUserCategoryMCP } from './tools/user-categories-mcp.js';
import { updateCalendarEventMCP, getCalendarEventsMCP } from './tools/event-management-mcp.js';

export const calendarUserSettingsMCPServer = new MCPServer({
  name: 'calendarUserSettings',
  description: 'Calendar user settings, calendars, categories, and event management server',
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
  },
  resources: {},
});