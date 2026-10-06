# Admin + Backend Load-Test Results

## Test execution

| Item | Result |
| --- | --- |
| Profile | `load` |
| Maximum virtual users | 20 |
| Configured scenario duration | 4 minutes |
| Completed iterations | 374 |
| Interrupted iterations | 0 |
| Total HTTP requests | 1,496 |
| Total checks | 3,366 |

## Latency percentiles

| Operation | Average | P65 | P90 | P95 | P99 | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Admin login | 5.18 s | 6.60 s | 7.35 s | 7.70 s | 8.29 s | 8.74 s |
| Category counts | 3.35 s | 4.21 s | 4.93 s | 5.12 s | 6.30 s | 6.39 s |
| Inventory health | 1.91 s | 2.47 s | 3.41 s | 3.83 s | 4.01 s | 4.16 s |
| Orders analytics | 1.88 s | 2.44 s | 3.44 s | 3.75 s | 4.01 s | 4.22 s |
| Overall HTTP | 3.08 s | 3.64 s | 6.28 s | 7.14 s | 7.78 s | 8.74 s |
| Complete iteration | 9.53 s | 11.19 s | 12.81 s | 13.14 s | 14.00 s | 15.14 s |

## Throughput and reliability

| Metric | Result |
| --- | ---: |
| HTTP throughput | 6.20 requests/second |
| Complete-flow throughput | 1.55 iterations/second |
| API error rate | 25.00% |
| Complete-flow error rate | 100.00% |
| Checks passed | 77.77% |
| Checks failed | 22.22% |
| Failed Admin API validations | 374 |

## Functional checks

The following checks passed throughout the run:

- Admin login returned HTTP 200.
- Admin login response indicated success.
- Admin login returned an access token.
- Category dashboard returned HTTP 200 and a categories collection.
- Orders dashboard returned HTTP 200 and an overview object.

The following checks failed for all 374 iterations:

- Inventory dashboard returned HTTP 200: 0 passed, 374 failed.
- Inventory dashboard returned numeric product and stock totals: 0 passed,
  374 failed.

## Threshold result

The run failed every configured latency, error-rate, flow-success, and check-rate
threshold. The 25% API error rate corresponds exactly to one failed request out
of the four API requests in every iteration.

The inventory-health latency values represent failing responses and must not be
used as successful endpoint performance measurements. A clean baseline must be
captured after correcting the functional error.

