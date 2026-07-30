# CR 3 - Promotion Enhancements

## Objective

Enhance the current promotion system to support:

- app/channel-specific promo codes.
- unique customer vouchers.
- customer-specific promotions.
- customer-group/corporate promotions.
- reliable redemption and usage tracking.

This CR should extend the existing promotion lifecycle:

```text
Promotion setup
  -> Promotion evaluation
  -> Order placement
  -> Promotion redemption
  -> Usage tracking
```

It should not create a separate voucher engine unless the current promotion tables cannot support the required data safely.

## Existing System Summary

Current backend has:

- `promotions`
- `promotion_evaluations`
- `promotion_redemptions`
- `PromotionEvaluationService`
- `PromotionRedemptionService`
- promotion evaluation routes under `/v1/promotions`

Current `promotions` supports:

- `code`
- `auto_apply`
- `start_date`
- `end_date`
- `max_redemptions`
- `per_user_limit`
- `conditions`
- `action`

Current gaps:

- No explicit applicable channel field in create/update schemas.
- No customer assignment model.
- No customer-group model visible in the current Prisma schema.
- `per_user_limit` exists, but must be enforced using redemption counts.
- Redemption records exist, but usage validation must be applied during evaluation and finalized during redemption.

## Enhancement 1 - App-Based Promo Codes

### Requirement

Admin should control where a promotion is valid.

Applicable Channel:

- All
- Web App
- Mobile App

Example:

```text
Code: MOBILE10
Applicable Channel: Mobile App
```

If a web user tries to apply `MOBILE10`, backend must reject it.

### Recommended Data Model

Add a field to `promotions`:

```text
applicable_channel
```

Allowed values:

```text
all
web
mobile
```

Implementation rule:

- Use explicit `applicable_channel` for admin UI simplicity and reliable filtering.
- Also allow `context.channel` in conditions later if more complex channel targeting is needed.

### Backend Validation

Promotion evaluation request already carries context:

```json
{
  "context": {
    "channel": "web",
    "geo": "IN"
  }
}
```

Validation rule:

```text
promotion.applicable_channel = all
  -> valid for web and mobile

promotion.applicable_channel = web
  -> valid only when context.channel is web

promotion.applicable_channel = mobile
  -> valid only when context.channel is mobile or mobile_app
```

Rejected response should be clear:

```json
{
  "success": false,
  "message": "Promotion is valid only on Mobile App",
  "data": {
    "is_eligible": false,
    "ineligible_reason": "CHANNEL_NOT_ELIGIBLE"
  }
}
```

### Inventory UI

Promotion create/edit form should include:

```text
Applicable Channel
[ All ] [ Web App ] [ Mobile App ]
```

Default:

```text
All
```

## Enhancement 2 - Unique Customer Voucher

### Requirement

Admin can generate a unique voucher and assign it to a specific customer.

Example:

```text
Customer: Suresh
Voucher: THANKYOU-X7K92
Benefit: 10% OFF
Usage: Next 2 Orders
Expiry: 31-Dec-2026
```

Flow:

```text
Admin generates voucher
  -> assigns to customer
  -> voucher may be physically shared in order box
  -> customer enters code on next purchase
  -> backend verifies customer + validity + usage
  -> discount applied
  -> usage becomes 1 of 2
```

### Clarification

Do not call a percentage discount "flat".

Correct wording:

- `10% OFF`
- `Flat Rs. 100 OFF`

Incorrect wording:

- `Flat 10% OFF`

### Recommended Model

Keep the promotion campaign in `promotions`, and add assignment records for voucher ownership.

Recommended new table:

```text
promotion_assignments
```

Fields:

```text
id
promotion_id
assignment_type       // customer, customer_group
customer_id           // nullable
customer_group_id     // nullable
voucher_code          // unique code customer enters
usage_limit           // e.g. 2
used_count            // denormalized counter, optional but useful
start_date
end_date
status                // active, inactive, expired
createddate
modifieddate
```

The existing `promotions.code` can still be used for normal public/common codes.

For unique customer vouchers:

- `promotions.code` can be null or hold campaign prefix.
- `promotion_assignments.voucher_code` should hold the unique code.
- `promotion_assignments.customer_id` identifies the only eligible customer.
- `promotion_assignments.usage_limit` controls per-assignment usage.

