// ============================================================================
// HTTP Client Module
// ============================================================================
// Encapsulates HTTP request logic with:
//   - AbortController-based timeout protection
//   - Exponential backoff retry strategy
//   - Structured logging at every stage
//   - Clean separation from orchestration layer
// ============================================================================

import {
  TIMEOUT_MS,
  MAX_RETRIES,
  BASE_BACKOFF_MS,
  HTTP_METHOD,
  SUCCESS_STATUS_CODES,
  isRetryableStatusCode,
} from './config.js';
import { logInfo, logError, logWarn } from './logger.js';

/**
 * Wait for a specified duration.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay for a given attempt.
 * @param {number} attempt - Current attempt number (1-indexed).
 * @returns {number} Delay in milliseconds.
 */
const getBackoffDelay = (attempt) => BASE_BACKOFF_MS * Math.pow(2, attempt - 1);

/**
 * Classify an error into a human-readable error type.
 * @param {Error} error - The caught error.
 * @returns {string} Error classification string.
 */
const classifyError = (error) => {
  if (error.name === 'AbortError') return 'TimeoutError';
  if (error.cause?.code === 'ECONNREFUSED') return 'ConnectionRefused';
  if (error.cause?.code === 'ENOTFOUND') return 'DNSResolutionError';
  if (error.cause?.code === 'ECONNRESET') return 'ConnectionReset';
  return error.name || 'NetworkError';
};

/**
 * Send a single HTTP request with timeout protection.
 * @param {string} url - Target URL.
 * @returns {Promise<{ status: number, latency_ms: number }>}
 * @throws {Error} On timeout or network failure.
 */
const sendRequest = async (url) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      method: HTTP_METHOD,
      signal: controller.signal,
      headers: {
        'User-Agent': 'WakeUp-KeepAlive/1.0',
        'Accept': 'text/html,application/json',
      },
    });

    const latency_ms = Math.round(performance.now() - startTime);

    return {
      status: response.status,
      latency_ms,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Send an HTTP GET request to the target URL with retry and exponential backoff.
 *
 * Retry policy:
 *   - Retries on network errors and 5xx status codes
 *   - Does NOT retry on 4xx client errors
 *   - Does NOT retry on successful 200 responses
 *
 * @param {string} url - The target URL to wake.
 * @returns {Promise<{ success: boolean, attempts: number, lastStatus?: number, lastError?: string }>}
 */
export const wakeUrl = async (url) => {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const { status, latency_ms } = await sendRequest(url);

      if (SUCCESS_STATUS_CODES.has(status)) {
        logInfo({
          event: 'WAKE_SUCCESS',
          url,
          attempt,
          status,
          latency_ms,
          success: true,
        });

        return { success: true, attempts: attempt, lastStatus: status };
      }

      // 4xx — client error — do NOT retry
      if (status >= 400 && status < 500) {
        logError({
          event: 'WAKE_CLIENT_ERROR',
          url,
          attempt,
          status,
          latency_ms,
          success: false,
          message: `Client error ${status} — not retryable`,
        });

        return { success: false, attempts: attempt, lastStatus: status };
      }

      // 5xx — server error — retryable
      if (isRetryableStatusCode(status)) {
        logWarn({
          event: 'WAKE_RETRY',
          url,
          attempt,
          status,
          latency_ms,
          success: false,
          message: `Server error ${status} — will retry`,
        });

        lastError = `HTTP ${status}`;
      }
    } catch (error) {
      const errorType = classifyError(error);
      const latency_ms = Math.round(performance.now() - performance.now());

      logWarn({
        event: 'WAKE_RETRY',
        url,
        attempt,
        error_type: errorType,
        message: error.message,
        success: false,
      });

      lastError = `${errorType}: ${error.message}`;
    }

    // Apply backoff before next attempt (skip if last attempt)
    if (attempt <= MAX_RETRIES) {
      const delay = getBackoffDelay(attempt);

      logInfo({
        event: 'BACKOFF_WAIT',
        url,
        attempt,
        delay_ms: delay,
      });

      await sleep(delay);
    }
  }

  // All retries exhausted
  logError({
    event: 'WAKE_FAILED',
    url,
    total_attempts: MAX_RETRIES + 1,
    last_error: lastError,
    success: false,
    message: 'All retry attempts exhausted',
  });

  return { success: false, attempts: MAX_RETRIES + 1, lastError };
};
