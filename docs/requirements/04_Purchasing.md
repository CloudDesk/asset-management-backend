# 04 · Purchasing — Suppliers, Purchase Requests, Quotes, Notes, Purchase Orders, PO Invoices, Sample Requests

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` (`supplier.*`, `purchaserequest.*`, `quotes.*`, `notes.*`, `purchaseorder.*`, `poinvoice.*`, `samplepurchaserequest.*`, Prisma models), Master.md FIX-2026-10-07-58 / 62 / 64 / 65 / 70.

## 1. Purpose

Covers buying stock from suppliers: supplier master → purchase request (PR) → supplier quotes → purchase order (PO) → supplier invoice and payment → stock received against the PO.

## 2. Suppliers

- **PUR-01** A supplier has:
  - name, unique **supplier code**, phone, landline, email, GST number
  - address (door, street, city, state, pincode, country)
  - type `local` (default) or import (`suppliertype`; other values are rejected: "Invalid supplier type")
- **PUR-02** A supplier code must be unique on create and update. A duplicate returns 400 "Supplier code '<code>' is already in use." and the form keeps the values (FIX-2026-10-07-58).
- **PUR-03** Suppliers are soft-deleted (`isdeleted`). `GET /:id/stats` gives PR, PO and stock counts. The detail page has the tabs Detail, Purchase Requests and Purchase Orders.

## 3. Purchase requests

- **PUR-04** A PR records the buying company (name, address, contact, phone, GST, email), the supplier, a PR number, line data (`prdata` JSON) and a generated PR document (`prurl`).
- **PUR-05** PR status starts as **"In Progress"**. A PR can be approved (`PUT /:id/approve`) or rejected (`PUT /:id/reject`).
- **PUR-06** PRs can be listed by supplier and by user.

## 4. Quotes and notes

- **PUR-07** Supplier quotes are attached to a PR by PR number (`POST /v1/quotes/attach-with-pr-update` uploads the file and updates the PR together). A quote has a number, status, data, file URL and notes.
- **PUR-08** Notes (title, comment, pinned flag) are kept per quote number (`/v1/notes/quotenumber/:quotenumber`). `GET /v1/notes/stats` gives counts.

## 5. Purchase orders

- **PUR-09** A PO holds:
  - the buyer (company), invoice-to (`io_*`) and deliver-to (`dt_*`) parties
  - the supplier snapshot (address, company, phone, GST) and the PR number
  - products, subtotal, discount, SGST / CGST, tax, total
  - payment terms, overdue date, instructions, comments
  - supplier type, and the PO file / invoice URLs
- **PUR-10** PO status is changed with `PUT /:id/status`. Values come from the PO-status picklist (for example Draft / In Progress / Completed / Cancelled); see PUR-18.
- **PUR-11** **Generate PO** builds the PDF through the file service (`/generate-document/po`):
  - the URL comes from the environment config, never hard-coded (FIX-62)
  - the request sends the user's token, so the file service callback can update the PO (FIX-64)
- **PUR-12** Stock rows can reference their PO (`stock.poid`); stock import checks that the PO exists.

## 6. PO invoices and payment

- **PUR-13** A supplier invoice belongs to a PO number and records:
  - number, date, amount, balance, invoice status, file URL
  - credit payment flag and due date, payment data
  - transport charges
  - for import suppliers: exchange amount, customs duty, duty challan and bill of entry URLs
- **PUR-14** Saving an invoice updates the PO's purchase-order status ("Failed to update purchase order status" if this cannot be done). Invoice statuses come from the picklist (seen: Pending / Paid / Fully Paid).

## 7. Sample purchase requests

- **PUR-15** A sample PR asks a supplier for samples. It has its own create / detail pages and a Create Shipment page in Inventory. Required fields are checked on create.

## 8. Inventory screens

Suppliers, Purchase Requests (add / edit), Purchase Orders (create / detail with PO PDF), Sample Purchase Requests (create / detail / create shipment). All detail pages show full-page loading skeletons.

## 9. Decision (2026-10-28): keep the current flow

**The current PR / PO flow described above is the approved requirement. No change is planned.** This means:
- **PUR-16** A PR is approved or rejected by any user who has edit access to purchase requests. There are no approval levels.
- **PUR-17** A PO is created manually and may reference a PR number. An approved PR is not required, and approving a PR does not create a PO.
- **PUR-18** PO and invoice status values come from their picklists. There are no fixed transition rules.
- **PUR-19** There is **no goods-receipt step**. Stock is added through Bulk Add / Import, and the PO ID on a stock row is optional. Received quantities are not compared with PO quantities, and the PO status does not change when stock is added.
- **PUR-20** There is no automatic matching between supplier invoices and POs beyond the PO number and the status update in PUR-14.

## 10. Remaining item to confirm

- `servicecostestimation`, `tickets` and `revoinvoice` tables exist (service / repair tickets) but have no routes. Confirm whether they are retired.

## 11. Source documents

`POINVOICE_API_DOCUMENTATION.md`, `POINVOICE_TEST_PLAN.md`, `PURCHASE_ORDER_STATUS_TEST_PLAN.md`, `SAMPLE_PURCHASE_REQUEST_API_DOCUMENTATION.md`, `QUOTE_ATTACHMENT_DOCUMENTATION.md`, `POST_Supplier_API_Test_Results.md`.
