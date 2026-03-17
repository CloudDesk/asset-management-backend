Verified from current backend code + QA DB.

Code references: phonepe.route.ts (line 904), phonepe.controller.ts (line 1169), phonepe.service.ts (line 184), gcpTasks.service.ts (line 16), routes/index.ts (line 133), schema.prisma (line 483)

Payment initiation contract (POST /v1/phonepe/initiate)
At initiate time: stock is validated + locked first, then payment is initiated.
Order is not created at initiate for PhonePe (orderData: null).
Response shape:
{
"success": true,
"message": "Payment initiated successfully ...",
"data": {
"merchantTransactionId": "TXN*...",
"redirectUrl": "https://...phonepe...",
"amount": 700,
"status": "INITIATED",
"mode": "phonepe",
"message": "Redirect to PhonePe for payment",
"validation_summary": {...},
"promotion_status": {...},
"stock_locking": {...},
"orderData": null,
"next_steps": {...}
}
}
orderId is not returned here.
Status verification contract (GET /v1/phonepe/status/{merchantTransactionId})
Response shape:
{
"success": true,
"message": "Payment status retrieved successfully",
"data": {
"merchantTransactionId": "TXN*...",
"status": "<paymentStatus.code>",
"success": true/false,
"message": "...",
"paymentData": {...}
}
}
status is passthrough from PhonePe service, not strictly fixed.
Values handled/seen in code+data: PAYMENT_SUCCESS, PAYMENT_PENDING, PAYMENT_INITIATED, PAYMENT_ERROR, PAYMENT_DECLINED, PAYMENT_FAILED, PENDING, FAILED, SUCCESS, COMPLETED, CANCELLED, EXPIRED, TRANSACTION_NOT_FOUND.
Terminal success: PAYMENT_SUCCESS (SUCCESS/COMPLETED treated as success in cleanup logic).
Terminal failure: PAYMENT_ERROR, PAYMENT_FAILED, PAYMENT_DECLINED, FAILED, EXPIRED.
Cancelled: TRANSACTION_NOT_FOUND (mapped to CANCELLED in callback path), sometimes CANCELLED.
Pending: PAYMENT_INITIATED, PAYMENT_PENDING, PENDING.
Yes, payment can be success before order exists. No hard max guarantee for order creation if callback is missed/fails.
Callback behavior
Browser redirect callback endpoint: GET/POST /v1/phonepe/callback/:transactionId.
Webhook endpoint: POST /v1/phonepe/webhook.
Callback handling (/callback/:transactionId) does:
Calls PhonePe status check.
If PAYMENT_SUCCESS: marks tx SUCCESS, then tries order creation, then redirects success.
If TRANSACTION_NOT_FOUND: marks tx CANCELLED, redirects failure.
Else (including PAYMENT_PENDING): marks tx FAILED, redirects failure.
For user-abandoned (WebView close), callback may not come at all.
Callback is not guaranteed.
Fallback expected today: client polling + My Orders check; backend cleanup task handles stock unlock for non-success after delay.
Transaction to order mapping
Reliable mapping key in DB is orders.merchanttransactionid = merchantTransactionId.
/phonepe/status response does not include orderId.
One tx -> multiple orders is possible in current DB (no unique on orders.merchanttransactionid; observed duplicates).
One order -> multiple merchantTransactionIds is not possible on a single row (single field), but duplicate/business anomalies can still exist historically.
Cancel/abandon semantics
If user closes WebView without paying: expected eventual backend final state is usually EXPIRED via cleanup task.
Cleanup delay default is 120 seconds (2 min), despite some comments saying 15 min.
On cleanup non-success status, lock is released (lockqty reduced, availableqty recalculated), and transaction marked EXPIRED with reason payment_timeout_or_failure.
Idempotency and retries
Repeated GET /status is read-only (no side effects).
Repeated POST /initiate creates a new merchantTransactionId each time; no idempotency key for same cart/user.
Callback has partial duplicate guard (checks existing order), but DB does not enforce unique merchantTransactionId at order level.
Recommended frontend decision rule (exact, safe with current backend)
Never use data.success boolean alone from /phonepe/status.
Show Payment Successful / Order Placed only when:
status in {PAYMENT_SUCCESS, SUCCESS, COMPLETED}
and order exists in My Orders for that merchantTransactionId.
Show Payment Failed/Cancelled when:
status in {PAYMENT_ERROR, PAYMENT_FAILED, PAYMENT_DECLINED, FAILED, CANCELLED, EXPIRED, TRANSACTION_NOT_FOUND}.
Show Payment Pending, check My Orders when:
status in {PAYMENT_INITIATED, PAYMENT_PENDING, PENDING}
or payment status is success but order is not yet visible.
Repro check (real QA transaction: WebView closed, no payment)
merchantTransactionId: TXN_1767361451158_ZEL5IV
Initiate timestamp: 2026-01-02T13:44:12.378Z
Initiate response snapshot: success=true, message="Payment initiated successfully", transactionId=TXN_1767361451158_ZEL5IV, redirectUrl present.
Callback events: none persisted (phonePeResponses has only initiation key).
Status timeline available in backend data:
2026-01-02T13:44:12.378Z: INITIATED
2026-01-02T13:46:12.539Z: cleanup check saw paymentStatusCode=PENDING, then tx set to EXPIRED
Order creation event: none (orders rows for this merchantTransactionId = 0).
Final backend truth: EXPIRED, reason payment_timeout_or_failure, finalized in ~120.161s.
