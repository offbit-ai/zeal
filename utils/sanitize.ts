// Utility functions to sanitize data before sending to CRDT

/**
 * Sanitize a string to ensure it's safe for CRDT sync
 */
export function sanitizeString(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return ''
  
  // Remove null bytes and control characters
  let sanitized = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  
  // Ensure valid UTF-8 by encoding and decoding
  try {
    sanitized = decodeURIComponent(encodeURIComponent(sanitized))
  } catch (e) {
    // If encoding fails, remove non-ASCII characters as fallback
    sanitized = sanitized.replace(/[^\x20-\x7E]/g, '')
  }
  
  return sanitized
}

/**
 * Recursively sanitize an object's string values
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result: any = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeObject(value)
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) : 
        (item && typeof item === 'object') ? sanitizeObject(item) : 
        item
      )
    } else {
      result[key] = value
    }
  }
  
  return result as T
}