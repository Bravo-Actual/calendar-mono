/**
 * AI Calendar Highlights Tool Handler
 * Handles CRUD operations for calendar highlights/annotations
 */

import type { ToolHandler, ToolHandlerContext, HighlightToolArgs, ToolResult } from '../types'

export const highlightsToolHandler: ToolHandler = {
  async execute(rawArgs: Record<string, unknown>, context: ToolHandlerContext): Promise<ToolResult> {
    const args = rawArgs as HighlightToolArgs
    const { user, createAnnotation, updateAnnotation, deleteAnnotation, userAnnotations, getEventTimes } = context

    try {
      if (!user?.id) {
        throw new Error('User ID is required for highlight operations')
      }

      let result: Record<string, unknown> | null = null

      // Handle batch operations if provided
      if (args.operations && Array.isArray(args.operations)) {
        const results = []
        let totalCreated = 0
        let totalUpdated = 0
        let totalDeleted = 0
        let totalCleared = 0

        for (const operation of args.operations) {
          let opResult: Record<string, unknown> | null = null

          switch (operation.action) {
            case 'create':
              if (operation.type === 'events' && operation.eventIds) {
                const promises = operation.eventIds.map(async (eventId: string) => {
                  const eventTimes = await getEventTimes?.(eventId)
                  return createAnnotation?.mutateAsync({
                    type: 'ai_event_highlight',
                    event_id: eventId,
                    start_time: eventTimes?.start_time || null,
                    end_time: eventTimes?.end_time || null,
                    message: operation.description || operation.title || null,
                    emoji_icon: operation.emoji || null,
                    title: operation.title || null,
                    ai_generated: true,
                    visible: true
                  })
                })
                const createResults = await Promise.all(promises)
                totalCreated += createResults.length
                opResult = { action: 'create', type: 'events', count: createResults.length }
              } else if (operation.type === 'time' && operation.timeRanges) {
                const promises = operation.timeRanges.map((range) =>
                  createAnnotation?.mutateAsync({
                    type: 'ai_time_highlight',
                    event_id: null,
                    start_time: range.start,
                    end_time: range.end,
                    title: range.title || operation.title || null,
                    message: range.description || operation.description || null,
                    emoji_icon: range.emoji || operation.emoji || null,
                    ai_generated: true,
                    visible: true
                  })
                )
                const createResults = await Promise.all(promises)
                totalCreated += createResults.length
                opResult = { action: 'create', type: 'time', count: createResults.length }
              }
              break

            case 'update':
              if (operation.updates && Array.isArray(operation.updates)) {
                const updatePromises = operation.updates.map(async (update) => {
                  const updateData: Record<string, unknown> = { id: update.id }
                  if (update.title !== undefined) updateData.title = update.title
                  if (update.message !== undefined) updateData.message = update.message
                  if (update.emoji !== undefined) updateData.emoji_icon = update.emoji
                  if (update.visible !== undefined) updateData.visible = update.visible
                  if (update.startTime !== undefined) updateData.start_time = update.startTime
                  if (update.endTime !== undefined) updateData.end_time = update.endTime
                  return updateAnnotation?.mutateAsync(updateData)
                })
                const updateResults = await Promise.all(updatePromises)
                totalUpdated += updateResults.length
                opResult = { action: 'update', count: updateResults.length }
              }
              break

            case 'delete':
              if (operation.highlightIds && Array.isArray(operation.highlightIds)) {
                const deletePromises = operation.highlightIds.map(id => deleteAnnotation?.mutateAsync(id))
                const deleteResults = await Promise.all(deletePromises)
                totalDeleted += deleteResults.length
                opResult = { action: 'delete', count: deleteResults.length }
              }
              break

            case 'clear':
              if (operation.type === 'events') {
                const eventHighlights = userAnnotations?.filter(a => a.type === 'ai_event_highlight') || []
                if (eventHighlights.length > 0) {
                  const deletePromises = eventHighlights.map(h => deleteAnnotation?.mutateAsync(h.id))
                  await Promise.all(deletePromises)
                  totalCleared += eventHighlights.length
                  opResult = { action: 'clear', type: 'events', count: eventHighlights.length }
                }
              } else if (operation.type === 'time') {
                const timeHighlights = userAnnotations?.filter(a => a.type === 'ai_time_highlight') || []
                if (timeHighlights.length > 0) {
                  const deletePromises = timeHighlights.map(h => deleteAnnotation?.mutateAsync(h.id))
                  await Promise.all(deletePromises)
                  totalCleared += timeHighlights.length
                  opResult = { action: 'clear', type: 'time', count: timeHighlights.length }
                }
              } else {
                const allHighlights = userAnnotations?.filter(a =>
                  a.type === 'ai_event_highlight' || a.type === 'ai_time_highlight'
                ) || []
                if (allHighlights.length > 0) {
                  const deletePromises = allHighlights.map(h => deleteAnnotation?.mutateAsync(h.id))
                  await Promise.all(deletePromises)
                  totalCleared += allHighlights.length
                  opResult = { action: 'clear', type: 'all', count: allHighlights.length }
                }
              }
              break

            default:
              opResult = { error: `Unknown operation action: ${operation.action}` }
          }

          if (opResult) {
            results.push(opResult)
          }
        }

        result = {
          operations: results,
          summary: {
            totalCreated,
            totalUpdated,
            totalDeleted,
            totalCleared
          }
        }
      } else {
        // Handle single operations
        switch (args.action) {
          case 'create':
            if (args.type === 'events' && args.eventIds) {
              const promises = args.eventIds.map(async (eventId: string) => {
                const eventTimes = await getEventTimes?.(eventId)
                return createAnnotation?.mutateAsync({
                  type: 'ai_event_highlight',
                  event_id: eventId,
                  start_time: eventTimes?.start_time || null,
                  end_time: eventTimes?.end_time || null,
                  message: args.description || args.title || null,
                  emoji_icon: args.emoji || null,
                  title: args.title || null,
                  ai_generated: true,
                  visible: true
                })
              })
              const createResults = await Promise.all(promises)
              result = { action: 'create', type: 'events', count: createResults.length, data: createResults }
            } else if (args.type === 'time' && args.timeRanges) {
              const promises = args.timeRanges.map((range) =>
                createAnnotation?.mutateAsync({
                  type: 'ai_time_highlight',
                  event_id: null,
                  start_time: range.start,
                  end_time: range.end,
                  title: range.title || args.title || null,
                  message: range.description || args.description || null,
                  emoji_icon: range.emoji || args.emoji || null,
                  ai_generated: true,
                  visible: true
                })
              )
              const createResults = await Promise.all(promises)
              result = { action: 'create', type: 'time', count: createResults.length, data: createResults }
            }
            break

          case 'read':
            if (args.type === 'events') {
              const eventHighlights = userAnnotations?.filter(a => a.type === 'ai_event_highlight') || []
              result = { action: 'read', type: 'events', count: eventHighlights.length, data: eventHighlights }
            } else if (args.type === 'time') {
              const timeHighlights = userAnnotations?.filter(a => a.type === 'ai_time_highlight') || []
              result = { action: 'read', type: 'time', count: timeHighlights.length, data: timeHighlights }
            } else {
              const allHighlights = userAnnotations?.filter(a =>
                a.type === 'ai_event_highlight' || a.type === 'ai_time_highlight'
              ) || []
              result = { action: 'read', type: 'all', count: allHighlights.length, data: allHighlights }
            }
            break

          case 'update':
            if (args.updates && Array.isArray(args.updates)) {
              const updatePromises = args.updates.map(async (update) => {
                const updateData: Record<string, unknown> = { id: update.id }
                if (update.title !== undefined) updateData.title = update.title
                if (update.message !== undefined) updateData.message = update.message
                if (update.emoji !== undefined) updateData.emoji_icon = update.emoji
                if (update.visible !== undefined) updateData.visible = update.visible
                if (update.startTime !== undefined) updateData.start_time = update.startTime
                if (update.endTime !== undefined) updateData.end_time = update.endTime
                return updateAnnotation?.mutateAsync(updateData)
              })
              const updateResults = await Promise.all(updatePromises)
              result = { action: 'update', count: updateResults.length, data: updateResults }
            }
            break

          case 'delete':
            if (args.highlightIds && Array.isArray(args.highlightIds)) {
              const deletePromises = args.highlightIds.map(id => deleteAnnotation?.mutateAsync(id))
              const deleteResults = await Promise.all(deletePromises)
              result = { action: 'delete', count: deleteResults.length, data: deleteResults }
            }
            break

          case 'clear':
            if (args.type === 'events') {
              const eventHighlights = userAnnotations?.filter(a => a.type === 'ai_event_highlight') || []
              if (eventHighlights.length > 0) {
                const deletePromises = eventHighlights.map(h => deleteAnnotation?.mutateAsync(h.id))
                await Promise.all(deletePromises)
                result = { action: 'clear', type: 'events', count: eventHighlights.length }
              } else {
                result = { action: 'clear', type: 'events', count: 0, message: 'No event highlights to clear' }
              }
            } else if (args.type === 'time') {
              const timeHighlights = userAnnotations?.filter(a => a.type === 'ai_time_highlight') || []
              if (timeHighlights.length > 0) {
                const deletePromises = timeHighlights.map(h => deleteAnnotation?.mutateAsync(h.id))
                await Promise.all(deletePromises)
                result = { action: 'clear', type: 'time', count: timeHighlights.length }
              } else {
                result = { action: 'clear', type: 'time', count: 0, message: 'No time highlights to clear' }
              }
            } else {
              const allHighlights = userAnnotations?.filter(a =>
                a.type === 'ai_event_highlight' || a.type === 'ai_time_highlight'
              ) || []
              if (allHighlights.length > 0) {
                const deletePromises = allHighlights.map(h => deleteAnnotation?.mutateAsync(h.id))
                await Promise.all(deletePromises)
                result = { action: 'clear', type: 'all', count: allHighlights.length }
              } else {
                result = { action: 'clear', type: 'all', count: 0, message: 'No highlights to clear' }
              }
            }
            break

          default:
            result = { error: `Unknown action: ${args.action}` }
        }
      }

      return { success: true, data: result }
    } catch (error) {
      console.error('Highlights tool error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}