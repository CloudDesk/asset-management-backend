# Admin + Backend Performance Test Specification

## Objective

Measure the performance and reliability of the Inventory Admin login and
dashboard flow through backend APIs.

The test reports:

- P65 response time
- P90 response time
- P95 response time
- P99 response time
- Request throughput
- API error rate
- Complete-flow error rate
- Functional response-check rate

## Scope

Each virtual-user iteration performs the following flow:

1. Authenticate an Inventory Admin using `POST /v1/auth/signin`.
2. Read NIVAPP product category counts using
   `GET /v1/products/platform/:platform/counts`.
3. Read order analytics using `GET /v1/analytics/orders`.
4. Read inventory health using
   `GET /v1/analytics/inventory-health?platform=:platform`.

The three dashboard requests are issued in parallel after successful login to
model how the Admin dashboard loads its widgets.

## Out of scope

- E-commerce Web UI and APIs
- Mobile application UI and APIs
- Browser rendering performance
- Frontend bundle performance
- Checkout and payment flows
- Data-writing Admin operations other than login session creation

## Load profiles

### Smoke

- Ramp to 1 virtual user over 10 seconds
- Hold 1 virtual user for 20 seconds
- Ramp down over 10 seconds

### Load

- Ramp to 5 virtual users over 30 seconds
- Ramp to 20 virtual users over 1 minute
- Hold 20 virtual users for 2 minutes
- Ramp down over 30 seconds

### Stress

- Ramp to 10 virtual users over 30 seconds
- Ramp to 30 virtual users over 1 minute
- Ramp to 60 virtual users over 1 minute
- Ramp to 90 virtual users over 1 minute
- Ramp down over 30 seconds

## Default service-level thresholds

| Metric | Threshold |
| --- | --- |
| API error rate | Less than 1% |
| Complete-flow error rate | Less than 1% |
| Functional checks | Greater than 99% |
| Overall P95 | Less than 1,500 ms |
| Overall P99 | Less than 3,000 ms |
| Login P95 | Less than 1,500 ms |
| Dashboard batch P95 | Less than 1,500 ms |
| Dashboard batch P99 | Less than 3,000 ms |

The same P95 and P99 limits are evaluated independently for login, category
counts, orders analytics, and inventory-health requests.

## Metrics

| Metric | Meaning |
| --- | --- |
| `http_req_duration` | Overall and operation-tagged HTTP latency |
| `http_reqs` | Request count and requests-per-second throughput |
| `admin_api_requests` | Count and rate of Admin/backend API requests |
| `admin_api_failures` | Number of responses that failed validation |
| `admin_api_error_rate` | Failed validations divided by Admin API requests |
| `admin_flow_error_rate` | Failed full flows divided by total iterations |
| `admin_login_duration` | Inventory Admin login latency |
| `admin_dashboard_duration` | End-to-end parallel dashboard batch latency |
| `checks` | Functional response validation success rate |

## Credential and environment requirements

- Use a dedicated non-production Inventory Admin account.
- Never commit or document the account password.
- Supply credentials through environment variables.
- Login creates authentication-session records and is therefore not completely
  side-effect free.
- Run load and stress profiles only against an approved environment.

