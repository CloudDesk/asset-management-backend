# CR 4 - Customer Wallet Module

## Objective

Create a separate Wallet module for customer money/credit management.

Current scope clarification:

```text
Customer wallet top-up / adding personal cash is NOT included in the current scope.

Wallet credits currently come only from:
1. Promotion/Voucher Credit
2. Return/Refund Credit
3. Admin Manual Credit, if required
```

Promotions can credit money into the wallet, but the Wallet module owns:

- wallet balance.
- wallet transaction history.
- credit/debit ledger.
- credit expiry.
- wallet payment usage.
- refund/store credit.
- admin wallet adjustments.

This CR mainly impacts:

- `Server` backend.
- `Ecom` mobile wallet screen.
- checkout/payment flow.
- promotion redemption flow.
- refund/cancellation flow.
- optional `Inventory` admin actions.

## Business Concept

Each customer can have wallet money from different sources.

```text
Customer Wallet
  |
  |-- Promotional Credit
  |     Example: Rs. 100
  |     Can have expiry
  |
  |-- Admin Manual Credit
  |     No expiry
  |     Created only by admin/manual action in this CR
  |
  |-- Return / Refund Credit
        No expiry
```

The wallet must not be implemented as only one balance column. Every movement should be recorded as a wallet transaction.

## Why Ledger Is Required

Example customer balance:

```text
Rs. 100 Promotional Credit -> expires Aug 31
Rs. 500 Refund Credit      -> no expiry
Rs. 200 Admin Manual Credit -> no expiry
```

If customer pays Rs. 150 using wallet, system must know which balance was consumed.

Recommended consumption order:

1. Promotional credit that expires earliest.
2. Other promotional credit.
3. Refund credit.
4. Admin manual credit.

This requires source-level balance tracking, not only a total wallet balance.

## Wallet Credit Types

Recommended credit buckets:

```text
promotional_credit
refund_credit
admin_manual_credit
```

Recommended transaction directions:

```text
credit
debit
hold
release
expire
adjustment
```

Recommended sources:

```text
promotion
refund
manual_admin
order_payment
expiry
system_adjustment
```

## Recommended Data Model

### wallet_accounts

One wallet account per customer.

```text
id
customer_id
status                 // active, suspended, closed
currency               // INR
total_balance
promotional_balance
refund_balance
admin_manual_balance
held_balance
createddate
modifieddate
```

Notes:

- Balance columns are denormalized for fast reads.
- Transaction ledger remains the source of truth.
- Reconciliation can rebuild balances from transaction rows if required.

### wallet_transactions

Every wallet movement is stored here.

```text
id
wallet_account_id
customer_id
amount
direction              // credit, debit, hold, release, expire, adjustment
credit_type            // promotional_credit, refund_credit, admin_manual_credit
source                 // promotion, refund, manual_admin, order_payment, expiry, system_adjustment
reference_type         // promotion_redemption, order, refund, admin_action
reference_id
status                 // pending, completed, failed, reversed, expired
description
expiry_date            // only for expiring credit
createddate
modifieddate
```

Important:

- Credit transactions have positive amount and direction `credit`.
- Debit transactions have positive amount and direction `debit`.
- Do not store debits as negative amounts unless this is standardized across the project.

### wallet_ledger_allocations

Required when a wallet debit consumes from multiple credit sources.

Example:

```text
Order wallet payment: Rs. 150
  -> Rs. 100 from promotional credit transaction A
  -> Rs. 50 from refund credit transaction B
```

Recommended table:

```text
id
debit_transaction_id
credit_transaction_id
amount
createddate
```

This table answers:

- which credit was consumed.
- how much remains from each credit.
- whether expiring credits were consumed first.

Alternative:

- store allocations as JSON in `wallet_transactions.metadata`.

Recommended:

- use a table for auditability and reporting.

## Balance Rules

### Promotional Credit

- Can have expiry.
- Usually comes from promotion voucher redemption.
- Should be consumed before non-expiring credits.
- Expired amount must be removed through an `expire` transaction.

### Refund Credit

- No expiry by default.
- Comes from return/refund flow.
- Can be used for future order payment.
- Should not expire unless policy changes.

### Admin Manual Credit

- No expiry.
- Comes from admin/manual credit only.
- Customer wallet top-up/add cash is not in current scope.
- Can be used for future order payment.

