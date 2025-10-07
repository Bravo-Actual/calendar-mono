/**
 * Custom error class for AI Assistant errors
 * Provides structured error handling with user-friendly messages
 */
export class AIAssistantError extends Error {
  constructor(
    message: string,
    public code?:
      | 'AUTH_ERROR'
      | 'STREAM_ERROR'
      | 'TOOL_ERROR'
      | 'NETWORK_ERROR'
      | 'RATE_LIMIT'
      | 'UNKNOWN',
    public recoverable: boolean = true,
    public userMessage?: string
  ) {
    super(message);
    this.name = 'AIAssistantError';
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    if (this.userMessage) return this.userMessage;

    switch (this.code) {
      case 'AUTH_ERROR':
        return 'Authentication failed. Please sign in again.';
      case 'RATE_LIMIT':
        return 'Too many requests. Please wait a moment and try again.';
      case 'NETWORK_ERROR':
        return 'Network error. Please check your connection and try again.';
      case 'TOOL_ERROR':
        return 'Tool execution failed. Please try again.';
      case 'STREAM_ERROR':
        return 'Stream interrupted. Please try sending your message again.';
      default:
        return 'An error occurred. Please try again.';
    }
  }

  /**
   * Parse an unknown error into an AIAssistantError
   */
  static fromError(error: unknown): AIAssistantError {
    if (error instanceof AIAssistantError) {
      return error;
    }

    let message = 'Unknown error';
    let code: AIAssistantError['code'] = 'UNKNOWN';
    let recoverable = true;

    if (error instanceof Error) {
      message = error.message;

      // Parse error message to determine type
      if (message.includes('Authentication') || message.includes('Unauthorized')) {
        code = 'AUTH_ERROR';
        recoverable = false;
      } else if (message.includes('rate limit') || message.includes('too many requests')) {
        code = 'RATE_LIMIT';
      } else if (message.includes('network') || message.includes('fetch')) {
        code = 'NETWORK_ERROR';
      } else if (message.includes('stream')) {
        code = 'STREAM_ERROR';
      } else if (message.includes('tool')) {
        code = 'TOOL_ERROR';
      }
    } else if (typeof error === 'string') {
      message = error;
    }

    return new AIAssistantError(message, code, recoverable);
  }
}

/**
 * Sanitize text content to remove potentially problematic characters
 */
export function sanitizeText(text: string): string {
  if (!text) return '';

  // Remove null bytes and control characters (except newlines and tabs)
  return text
    .replace(/\0/g, '') // Null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Control chars
}
