# Multi-Week Drag Navigation Implementation Plan

## Overview
Implement drag-and-drop navigation that allows users to drag events across multiple weeks by hovering over edge indicators that appear during drag operations.

## Current State
- ✅ Time suggestions work for current week view
- ✅ Stable suggestions during drag operation (seeded randomization)
- ✅ Dynamic suggestions based on weekStartMs, days, timeZone

## Feature Requirements
1. **Edge Indicators**: Show "Additional times available" on right edge, "Previous week" on left edge
2. **Drag Navigation**: Navigate to next/previous week when dragging over indicators
3. **State Persistence**: Maintain drag operation during week navigation
4. **New Suggestions**: Generate fresh time suggestions for new week view

## Technical Challenges
1. **Maintaining Drag State**: DragState must survive week navigation
2. **Mouse Tracking**: Need to track mouse position across week changes
3. **Event Coordination**: Synchronize drag operations with navigation
4. **Visual Feedback**: Show clear indicators and smooth transitions

## Implementation Plan

### Phase 1: Add Edge Indicators
- [ ] Add drag navigation zones (left/right edges)
- [ ] Show indicators only during drag operations
- [ ] Style indicators with gradients and tooltips
- [ ] Position indicators absolutely within calendar container

### Phase 2: Navigation Handler
- [ ] Create `handleDragNavigation(direction: 'prev' | 'next')` function
- [ ] Use existing `nextWeek()` and `prevWeek()` methods from calendar API
- [ ] Add debouncing to prevent rapid navigation
- [ ] Test navigation without drag state first

### Phase 3: Drag State Preservation
- [ ] Store drag state before navigation
- [ ] Restore drag state after navigation
- [ ] Update drag coordinates relative to new week layout
- [ ] Handle edge cases (event no longer visible, etc.)

### Phase 4: Enhanced Time Suggestions
- [ ] Modify `useTimeSuggestions` to handle week navigation
- [ ] Reset suggestions for new week while maintaining stability
- [ ] Ensure suggestions appear for future dates in new week

### Phase 5: User Experience Polish
- [ ] Add smooth transitions
- [ ] Improve visual feedback
- [ ] Add hover states for navigation zones
- [ ] Test edge cases and error handling

## File Changes Required

### `calendar-week.tsx`
- Add drag navigation zones UI
- Implement `handleDragNavigation` function
- Add state for navigation debouncing
- Modify drag event handlers to preserve state

### `useTimeSuggestions.ts`
- Handle week navigation events
- Reset suggestions appropriately
- Maintain drag timing for stability

### `types.ts` (if needed)
- Extend DragState interface if additional properties needed
- Add navigation-specific types

## Key Considerations

### Mouse Tracking
- Mouse position needs to be translated between weeks
- Handle cases where mouse is outside calendar during navigation

### Performance
- Debounce navigation to prevent rapid week switching
- Ensure smooth animations don't interfere with drag

### Edge Cases
- Event dragged to non-existent time (past dates)
- Rapid navigation causing state conflicts
- Mouse leaving calendar area during navigation

### Accessibility
- Keyboard navigation support
- Screen reader announcements for navigation

## Testing Strategy
1. **Unit Tests**: Test navigation functions in isolation
2. **Integration Tests**: Test full drag-navigate-drop workflow
3. **Edge Case Tests**: Test boundary conditions
4. **User Testing**: Test with real drag operations

## Rollback Plan
- Current commit: `d182d60` - Time suggestions improvements
- Can revert individual phases if issues arise
- Feature can be disabled via feature flag if needed

## Success Criteria
- [ ] User can drag event and hover over right edge to see "Additional times available"
- [ ] Hovering navigates to next week while maintaining drag operation
- [ ] Time suggestions appear for new week
- [ ] User can complete drop operation in new week
- [ ] User can navigate back to previous week during same drag operation
- [ ] No performance issues or visual glitches
- [ ] Works in both 5-day and 7-day view modes

## Implementation Notes
- Start with basic functionality, polish later
- Use existing calendar navigation infrastructure
- Leverage current drag system architecture
- Maintain compatibility with existing features