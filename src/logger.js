// ============================================================================
// Structured Logger Module
// ============================================================================
// Outputs JSON-structured logs to stdout/stderr.
// No unstructured console noise — every log is machine-parseable.
// Designed for GitHub Actions log aggregation and future integration
// with external logging/monitoring services.
// ============================================================================

/**
 * Emit a structured JSON log entry to stdout.
 * @param {Record<string, unknown>} fields - Key-value pairs to include in the log.
 */
export const logInfo = (fields) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    ...fields,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
};

/**
 * Emit a structured JSON error log entry to stderr.
 * @param {Record<string, unknown>} fields - Key-value pairs to include in the log.
 */
export const logError = (fields) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    ...fields,
  };
  process.stderr.write(JSON.stringify(entry) + '\n');
};

/**
 * Emit a structured JSON warning log entry to stdout.
 * @param {Record<string, unknown>} fields - Key-value pairs to include in the log.
 */
export const logWarn = (fields) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'WARN',
    ...fields,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
};

/**
 * Log the final summary of a wake cycle run.
 * @param {{ total: number, succeeded: number, failed: number, duration_ms: number }} summary
 */
export const logSummary = (summary) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    event: 'WAKE_CYCLE_COMPLETE',
    ...summary,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
};
