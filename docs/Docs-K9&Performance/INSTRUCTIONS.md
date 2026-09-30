# Installation and Execution Instructions

## 1. Install k6 on macOS

Homebrew installation:

```bash
brew install k6
k6 version
```

## 2. Start the backend

From the backend repository:

```bash
npm run dev
```

Confirm that the API is listening on the expected address. The default test URL
is `http://localhost:5600`.

## 3. Set credentials safely

Use a dedicated non-production Inventory Admin account. To avoid placing the
password directly in shell history:

```bash
export ADMIN_EMAIL='loadtest@example.com'
read -s ADMIN_PASSWORD
export ADMIN_PASSWORD
```

Enter the password when prompted. Do not add the password to this repository.

## 4. Run the smoke profile

Always run smoke verification before load or stress testing:

```bash
PROFILE=smoke \
BASE_URL='http://localhost:5600' \
npm run perf:admin
```

Do not continue to the load profile unless:

- all endpoint checks pass;
- `admin_flow_error_rate` is below 1%;
- `admin_api_error_rate` is below 1%; and
- there are no unexpected HTTP 4xx or 5xx responses.

## 5. Run the load profile

```bash
PROFILE=load \
BASE_URL='http://localhost:5600' \
npm run perf:admin
```

Optional overrides:

```bash
PROFILE=load \
PLATFORM='nivapp' \
THINK_TIME_SECONDS='1' \
MAX_ERROR_RATE='0.01' \
P95_LIMIT_MS='1500' \
P99_LIMIT_MS='3000' \
BASE_URL='http://localhost:5600' \
npm run perf:admin
```

## 6. Run the stress profile

Run this only against an approved non-production environment:

```bash
PROFILE=stress \
BASE_URL='https://approved-non-production-backend.example.com' \
npm run perf:admin
```

## 7. Export detailed results

```bash
PROFILE=load \
BASE_URL='http://localhost:5600' \
k6 run \
  --out json=admin-performance-results.json \
  performance/admin-dashboard.k6.js
```

The JSON output can contain URLs and operational metadata. Review it before
sharing and do not commit it unless the repository explicitly requires result
artifacts.

## 8. Interpret the summary

Review these metrics first:

1. `checks`: functional validity of responses.
2. `http_req_failed`: HTTP-level failure rate.
3. `admin_api_error_rate`: HTTP and response-contract failure rate.
4. `admin_flow_error_rate`: percentage of complete Admin flows that failed.
5. `http_reqs`: request throughput per second.
6. Operation-tagged `http_req_duration`: P65, P90, P95, and P99 latency.
7. `admin_dashboard_duration`: end-to-end parallel dashboard load time.

An endpoint returning quickly with HTTP 500 is not a performance success. Fix
all functional failures before using latency measurements as a baseline.

## 9. Clear credential variables

After the run:

```bash
unset ADMIN_EMAIL ADMIN_PASSWORD
```

If a password was pasted directly into a recorded command or shared transcript,
rotate it immediately.