### Why Not Only per_user_limit?

`per_user_limit` is useful, but not enough by itself.

It can answer:

```text
How many times can each user use this promotion?
```

It cannot fully answer:

```text
Which unique voucher code belongs to which customer?
Is THANKYOU-X7K92 assigned to Suresh?
How many times has this specific voucher assignment been used?
```

So `per_user_limit` should remain for normal promotions, while unique vouchers need assignment-level tracking.

### Voucher Generation

Recommended endpoint:

```http
POST /v1/promotions/:id/vouchers
```

Example request:

```json
{
  "customer_id": 101,
  "prefix": "THANKYOU",
  "usage_limit": 2,
  "end_date": "2026-12-31T23:59:59.000Z"
}
```

Example response:

```json
{
  "success": true,
  "message": "Voucher generated successfully",
  "data": {
    "promotion_id": 55,
    "customer_id": 101,
    "voucher_code": "THANKYOU-X7K92",
    "usage_limit": 2,
    "used_count": 0,
    "end_date": "2026-12-31T23:59:59.000Z"
  }
}
```

Voucher code generation requirements:

- uppercase.
- unique.
- not easily guessable.
- collision-safe with retry.
- indexed in database.

## Enhancement 3 - Customer and Customer-Group Promotions

### Individual Customer

Example:

```text
Voucher ABC123
Only Customer A can use it
```

Validation:

- voucher code exists.
- assignment type is customer.
- assignment customer matches authenticated user.
- assignment status is active.
- promotion status is active.
- channel is valid.
- current date is inside promotion and assignment validity windows.
- usage limit is not exceeded.

### Customer Group

Example:

```text
Customer Group: Corporate ABC
Promotion: 10% OFF
All customers belonging to that group can use it
```

Recommended for corporate customers:

- use customer groups.
- do not manually assign the same promotion to every employee unless required.

### Customer Group Model

No customer group model is visible in the current Prisma schema. Add one if corporate promotions are in scope.

Recommended tables:

```text
customer_groups
customer_group_members
```

`customer_groups`:

```text
id
name
code
description
status
createddate
modifieddate
```

`customer_group_members`:

```text
id
customer_group_id
customer_id
status
createddate
modifieddate
```

Promotion assignment can then target:

```text
assignment_type = customer_group
customer_group_id = corporate group id
```

## Corporate Voucher Strategy

Two possible approaches:

### Option A - One Common Corporate Code

Example:

```text
Code: CORPABC10
Group: Corporate ABC
Benefit: 10% OFF
Usage: 2 times per customer
```

Pros:

- simple admin setup.
- easy communication.

Cons:

- code can be shared outside the group.
- backend must strictly check group membership.
- less granular voucher tracking.

### Option B - Unique Code Per Corporate User

Example:

```text
Campaign: Corporate ABC 10% OFF
Suresh: CORPABC-X7K92
Kumar: CORPABC-P4A81
```

Pros:

- best individual usage tracking.
- easy to revoke one user's voucher.
- lower abuse risk.

Cons:

- more records.
- needs bulk generation and export/share flow.

Recommended:

- For corporate customers, use customer groups.
- If accurate individual tracking matters, generate unique voucher codes under the same campaign for each group member.

## Supported Voucher Benefits

Use existing promotion `type` and `action` where possible.

Promotion action types should be extended to include:

```text
WALLET_CREDIT
```

Examples:

### 10% OFF Next 2 Orders + Expiry

```text
type = PERCENT_OFF_CART
action = { "type": "PERCENT_OFF", "value": 10 }
assignment.usage_limit = 2
assignment.end_date = 2026-12-31
```

### Flat Rs. 100 OFF

```text
type = FIXED_AMOUNT_OFF_CART
action = { "type": "FIXED_AMOUNT_OFF", "value": 100 }
```

### 10% OFF Next Order + No Expiry

```text
type = PERCENT_OFF_CART
action = { "type": "PERCENT_OFF", "value": 10 }
assignment.usage_limit = 1
assignment.end_date = null
```

### Rs. 100 Wallet Credit

Wallet credit should be configured in the Promotion module, but the credited money must be maintained by the Wallet module.

Promotion responsibility:

```text
What benefit does the customer receive?
```

Examples:

- 10% discount
- Flat Rs. 100 discount
- Free shipping
- Rs. 100 wallet credit

