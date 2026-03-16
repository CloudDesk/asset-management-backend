# PlatformStock Field Lifecycle - Official Reference

Last updated: 2026-03-16

This document is the source of truth for when these `platformstock` fields change:

- `availableqty`
- `ecomqty`
- `lockqty`
- `orderedqty`
- `soldqty`

It is based on the current implementation in:

- [src/controllers/phonepe.controller.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/controllers/phonepe.controller.ts)
- [src/services/orders.service.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/services/orders.service.ts)
- [src/services/platformStock.service.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/services/platformStock.service.ts)

## Core Rule

`availableqty` is not an independent business value.

It must always represent:

```text
availableqty = max(0, ecomqty - orderedqty - soldqty - lockqty)
```

Code reference:

- [platformStock.service.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/services/platformStock.service.ts#L781)

## Field Meaning

`ecomqty`

- True e-commerce published quantity for that platform.
- Derived from actual stock records.
- It represents stock items that are `stockstatus = 'available'` and `ecompublish = true`.
- It should change only when stock state or e-commerce publish state changes.

`availableqty`

- Sellable quantity for new orders on that platform.
- It is the result of the formula above.
- It should go down during temporary lock, go back up on lock release, stay unchanged when lock converts to order, and be recalculated whenever `ecomqty`, `orderedqty`, `soldqty`, or `lockqty` changes.

`lockqty`

- Temporary checkout/payment reservation.
- Used during PhonePe initiate before payment success.
- Reduced back on payment failure/expiry cleanup.
- Converted down on payment success.

`orderedqty`

- Confirmed order quantity, before stock allocation/dispatch.
- Increased when payment is confirmed.
- Decreased when stock is allocated to sold, or when pre-dispatch cancellation happens.

`soldqty`

- Allocated/dispatched quantity.
- Increased when order moves to stock allocation / dispatch.
- Decreased when post-dispatch cancellation reverses sold stock.

## Lifecycle by Event

### 1. Stock add / stock publish / stock status recalculation

What changes:

- `ecomqty` may increase or decrease
- `soldqty` may increase or decrease
- `availableqty` is recalculated
- `orderedqty` stays as-is
- `lockqty` stays as-is

Why:

- `ecomqty` comes from actual stock records, not from checkout/order flow.
- `orderedqty` and `lockqty` are preserved while stock totals are recalculated.

Code references:

- [platformStock.service.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/services/platformStock.service.ts#L852)
- [platformStock.service.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/services/platformStock.service.ts#L873)

### 2. PhonePe initiate

What changes:

- `lockqty` increases
- `availableqty` decreases
- `ecomqty` unchanged
- `orderedqty` unchanged
- `soldqty` unchanged

Formula:

```ts
newLockQty = currentLockQty + requestedQuantity;
newAvailableQty =
  Math.max(0, currentEcomQty - currentOrderedQty - currentSoldQty - newLockQty);
```

Meaning:

- Stock is temporarily reserved.
- The item must stop being available for new orders immediately.
- It is not yet a confirmed order.

Code references:

- Single product: [phonepe.controller.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/controllers/phonepe.controller.ts#L994)
- Combo component lock: [phonepe.controller.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/controllers/phonepe.controller.ts#L6002)

### 3. Payment failed / expired / cleanup task

What changes:

- `lockqty` decreases
- `availableqty` increases back
- `ecomqty` unchanged
- `orderedqty` unchanged
- `soldqty` unchanged

Formula:

```ts
newLockQty = Math.max(0, currentLockQty - quantityToRelease);
newAvailableQty =
  Math.max(0, currentEcomQty - currentOrderedQty - currentSoldQty - newLockQty);
```

Meaning:

- The temporary reservation is removed.
- The stock becomes available for new orders again.

Code references:

- Single product cleanup: [phonepe.controller.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/controllers/phonepe.controller.ts#L5030)
- Combo cleanup helper: [phonepe.controller.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/controllers/phonepe.controller.ts#L6147)

### 4. Payment success / order confirmed

What changes:

- `lockqty` decreases
- `orderedqty` increases
- `availableqty` stays the same in net effect
- `ecomqty` unchanged
- `soldqty` unchanged

Formula:

```ts
newPlatformLockQty = Math.max(0, currentLockQty - quantityToConvert);
newPlatformOrderedQty = currentOrderedQty + quantityToConvert;
newPlatformAvailableQty =
  Math.max(0, currentEcomQty - newPlatformOrderedQty - currentSoldQty - newPlatformLockQty);
```

Meaning:

- This is a conversion from temporary reserve to confirmed order.
- The stock was already removed from sellable availability during initiate.
- Therefore `availableqty` should remain the same in normal 1:1 conversion.

Code references:

- Single product callback conversion: [phonepe.controller.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/controllers/phonepe.controller.ts#L4430)
- Combo component conversion: [phonepe.controller.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/controllers/phonepe.controller.ts#L5627)

### 5. Ready for dispatch / stock allocation

What changes:

- `orderedqty` decreases
- `soldqty` increases
- `ecomqty` decreases for e-commerce-published sold stock
- `availableqty` is recalculated
- `lockqty` unchanged

Formula:

```ts
newOrderedQty = Math.max(0, currentOrderedQty - update.quantity);
newSoldQty = currentSoldQty + update.quantity;
newEcomQty = Math.max(0, currentEcomQty - update.ecomQuantity);
newAvailableQty =
  Math.max(0, newEcomQty - newOrderedQty - newSoldQty - currentLockQty);
```

Meaning:

- Ordered stock is now physically allocated/sold.
- Those units are no longer in `ecomqty`.

Code reference:

- [orders.service.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/services/orders.service.ts#L1259)

### 6. Pre-dispatch cancellation

What changes:

- `orderedqty` decreases
- `availableqty` increases
- `ecomqty` unchanged
- `soldqty` unchanged
- `lockqty` unchanged

Formula:

```ts
newOrderedQty = Math.max(0, currentOrderedQty - update.quantity);
newAvailableQty =
  Math.max(0, currentEcomQty - newOrderedQty - currentSoldQty - currentLockQty);
```

Meaning:

- Confirmed order is reversed before physical stock was sold.
- Sellable quantity returns to availability.

Code reference:

- [orders.service.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/services/orders.service.ts#L4053)

### 7. Post-dispatch cancellation

What changes:

- `soldqty` decreases
- `ecomqty` increases
- `availableqty` increases
- `orderedqty` unchanged
- `lockqty` unchanged

Formula:

```ts
newSoldQty = Math.max(0, currentSoldQty - update.quantity);
newEcomQty = currentEcomQty + update.ecomQuantity;
newAvailableQty =
  Math.max(0, newEcomQty - currentOrderedQty - newSoldQty - currentLockQty);
```

Meaning:

- Previously sold stock is returned back into available e-commerce stock.

Code reference:

- [orders.service.ts](/Users/jeyakumarn/Documents/GitHub/Suresh-on-cloud/asset-management-backend/src/services/orders.service.ts#L4318)

## Short Confirmation

These statements are correct for the current codebase:

- `availableqty` is the platform sellable quantity, not a raw stock count.
- During PhonePe initiate, `availableqty` is reduced and `lockqty` is increased.
- If payment fails or expires, cleanup reduces `lockqty` and restores `availableqty`.
- `ecomqty` is the true published e-commerce quantity and should only change from stock/publish/sold-state changes.
- On payment success, `lockqty` decreases and `orderedqty` increases.
- On payment success, `availableqty` should remain unchanged in net effect because the reservation is only converted from lock to order.
- `soldqty` should only change when stock is allocated/dispatched or reversed from that state.

## Important Clarification

Do not treat `availableqty` as:

```text
totalqty - orderedqty - soldqty - lockqty
```

for this codebase.

The implemented formula is:

```text
availableqty = ecomqty - orderedqty - soldqty - lockqty
```

That distinction matters because non-e-commerce stock contributes to `totalqty` but must not become sellable on the platform.
