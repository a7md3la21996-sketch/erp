import { reportError } from './errorReporter';

/**
 * Retry a function with exponential backoff.
 *
 * Usage:
 *   const data = await retryWithBackoff(() => supabase.from('contacts').select('*'), {
 *     maxRetries: 3,
 *     baseDelay: 500,
 *     label: 'fetchContacts',
 *   });
 *
 * @param {Function} fn - Async function to retry
 * @param {Object} options
 * @param {number} options.maxRetries - Max retry attempts (default 3)
 * @param {number} options.baseDelay - Base delay in ms (default 500)
 * @param {number} options.maxDelay - Maximum delay cap in ms (default 10000)
 * @param {string} options.label - Label for error reporting
 * @returns {*} Result of the function
 */
export async function retryWithBackoff(fn, { maxRetries = 3, baseDelay = 500, maxDelay = 10000, label = 'query' } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      // Supabase returns { data, error } — check for error
      if (result?.error) {
        // Rate limit (429) or server error (5xx) → retry
        const status = result.error?.status || result.status;
        if (status === 429 || (status >= 500 && status < 600)) {
          throw result.error;
        }
        // Client errors (4xx) — don't retry
        return result;
      }
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 200, maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  reportError('retryWithBackoff', label, lastError);
  throw lastError;
}

/**
 * Simple rate limiter: ensures minimum interval between calls.
 *
 * Usage:
 *   const throttledFetch = createThrottle(1000); // 1 call per second
 *   await throttledFetch(() => fetchData());
 */
export function createThrottle(minIntervalMs = 1000) {
  let lastCall = 0;
  return async function throttle(fn) {
    const now = Date.now();
    const wait = Math.max(0, minIntervalMs - (now - lastCall));
    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }
    lastCall = Date.now();
    return fn();
  };
}
