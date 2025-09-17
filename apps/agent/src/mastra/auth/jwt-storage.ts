// DEPRECATED: Global JWT storage - DO NOT USE FOR NEW CODE
// This is kept for backward compatibility but should be replaced with runtime context
let currentUserJwt: string | null = null;

// DEPRECATED: Export function to get current user JWT for tools
export const getCurrentUserJwt = (): string | null => currentUserJwt;

// DEPRECATED: Export function to set current user JWT (for middleware)
export const setCurrentUserJwt = (jwt: string | null): void => {
  currentUserJwt = jwt;
};

// NEW: Runtime context-based JWT access
// This should be used by tools to get JWT from the current request context
export const getJwtFromContext = (options: any): string | null => {
  // Check if runtime context is available in options
  if (options?.runtimeContext) {
    const jwt = options.runtimeContext.get('jwt-token');
    if (jwt) return jwt;
  }

  // Fallback to global storage for backward compatibility
  console.warn('Using deprecated global JWT storage - should migrate to runtime context');
  return getCurrentUserJwt();
};