### Held Balance

Use hold/release if order payment authorization needs reservation before final order placement.

Example:

```text
Customer applies Rs. 200 wallet at checkout
  -> hold Rs. 200
  -> order succeeds
  -> convert hold to debit

Customer applies wallet but payment/order fails
  -> release hold
```

If checkout is synchronous and atomic, hold can be deferred for phase 2.

## Wallet Credit Flow From Promotion

Promotion module responsibility:

```text
Validate voucher eligibility.
```

Wallet module responsibility:

```text
Create wallet credit transaction and update wallet balance.
```

Flow:

```text
Customer enters WALLET100
  -> Promotion validates code/customer/channel/usage/validity
  -> Promotion redemption succeeds
  -> WalletService.creditPromotionalWallet is called
  -> wallet transaction is created
  -> promotional balance increases
  -> wallet transaction id is stored in promotion redemption metadata
```

Wallet transaction example:

```json
{
  "customer_id": 101,
  "amount": 100,
  "direction": "credit",
  "credit_type": "promotional_credit",
  "source": "promotion",
  "reference_type": "promotion_redemption",
  "reference_id": "redemption_uuid",
  "expiry_date": 1725062399000,
  "status": "completed"
}
```

Idempotency rule:

- One promotion redemption must create at most one wallet credit transaction.
- Retry must return the existing wallet transaction instead of creating a duplicate.

## Direct Admin Wallet Credit

If admin wants to directly add Rs. 100 to a customer's wallet without coupon entry, that is not a promotion.

Use Wallet/Admin action:

```text
Admin selects customer
  -> adds amount
  -> selects credit type/reason
  -> wallet transaction created with source manual_admin
```

This should not create promotion redemption.

## Refund Credit Flow

When order refund is approved as wallet/store credit:

```text
Refund process approved
  -> WalletService.creditRefundWallet
  -> wallet transaction created
  -> refund balance increases
  -> refund/order record stores wallet transaction id
```

Refund credit default:

- no expiry.
- source `refund`.
- credit type `refund_credit`.

Open decision:

- Should refunds always go to original payment mode, or can admin choose wallet credit?

## Wallet Payment Flow During Checkout

Customer can use wallet balance to pay for an order.

Flow:

```text
Customer chooses wallet amount
  -> Backend validates available wallet balance
  -> System consumes credits by priority
  -> Wallet debit transaction is created
  -> Allocation rows are created
  -> Order payment amount is reduced or fully paid
```

Consumption priority:

```text
1. promotional_credit by earliest expiry date
2. promotional_credit without expiry
3. refund_credit
4. admin_manual_credit
```

Example:

```text
Available:
  Rs. 100 promotional credit, expires Aug 31
  Rs. 500 refund credit, no expiry
  Rs. 200 admin manual credit, no expiry

Order wallet debit:
  Rs. 150

Allocation:
  Rs. 100 from promotional credit
  Rs. 50 from refund credit
```

## Expiry Handling

Promotional credits can expire.

Expiry job:

```text
Find completed promotional credit transactions
  -> expiry_date < now
  -> remaining amount > 0
  -> create expire transaction
  -> reduce promotional balance
```

Do not delete expired credit rows. Expiry must be auditable.

Recommended scheduled job:

- runs hourly or daily.
- safe to retry.
- idempotent.

## API Proposal

### Customer APIs

```http
GET /v1/wallet/me
GET /v1/wallet/me/transactions
POST /v1/wallet/apply-to-order
```

### Admin APIs

```http
GET /v1/wallet/customers/:customerId
GET /v1/wallet/customers/:customerId/transactions
POST /v1/wallet/customers/:customerId/credit
POST /v1/wallet/customers/:customerId/debit-adjustment
```

### Internal Service APIs

These may be service methods rather than public routes:

```text
WalletService.creditPromotionalWallet
WalletService.creditRefundWallet
WalletService.creditManualWallet
WalletService.debitForOrder
WalletService.releaseOrderHold
WalletService.expireCredits
```

## Backend Files To Add

Server:

- `src/routes/wallet.route.ts`
- `src/controllers/wallet.controller.ts`
- `src/services/wallet.service.ts`
- `src/schemas/wallet.schema.ts`

Prisma:

