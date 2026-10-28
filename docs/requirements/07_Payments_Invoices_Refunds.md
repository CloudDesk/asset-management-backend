# 07 · Payments (PhonePe / COD), Transactions, Invoices, Credit Notes and Refunds

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` (`phonepe.*`, `transaction.*`, `refund-operation.service.ts`, `invoice-adjustment.service.ts`, `invoice-seller-address.ts`, `gst.service.ts`), `docs/phonepe/*`, Master.md FIX-2026-10-06-44 / 48, FIX-2026-10-08-90, FIX-2026-10-09-99.

## 1. Purpose

Takes payment for e-commerce orders, records every transaction, issues GST invoices, and refunds customers correctly (to the wallet or back to the original payment).

## 2. Online payment (PhonePe)

- **PAY-01** `POST /v1/phonepe/initiate` (web) and `/create-sdk-order` (mobile SDK) run these steps:
  1. validate the promotion evaluation, products and platform stock
  2. lock stock (`SELECT … FOR UPDATE`)
  3. save the transaction with the original cart payload
  4. return PhonePe's redirect / SDK token
- **PAY-02** On the PhonePe webhook (`POST /v1/phonepe/webhook`) or redirect callback (`GET|POST /v1/phonepe/callback/:transactionId`), the backend checks the payment status with PhonePe. On success, `createOrderAfterPayment` (the single entry point):
  - creates the order and order lines
  - redeems promotions, coupons and the wallet reservation
  - converts locks into ordered quantity
  - clears the cart
  - redirects to the success or failure URL
- **PAY-03** Return URLs must be in `PAYMENT_RETURN_URL_ALLOWED_ORIGINS` (`ECOM_PAYMENT_RETURN_URL`, `MOBILE_PAYMENT_RETURN_URL`).
- **PAY-04** If payment does not complete, a Cloud Task (`/v1/phonepe/cleanup-lock`, default 120 s) checks the status and releases the stock lock and the wallet reservation.
- **PAY-05** If promotion redemption fails after a successful payment, the order is kept and marked for manual review (logged as CRITICAL).
- **PAY-06** For Meta in-app browsers (Instagram / Facebook), e-com opens PhonePe's iframe PayPage (`VITE_PHONEPE_IFRAME_CHECKOUT`), with full-page redirect as the fallback (FIX-2026-10-06-44).
- **PAY-07** The pending-payment guard is cleared after a normal success, so a second order in the same tab starts a new payment and never shows the previous order's confirmation (FIX-2026-10-06-48).
- **PAY-08** Operations: `/status/:merchantTransactionId`, `/bulk-status`, `/stats`, `/user/:userId/transactions`, `/health`.

## 3. Cash on delivery

- **PAY-09** COD orders lock stock and convert it to ordered quantity at order creation.
- **PAY-10** `cod_payment_received` can be set only for COD orders and only after `delivered`. The COD amount and reference are recorded.
- **To confirm:** the shipping-policy page says "Cash on Delivery: ₹50 additional charge", but checkout does not add it, and the e-com web checkout shows only PhonePe. Confirm whether COD is offered to customers and on which channels.

## 4. In-store payment

- **PAY-11** In-store orders take cash, card or UPI (module 08). No online payment is involved.

## 5. Transactions

- **PAY-12** Every payment attempt is a `transaction` row: transaction id, merchant transaction id, user, amount, mobile, purpose and the raw data. The E-com Payments page lists only payment orders, with their transaction ids (FIX-2026-10-06-39).

## 6. Tax invoice

- **PAY-13** An invoice is generated per order (`POST /v1/orders/:id/generate-invoice`, PDF through the file service `/order/invoice`). It uses the order-line HSN / GST snapshots, splitting CGST + SGST within the state and IGST across states (store pincode from `WAREHOUSE_PINCODE`).
- **PAY-14** The seller address can be set per order (`PATCH /:id/invoice-seller-address`):
  - all address fields are required
  - GSTIN exactly 15 letters / digits
  - phone 10–15 digits
  - pincode exactly 6 digits

## 7. Refunds

- **PAY-15** Each refund is one `RefundOperation`, created with an idempotency key, for a cancellation or a return. Its destination is either:
  - **original sources**: the wallet part goes back to the wallet and the online part goes back to PhonePe
  - **wallet**: everything as non-expiring wallet credit, with the customer's consent recorded
- **PAY-16** Wallet credit that has already expired is not given back as wallet. Only valid credit is restored (`expiredWalletAmount` is tracked separately).
- **PAY-17** PhonePe refunds: `POST /refund/:merchantTransactionId`, `GET /refund-status/:refundId`. The operation tracks wallet status and PhonePe status separately.
- **PAY-18** The refund amount is the **amount actually paid** for the line. A stored ₹0 (fully discounted item) refunds ₹0 and closes with no refund operation and no credit note (FIX-2026-10-08-90). An amount above the paid amount is rejected.
- **PAY-19** Order cancellation shows a refund preview (`GET /:id/cancellation-refund-preview`) before `POST /:id/cancellation-refund`. `PATCH /:id/refund-status` updates it manually.

## 8. Credit notes and invoice adjustments

- **PAY-20** A return refund issues a GST **credit note** (`ReturnCreditNote`: taxable amount, CGST / SGST / IGST, HSN) and an **invoice adjustment** recording the original and remaining invoice amounts.
- **PAY-21** Several returns on one order reduce the remaining amount step by step (for example ₹285 → ₹190 → ₹95) (FIX-2026-10-09-99).
- **PAY-22** Credit notes export to Excel (`GET /v1/returns/credit-notes/export`). A return invoice PDF can be generated per adjustment.

## 9. Gaps and items to confirm

- The COD charge and COD availability are described above under COD.
- PhonePe hardening items in `docs/phonepe/payment-flow-and-operations.md` §6 are still listed as "recommended".

## 10. Source documents

`docs/phonepe/payment-flow-and-operations.md`, `sdk-integration.md`, `orderline-discount-fix.md`, `docs/Fix_After_Sep30/2026-10-06-phonepe-pending-payment-guard-fix.md`, `PHONEPE_*` (older), `INVOICE_*`, `FINAL_INVOICE_PAYLOAD.md`, `TRANSACTION_STATUS_COMPLETE_GUIDE.md`, `RETURN_REPLACEMENT_INVENTORY_QUANTITY_FLOW.md`.
