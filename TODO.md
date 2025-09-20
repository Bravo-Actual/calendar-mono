# TODO Items

## Type System Fixes

### Mastra Thread Types (Medium Priority)
**Issue**: Inconsistent usage of StorageThreadType vs MemoryThread in mastra-api.ts

**Context**:
- `StorageThreadType` = lightweight storage records for lists/indexes (from `getMemoryThreads()`)
- `MemoryThread` = rich objects with methods like `.get()`, `.update()`, `.getMessages()` (from `createMemoryThread()` or `getMemoryThread()`)

**Current Problems**:
1. `createThreadWithMetadata()` calls `client.createMemoryThread()` which returns `MemoryThread`, but we return it directly instead of calling `.get()` to get the `StorageThreadType`
2. `MastraAPI.updateThread()` and `MastraAPI.getThread()` use `getMemoryThread().update()/.get()` but might have incorrect return types

**Fix Needed**:
```typescript
export async function createThreadWithMetadata(
  // ...params
): Promise<MastraThread> { // MastraThread = StorageThreadType
  const client = createMastraClient(authToken)
  const memoryThread = await client.createMemoryThread({...}) // returns MemoryThread
  return await memoryThread.get() // convert to StorageThreadType
}
```

**Files**: `apps/calendar/src/lib/mastra-api.ts`

## Code Quality

### ESLint Warnings (Low Priority)
- Remove unused imports and variables
- Fix `any` types where proper types are available
- Fix React hook dependency arrays
- Address TypeScript strict mode warnings

**Files**: Multiple files across the codebase

## Performance Optimizations

### Message Rendering Performance (Future)
- Consider virtualizing long conversation lists
- Optimize message part rendering for large conversations
- Implement proper React keys for message components

## Documentation

### API Documentation (Future)
- Document the Mastra integration patterns
- Document conversation/persona relationship
- Add JSDoc comments for public API functions