- add `wallet_accounts`
- add `wallet_transactions`
- add `wallet_ledger_allocations`

Route registration:

- update `src/routes/index.ts`

Promotion integration:

- update `src/services/promotion-redemption.service.ts`
- store wallet transaction reference in redemption metadata.

Order/payment integration:

- checkout/payment flow should call wallet debit logic when wallet amount is applied.

Refund integration:

- cancellation/refund flow should call refund wallet credit logic if admin chooses wallet refund.

## Ecom Mobile App Changes

Current mobile app has a placeholder wallet screen:

- `Ecom/src/screens/wallet/WalletScreen.tsx`

Planned behavior:

- show total wallet balance.
- show balance split:
  - promotional credit.
  - refund credit.
  - admin manual credit.
- show expiring promotional credits.
- show transaction history.
- allow wallet application at checkout if enabled.

Checkout changes:

- show available wallet balance.
- allow customer to apply full or partial wallet amount.
- backend must calculate actual accepted amount.
- show remaining payable amount.

## Inventory/Admin Changes

Admin may need:

- view customer's wallet.
- view wallet transactions.
- manually credit wallet.
- reverse/adjust erroneous credit.
- process refund to wallet.

Manual admin credit must be a Wallet action, not a Promotion action.

Customer add-cash/top-up is not required for this CR and should not be exposed in Ecom or Inventory.

## Accounting and Audit Rules

Every transaction should include:

- who/what initiated it.
- source.
- reference id.
- reason/description.
- status.
- created date.

Do not overwrite transaction history.

For corrections:

- create reversal/adjustment transaction.
- do not edit old completed transaction amount unless there is a clear correction policy.

## Concurrency Requirements

Wallet debit must be transaction-safe.

Risks:

- same balance consumed by two orders.
- expired credit consumed during checkout.
- refund credit duplicated.
- promotion redemption creates duplicate wallet credit.

Mitigation:

- use database transaction.
- lock wallet account/eligible credit rows during debit.
- idempotency key for promotion/refund/admin credit.
- unique reference constraints where possible.

Recommended unique constraints:

```text
wallet_transactions(reference_type, reference_id, source)
```

This prevents duplicate credits for the same promotion redemption or refund.

## Test Cases

### Wallet Credit

- create promotional credit with expiry.
- create refund credit without expiry.
- create admin manual wallet credit without expiry.
- verify balances update correctly.
- duplicate reference does not create duplicate credit.

### Wallet Debit

- debit uses earliest expiring promotional credit first.
- debit falls back to refund credit.
- debit falls back to admin manual credit.
- debit fails when amount exceeds available balance.
- allocations are created for each consumed credit source.

### Expiry

- expired promotional credit creates expire transaction.
- expired credit is no longer available for debit.
- expiry job is idempotent.
- refund credit and admin manual credit do not expire.

### Promotion Integration

- wallet-credit voucher creates wallet transaction.
- same voucher redemption retry does not duplicate wallet credit.
- promotion redemption metadata stores wallet transaction id.

### Refund Integration

- refund to wallet creates refund credit.
- duplicate refund callback/action does not duplicate wallet credit.

### Checkout Integration

- wallet can partially pay order.
- wallet can fully pay order.
- failed order releases hold or reverses debit according to chosen flow.

## Open Decisions

1. Should checkout use wallet hold first, or direct debit at final order creation?
2. Can promotional credit be used with all products and promotions, or should restrictions exist?
3. Can wallet money be combined with PhonePe/COD?
4. Can wallet money be used for shipping charges?
5. Refund flow: original payment refund only, wallet credit only, or admin choice?
6. Should wallet balance be visible in Inventory, Ecom app, or both in phase 1?

## Recommended Implementation Sequence

1. Confirm wallet business rules and open decisions.
2. Add Prisma wallet tables.
3. Add wallet service with credit/debit/expiry helpers.
4. Add wallet APIs.
5. Add transaction-safe debit allocation logic.
6. Add promotion wallet credit integration.
7. Add refund wallet credit integration.
8. Add Ecom wallet balance and transaction history API usage.
9. Add checkout wallet application.
10. Add Inventory admin wallet view/credit actions if required.
11. Add expiry scheduled job.
12. Add tests for ledger, debit allocation, expiry, promotion, refund, and checkout.
