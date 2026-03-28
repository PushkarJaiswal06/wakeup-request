// ============================================================================
// Configuration Module
// ============================================================================
// Centralized configuration for the keep-alive system.
// All tunable parameters are defined here — no magic numbers elsewhere.
// Designed to support multiple target URLs for future extensibility.
// ============================================================================

/**
 * Target URLs to keep alive.
 * Each entry represents a Hugging Face Space (or any HTTP endpoint).
 * Add more URLs here to scale horizontally without code changes.
 */
export const TARGET_URLS = [
  'https://curry-on-backend.onrender.com/health',
];

/**
 * HTTP request timeout in milliseconds.
 * Requests exceeding this duration are aborted via AbortController.
 */
export const TIMEOUT_MS = 10_000;

/**
 * Maximum number of retry attempts per URL.
 * Total attempts = 1 (initial) + MAX_RETRIES.
 */
export const MAX_RETRIES = 3;

/**
 * Base delay for exponential backoff in milliseconds.
 * Delay formula: BASE_BACKOFF_MS * 2^(attempt - 1)
 *   attempt 1 → 2000ms
 *   attempt 2 → 4000ms
 *   attempt 3 → 8000ms
 */
export const BASE_BACKOFF_MS = 2_000;

/**
 * HTTP method for the keep-alive request.
 */
export const HTTP_METHOD = 'GET';

/**
 * Circuit breaker threshold.
 * After this many consecutive failures across runs, the system signals critical state.
 */
export const CIRCUIT_BREAKER_THRESHOLD = 5;

/**
 * Acceptable HTTP status codes.
 * Any status code in this set is considered a successful response.
 */
export const SUCCESS_STATUS_CODES = new Set([200]);

/**
 * HTTP status code ranges that should trigger a retry.
 * 5xx → server-side transient errors (retry)
 * 4xx → client-side errors (do NOT retry)
 */
export const isRetryableStatusCode = (status) => status >= 500 && status < 600;
