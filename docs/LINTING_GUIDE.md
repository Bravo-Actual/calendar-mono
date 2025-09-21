# Linting Guide - Calendar Mono

## Overview
This guide helps developers write code that passes linting checks while maintaining code quality.

## Common Patterns and Solutions

### 1. Unused Variables Pattern

#### Problem: Destructured variables that appear unused
```typescript
// ESLint warns: 'isLoading' is never used
const { data, isLoading, error } = useQuery();
// But you might be using data and error
```

#### Solution: Use underscore prefix for intentionally unused variables
```typescript
const { data, isLoading: _isLoading, error } = useQuery();
// Or use rest operator
const { data, error, ...rest } = useQuery();
```

### 2. React Hook Dependencies

#### Problem: Missing or unnecessary dependencies
```typescript
useEffect(() => {
  // ESLint warns about missing 'user' dependency
  if (user) fetchData();
}, []); // But adding 'user' might cause infinite loops
```

#### Solution: Use refs for stable references or memoization
```typescript
// Option 1: useCallback for stable functions
const fetchUserData = useCallback(() => {
  if (user) fetchData();
}, [user]);

useEffect(() => {
  fetchUserData();
}, [fetchUserData]);

// Option 2: Use refs for values that shouldn't trigger re-renders
const userRef = useRef(user);
userRef.current = user;

useEffect(() => {
  if (userRef.current) fetchData();
}, []); // No dependency needed
```

### 3. Event Handler Parameters

#### Problem: Unused event parameters
```typescript
// ESLint warns: 'e' is never used
onClick={(e) => handleClick(item.id)}
```

#### Solution: Use underscore prefix
```typescript
onClick={(_e) => handleClick(item.id)}
// Or omit if not needed
onClick={() => handleClick(item.id)}
```

### 4. TypeScript Type Assertions

#### Problem: Complex types that ESLint doesn't understand
```typescript
// ESLint might think these are unused
type CalEvent = Database['public']['Tables']['events']['Row'];
const event = data as CalEvent; // Might warn about 'any'
```

#### Solution: Use proper type imports and generics
```typescript
import type { CalEvent } from '@/types';
const event = data as CalEvent; // TypeScript handles this
```

## Best Practices

### 1. **Prefix with underscore for intentionally unused variables**
```typescript
const [_value, setValue] = useState();  // Only using setter
const { data: _data, ...rest } = props; // Extracting without using
```

### 2. **Use TypeScript's built-in types instead of 'any'**
```typescript
// Bad
const handler = (e: any) => { ... }

// Good
const handler = (e: React.MouseEvent<HTMLButtonElement>) => { ... }
// Or if you really need flexibility
const handler = (e: unknown) => { ... }
```

### 3. **Separate imports for types**
```typescript
import type { Database } from '@repo/supabase';  // Type-only import
import { createClient } from '@supabase/supabase-js';
```

### 4. **Use exhaustive deps carefully**
```typescript
// For functions that should only run once
useEffect(() => {
  initializeApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Intentionally empty

// For derived values, use useMemo
const derivedValue = useMemo(() => {
  return calculateValue(prop1, prop2);
}, [prop1, prop2]);
```

### 5. **Handle async operations properly**
```typescript
useEffect(() => {
  let canceled = false;

  async function fetchData() {
    const result = await api.getData();
    if (!canceled) {
      setData(result);
    }
  }

  fetchData();

  return () => { canceled = true; };
}, []);
```

## ESLint Configuration

Our ESLint is configured to:

1. **Allow underscore-prefixed unused variables** (`_variable`)
2. **Allow unused rest siblings in destructuring** (`...rest`)
3. **Warn instead of error** for most rules during development
4. **Ignore certain patterns** that TypeScript handles better

## Running Lint

```bash
# Check for issues
pnpm lint

# Auto-fix what's possible
pnpm lint --fix

# Check specific file
pnpm lint src/components/my-component.tsx
```

## When to Disable Rules

Only disable ESLint rules when:
1. You've confirmed the warning is a false positive
2. The fix would make code less readable
3. You're dealing with external library constraints

Always use inline disables with explanations:
```typescript
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FEATURE_FLAG = true; // Used in build-time replacement
```

## Common False Positives

1. **JSX props that are spread** - ESLint might not detect usage
2. **CSS-in-JS template literals** - May appear as unused expressions
3. **Build-time constants** - Variables replaced during build
4. **Module augmentation** - Type declarations that extend other modules

## Getting Help

- Run `pnpm lint --fix` to auto-fix simple issues
- Check TypeScript errors with `pnpm check-types`
- If unsure, prefix with underscore and add a comment explaining usage