/**
 * Calendar Navigation Tool Handler
 * Handles calendar view navigation requests
 */

import type { ToolHandler, ToolHandlerContext, NavigationToolArgs, ToolResult } from '../types'

export const navigationToolHandler: ToolHandler = {
  async execute(rawArgs: Record<string, unknown>, context: ToolHandlerContext): Promise<ToolResult> {
    const args = rawArgs as NavigationToolArgs

    try {
      // For now, this is a client-side tool that just returns the navigation parameters
      // The actual navigation would be handled by the UI component that receives this result

      let result: Record<string, unknown>

      if (args.dates && Array.isArray(args.dates)) {
        // Navigate to specific dates
        result = {
          action: 'navigate',
          type: 'specific_dates',
          dates: args.dates,
          timezone: args.timezone
        }
      } else if (args.startDate && args.endDate) {
        // Navigate to date range
        result = {
          action: 'navigate',
          type: 'date_range',
          startDate: args.startDate,
          endDate: args.endDate,
          timezone: args.timezone
        }
      } else if (args.startDate) {
        // Navigate to single date
        result = {
          action: 'navigate',
          type: 'single_date',
          date: args.startDate,
          timezone: args.timezone
        }
      } else {
        return {
          success: false,
          error: 'No valid navigation parameters provided. Need dates, or startDate/endDate, or startDate alone.'
        }
      }

      return { success: true, data: result }
    } catch (error) {
      console.error('Navigation tool error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}