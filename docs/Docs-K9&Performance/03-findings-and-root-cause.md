# Performance Findings and Root Cause

## Executive summary

The k6 test harness operated correctly and completed the requested load profile.
The run exposed one deterministic backend error and significant latency across
all tested Admin operations.

## Critical functional failure: inventory health

Every request to the platform-filtered inventory-health endpoint failed.

### Root cause

In `src/services/analytics.service.ts`, the platform-specific inventory branch
runs nine operations in `Promise.all`:

1. Low-stock product query
2. Out-of-stock product query
3. Low-stock count
4. Out-of-stock count
5. Total product count
6. Platform distribution
7. Available stock-item count
8. Sold stock-item count
9. Damaged stock-item count

The result destructuring declares only the first seven variables. Later, the
response references `soldStockItems` and `damagedStockItems`, even though those
variables were never declared in that branch. This produces a runtime
`ReferenceError`, which the controller converts to HTTP 500.

### Required correction

The platform-specific result destructuring must include the final two results:

```ts
const [
  lowStockItems,
  outOfStockItems,
  lowStockCount,
  outOfStockCount,
  totalProducts,
  platformDistribution,
  totalStockItems,
  soldStockItems,
  damagedStockItems,
] = await Promise.all([...]);
```

The backend must then be restarted before repeating the performance test.

## Performance findings after excluding the functional failure

Even after the inventory failure is corrected, the successful operations exceed
the configured latency objectives:

- Login P95 was 7.70 seconds against a 1.50-second objective.
- Category-count P95 was 5.12 seconds against a 1.50-second objective.
- Orders-analytics P95 was 3.75 seconds against a 1.50-second objective.
- Overall HTTP P95 was 7.14 seconds.

Login is the slowest operation and the category-count endpoint is the slowest
dashboard read. These should be profiled first after a clean baseline is
captured.

## Investigation priorities

1. Correct the inventory-health runtime error.
2. Run the smoke profile and confirm all checks pass.
3. Run the load profile again to establish valid error and latency baselines.
4. Measure database latency separately from application processing time.
5. Profile login password verification, session creation, session-limit
   enforcement, permission loading, and repeated user lookups.
6. Inspect query plans and indexes for category counts and analytics queries.
7. Compare local-backend/remote-database latency against a backend deployed near
   the database.
8. Optimize only after verifying that the test environment represents the
   intended deployment topology.

## Security finding

The terminal transcript used for the result review contained a plaintext Admin
password. That password must be rotated immediately. Future commands should use
an environment variable, secret manager, or interactive shell input and must not
be saved in documentation or committed to Git.

