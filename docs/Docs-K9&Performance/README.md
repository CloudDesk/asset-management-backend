# Admin Backend k6 Performance Documentation

This folder contains the specification, execution instructions, recorded result,
and findings for the Inventory Admin + Backend k6 performance test.

The test is intentionally limited to Inventory Admin backend operations. It does
not exercise the E-commerce Web application or Mobile application APIs.

## Documents

1. [Test specification](./01-admin-backend-test-specification.md)
2. [Recorded load-test result](./02-load-test-results.md)
3. [Findings and root cause](./03-findings-and-root-cause.md)
4. [Installation and execution instructions](./INSTRUCTIONS.md)

## Implementation files

- `performance/admin-dashboard.k6.js`
- `performance/README.md`
- Package command: `npm run perf:admin`

## Current status

- k6 installation: successful
- Performance script execution: successful
- Load profile execution: completed with 20 maximum virtual users
- Backend result: failed the configured thresholds
- Primary functional failure: every platform-specific inventory-health request
  returned a non-200 response
- Immediate backend cause: missing `soldStockItems` and `damagedStockItems`
  variables in the platform-specific `Promise.all` destructuring

