# Admin + Backend k6 performance test

This suite measures the Inventory Admin flow through backend APIs only. It does
not call the E-commerce Web or Mobile APIs.

Each iteration performs:

1. Inventory Admin login: `POST /v1/auth/signin`
2. Product category dashboard: `GET /v1/products/platform/:platform/counts`
3. Orders dashboard: `GET /v1/analytics/orders`
4. Inventory dashboard: `GET /v1/analytics/inventory-health?platform=:platform`

Use a dedicated test account and run against a non-production environment.
Login creates backend authentication sessions, so the test intentionally has a
small operational side effect.

## Prerequisites

Install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) and ensure the
backend URL is reachable.

## Run

Smoke test:

```bash
ADMIN_EMAIL='loadtest@example.com' \
ADMIN_PASSWORD='replace-me' \
BASE_URL='http://localhost:5600' \
npm run perf:admin
```

Load or stress profile:

```bash
PROFILE=load ADMIN_EMAIL='loadtest@example.com' ADMIN_PASSWORD='replace-me' \
BASE_URL='https://your-non-production-backend.example.com' \
npm run perf:admin
```

Available profiles are `smoke` (default), `load`, and `stress`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:5600` | Backend origin, without `/v1` |
| `ADMIN_EMAIL` | required | Dedicated Inventory Admin test account |
| `ADMIN_PASSWORD` | required | Test account password |
| `PLATFORM` | `nivapp` | Dashboard platform |
| `PROFILE` | `smoke` | `smoke`, `load`, or `stress` |
| `THINK_TIME_SECONDS` | `1` | Delay between full Admin flows |
| `MAX_ERROR_RATE` | `0.01` | Maximum error rate threshold |
| `P95_LIMIT_MS` | `1500` | P95 response-time threshold |
| `P99_LIMIT_MS` | `3000` | P99 response-time threshold |

## Reported metrics

The console summary includes `p(65)`, `p(90)`, `p(95)`, and `p(99)` for all
trend metrics. Important metrics are:

- `http_req_duration`: overall and operation-tagged request latency.
- `http_reqs`: total request count and requests/second throughput.
- `admin_api_requests`: Admin/backend request count and throughput.
- `admin_api_error_rate`: failed API validations divided by Admin API calls.
- `admin_flow_error_rate`: failed complete flows divided by iterations.
- `admin_login_duration`: login latency.
- `admin_dashboard_duration`: end-to-end latency of the parallel dashboard batch.
- `checks`: functional response validation rate.

To export the full k6 result stream for later analysis:

```bash
ADMIN_EMAIL='loadtest@example.com' ADMIN_PASSWORD='replace-me' \
k6 run --out json=admin-performance-results.json performance/admin-dashboard.k6.js
```
