# WakeUp — Keep-Alive System for Hugging Face Spaces

A production-grade GitHub Actions–based keep-alive system that prevents Hugging Face Space deployments from going to sleep by sending periodic HTTP requests.

---

## Architecture

```
GitHub Actions (cron: every 1 hour)
        │
        ▼
┌─────────────────────────┐
│    Wake Orchestrator     │  ← src/wake.js
│  (Promise.allSettled)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│     HTTP Client Layer    │  ← src/httpClient.js
│  ┌───────────────────┐  │
│  │  Timeout (10s)    │  │
│  │  Retry (3x)       │  │
│  │  Exp. Backoff     │  │
│  │  Error Classify   │  │
│  └───────────────────┘  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Structured Logger      │  ← src/logger.js
│   (JSON to stdout/err)   │
└─────────────────────────┘
```

---

## Repository Structure

```
.github/
  workflows/
    keepalive.yml          # Scheduled GitHub Actions workflow

src/
  config.js                # Centralized configuration (URLs, timeouts, retries)
  httpClient.js            # HTTP request layer with retry + backoff + timeout
  logger.js                # Structured JSON logging
  wake.js                  # Orchestrator — entry point

package.json               # Node.js project manifest (ES Modules)
.gitignore                 # Git ignore rules
README.md                  # This file
```

---

## How It Works

1. **GitHub Actions** triggers the workflow every hour via cron (`0 * * * *`)
2. **Wake orchestrator** (`wake.js`) reads all target URLs from `config.js`
3. For each URL, an HTTP GET request is sent in parallel via `Promise.allSettled`
4. Each request has:
   - **10-second timeout** via `AbortController`
   - **3 retries** with exponential backoff (2s → 4s → 8s)
   - Structured JSON logging at every stage
5. The process exits with code `0` on success or `1` on failure

---

## Configuration

All settings are centralized in [`src/config.js`](src/config.js):

| Parameter | Default | Description |
|-----------|---------|-------------|
| `TARGET_URLS` | `[...]` | Array of URLs to keep alive |
| `TIMEOUT_MS` | `10000` | Request timeout in milliseconds |
| `MAX_RETRIES` | `3` | Number of retry attempts |
| `BASE_BACKOFF_MS` | `2000` | Base delay for exponential backoff |

### Adding More URLs

Simply add more entries to the `TARGET_URLS` array in `config.js`:

```js
export const TARGET_URLS = [
  'https://your-space-1.hf.space/docs',
  'https://your-space-2.hf.space/docs',
];
```

---

## Failure Handling

| Scenario | Behavior |
|----------|----------|
| HTTP 200 | Success — log and exit 0 |
| HTTP 5xx | Retry with exponential backoff |
| HTTP 4xx | Do NOT retry — log error and exit 1 |
| Timeout | Abort request, retry |
| DNS failure | Retry |
| Connection refused | Retry |
| All retries exhausted | Log failure, exit 1 |

---

## Log Format

All logs are structured JSON, output to stdout/stderr:

**Success:**
```json
{
  "timestamp": "2026-02-14T10:00:01.234Z",
  "level": "INFO",
  "event": "WAKE_SUCCESS",
  "url": "https://example.hf.space/docs",
  "attempt": 1,
  "status": 200,
  "latency_ms": 532,
  "success": true
}
```

**Failure:**
```json
{
  "timestamp": "2026-02-14T10:00:12.345Z",
  "level": "ERROR",
  "event": "WAKE_FAILED",
  "url": "https://example.hf.space/docs",
  "total_attempts": 4,
  "last_error": "TimeoutError: The operation was aborted",
  "success": false
}
```

---

## Running Locally

```bash
node src/wake.js
```

---

## Extending the System

### Slack/Discord Notifications

1. Add your webhook URL as a GitHub Secret (`SLACK_WEBHOOK_URL`)
2. Uncomment the notification step in `.github/workflows/keepalive.yml`

### Multiple Environments

Add URLs for staging/production in `config.js` — the orchestrator handles all of them in parallel with isolated error boundaries.

### Metrics Export

The structured JSON logs are designed for easy integration with:
- Datadog
- Grafana / Loki
- CloudWatch
- Any JSON-based log aggregator

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20 |
| HTTP | Native `fetch` API |
| Timeout | `AbortController` |
| Scheduler | GitHub Actions (cron) |
| Runner | Ubuntu latest |
| Module System | ES Modules |

---

## Design Principles

- **Clean Architecture** — Separation of concerns across modules
- **SOLID** — Single responsibility per module
- **Fail Fast** — Immediate exit on unrecoverable errors
- **Observable by Default** — Every action produces a structured log
- **Idempotent** — Safe to run any number of times
- **Zero Dependencies** — Uses only Node.js built-in APIs

---

## License

MIT