Wallet responsibility:

```text
How is wallet money managed?
```

Examples:

- credit
- debit
- balance
- credit expiry
- refund credit
- transaction history

Important:

- Do not mix wallet credit into normal `discount_amount`.
- Promotion validates eligibility and triggers wallet credit.
- Wallet owns the money ledger after the voucher is redeemed.

Example promotion configuration:

```text
Promo Code: WALLET100
Reward Type: Wallet Credit
Wallet Credit: Rs. 100
Coupon Validity: use before 31-Aug
Wallet Credit Validity: credit expires 30 days after redemption
Usage: one time
Assigned To: Customer A
```

Redemption flow:

```text
Customer enters WALLET100
  -> Promotion engine validates coupon
  -> verifies customer eligibility
  -> verifies coupon has not exceeded usage limit
  -> verifies coupon validity window
  -> valid
  -> Wallet gets Rs. 100 promotional credit
  -> Wallet transaction is created
  -> Promotion redemption is recorded
```

After wallet credit is created, the promotion's job is complete. Balance usage, expiry, and transaction history are Wallet module concerns.

There are two separate expiry concepts:

```text
Coupon validity:
Use WALLET100 before 31-Aug.

Wallet credit validity:
After redeeming, Rs. 100 expires after 30 days.
```

These values do not need to be the same.

If admin wants to directly add Rs. 100 to a customer's wallet without requiring coupon entry, that should be a Wallet/Admin credit action, not a promotion.

Recommended handling:

- Add `WALLET_CREDIT` as a promotion reward/action type.
- Add wallet-credit-specific action fields.
- On promotion redemption, call Wallet service to create a promotional wallet credit transaction.
- Store wallet transaction reference in promotion redemption metadata.
- If wallet system does not exist yet, implement Wallet ledger before enabling wallet-credit promotions.

Example action:

```json
{
  "type": "WALLET_CREDIT",
  "value": 100,
  "credit_expiry_days": 30
}
```

Recommended promotion redemption metadata:

```json
{
  "voucher_code": "WALLET100",
  "reward_type": "WALLET_CREDIT",
  "wallet_credit_amount": 100,
  "wallet_credit_expiry_days": 30,
  "wallet_transaction_id": "wallet_txn_123"
}
```

Wallet credit should be idempotent. The same promotion redemption must not create multiple wallet credit transactions.

## Evaluation Flow

Manual coupon evaluation should follow this flow:

```text
Receive user_id + code + cart + context.channel
  -> find matching promotion by promotions.code OR promotion_assignments.voucher_code
  -> validate promotion status/date/channel
  -> if assignment exists, validate customer/group ownership
  -> validate usage limits from promotion_redemptions
  -> validate cart/user conditions
  -> calculate discount
  -> create/update promotion_evaluations
  -> return applied or ineligible result
```

### Channel Validation

Must happen before discount calculation.

### Customer Assignment Validation

Must happen before discount calculation.

### Usage Validation

Must check:

- promotion `max_redemptions`
- promotion `per_user_limit`
- assignment `usage_limit`, if assignment exists

Recommended source of truth:

- `promotion_redemptions` rows.

Counters can be denormalized, but redemption rows must remain the audit trail.

## Redemption Flow

Redemption should happen after successful order placement.

```text
Order created
  -> redeem evaluation
  -> insert promotion_redemptions
  -> update evaluation status to redeemed
  -> optionally increment denormalized counters
```

For assigned vouchers, each redemption record should include assignment info.

Recommended extension to `promotion_redemptions.redemption_data`:

```json
{
  "voucher_code": "THANKYOU-X7K92",
  "assignment_id": 123,
  "assignment_type": "customer",
  "customer_id": 101
}
```

If database changes are allowed, add direct columns:

```text
assignment_id
voucher_code
```

## Backend Changes

### Prisma

Potential changes:

- add `promotions.applicable_channel`.
- add `promotion_assignments`.
- add `customer_groups`.
- add `customer_group_members`.
- optionally add `promotion_redemptions.assignment_id`.
- optionally add `promotion_redemptions.voucher_code`.

### Schemas

Update:

- `Server/src/schemas/promotions.schema.ts`

Add:

