// ============================================================================
// Wake Orchestrator — Entry Point
// ============================================================================
// Orchestrates the keep-alive cycle across all configured target URLs.
//
// Responsibilities:
//   - Iterate over all target URLs from config
//   - Execute wake requests in parallel (Promise.allSettled for isolation)
//   - Aggregate results and produce a structured summary
//   - Signal success/failure via process exit code
//
// Exit codes:
//   0 — All URLs woke successfully
//   1 — One or more URLs failed after all retries
// ============================================================================

import { TARGET_URLS } from './config.js';
import { wakeUrl } from './httpClient.js';
import { logInfo, logError, logSummary } from './logger.js';

/**
 * Execute the full wake cycle for all configured URLs.
 * Uses Promise.allSettled to ensure every URL is attempted even if one fails.
 *
 * @returns {Promise<void>}
 */
const runWakeCycle = async () => {
  const cycleStart = performance.now();

  logInfo({
    event: 'WAKE_CYCLE_START',
    total_urls: TARGET_URLS.length,
    urls: TARGET_URLS,
  });

  // Validate configuration
  if (!TARGET_URLS.length) {
    logError({
      event: 'CONFIG_ERROR',
      message: 'No target URLs configured',
      success: false,
    });
    process.exit(1);
  }

  // Execute all URL wake requests in parallel with isolation
  const results = await Promise.allSettled(
    TARGET_URLS.map((url) => wakeUrl(url))
  );

  // Aggregate results
  let succeeded = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  const duration_ms = Math.round(performance.now() - cycleStart);

  // Log final summary
  logSummary({
    total: TARGET_URLS.length,
    succeeded,
    failed,
    duration_ms,
  });

  // Exit with appropriate code
  if (failed > 0) {
    process.exit(1);
  }

  process.exit(0);
};

// ============================================================================
// Graceful Error Boundary
// ============================================================================
// Catch any unhandled errors at the top level to ensure structured logging
// and a clean non-zero exit code rather than an ugly stack trace.
// ============================================================================

runWakeCycle().catch((error) => {
  logError({
    event: 'UNHANDLED_ERROR',
    error_type: error.name,
    message: error.message,
    stack: error.stack,
    success: false,
  });
  process.exit(1);
});