- `applicable_channel`
- assignment/voucher schemas
- customer-group schemas if included in this CR
- `WALLET_CREDIT` action type
- wallet credit amount validation
- wallet credit expiry validation

### Services

Update:

- `Server/src/services/promotions.service.ts`
- `Server/src/services/promotion-evaluation.service.ts`
- `Server/src/services/promotion-redemption.service.ts`

Add helpers:

- `validatePromotionChannel`
- `findPromotionByCodeOrVoucher`
- `validateVoucherAssignment`
- `validatePromotionUsageLimits`
- `getCustomerGroups`
- `generateUniqueVoucherCode`
- `applyWalletCreditReward`
- `ensureWalletCreditRedemptionIdempotency`

Wallet integration:

- Promotion redemption should call Wallet service only after coupon eligibility is confirmed.
- Wallet service should create a credit transaction with type `promotional_credit`.
- Promotion redemption should store the wallet transaction ID.
- If wallet credit creation fails, promotion redemption should fail and can be retried safely.
- Retrying redemption must not duplicate wallet credit.

### Routes

Add or extend:

```http
POST /v1/promotions/:id/vouchers
GET /v1/promotions/:id/vouchers
PATCH /v1/promotions/vouchers/:assignmentId
POST /v1/customer-groups
GET /v1/customer-groups
POST /v1/customer-groups/:id/members
DELETE /v1/customer-groups/:id/members/:customerId
```

If customer groups are deferred, implement only customer voucher assignment first.

## Inventory UI Changes

Promotion form:

- Add Applicable Channel segmented control:
  - All
  - Web App
  - Mobile App

Promotion detail:

- Show channel.
- Show assigned vouchers.
- Show redemptions/usage.

Voucher generation modal:

- select customer.
- enter prefix.
- choose benefit from promotion campaign.
- set usage limit.
- set expiry.
- generate code.

Customer group UI:

- create group.
- add/remove customers.
- assign promotion to group.
- optionally bulk-generate unique vouchers for group members.

## Test Cases

### App-Based Promo Codes

- `MOBILE10` with channel mobile works on mobile.
- `MOBILE10` is rejected on web.
- web-only promotion is rejected on mobile.
- all-channel promotion works on web and mobile.
- auto-applied promotions respect channel.
- public promotions endpoint respects channel.

### Unique Customer Voucher

- assigned customer can apply voucher.
- different customer cannot apply voucher.
- voucher expires correctly.
- voucher with usage limit 2 works twice and fails third time.
- usage count updates only after successful order redemption.
- evaluation without order does not consume usage.
- cancelled/failed order behavior is defined and tested.

### Wallet Credit Voucher

- eligible customer redeems wallet credit voucher.
- wallet balance increases by configured amount.
- wallet transaction is created with promotional credit type.
- wallet credit expiry is calculated from redemption date.
- coupon validity and wallet credit validity are handled separately.
- repeated redemption call does not create duplicate wallet credit.
- direct admin wallet credit does not create promotion redemption.

### Customer Group Promotion

- customer in group can apply group promotion.
- customer outside group cannot apply group promotion.
- common corporate code respects per-user usage limit.
- unique corporate voucher tracks usage per assigned customer.

### Redemption

- duplicate redemption for same evaluation is rejected.
- per-user limit is enforced from redemption history.
- max redemption limit is enforced.
- assignment usage limit is enforced.

## Open Decisions

1. For corporate/customer-group promotions, should users share one common code or receive unique codes per customer under the same campaign?
2. What should happen to voucher usage when an order is cancelled or refunded?
3. Should wallet promotional credit be usable with all products/orders or have wallet-side restrictions?
4. Which reward types are enabled in phase 1: percentage discount, flat discount, free shipping, wallet credit, or all?

## Recommended Implementation Sequence

1. Confirm open decisions.
2. Add channel field and validation first.
3. Enforce channel in manual and automatic promotion evaluation.
4. Add customer voucher assignment model.
5. Add voucher generation API.
6. Add voucher ownership and usage validation.
7. Update redemption to record assignment/voucher usage.
8. Add Wallet service integration for `WALLET_CREDIT` rewards.
9. Add Inventory UI for channel selection.
10. Add Inventory UI for voucher generation and assignment.
11. Add customer-group model and UI if confirmed in this CR.
12. Add tests for channel, customer voucher, wallet credit, group promotion, and redemption limits.
