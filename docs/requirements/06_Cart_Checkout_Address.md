# 06 · Cart, Wishlist, Addresses and Checkout

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` (`cart.*`, `address.*`, `checkoutPricing.ts`, `phonepe.controller.ts` validation), Master.md FIX-2026-10-05-28 … FIX-2026-10-07-52.

## 1. Purpose

Lets a customer collect products, choose a delivery address and offers, and reach payment with a price that matches on web, mobile and the backend.

## 2. Cart and wishlist

- **CRT-01** Cart and wishlist share the `cart` table. A row is either a cart item (`iscart`) or a wishlist item (`iswishlist`), never both and never neither.
- **CRT-02** A cart item needs a user, a product and a quantity of at least 1. A product that is not available cannot be added.
- **CRT-03** `POST /v1/carts/upsert` adds to or updates an existing row, so adding the same product again increases its quantity (FIX-2026-10-05-21).
- **CRT-04** The cart is cleared for a user after a successful order (`DELETE /user/:userId/clear`).
- **CRT-05** **Unavailable items block checkout.** An item is unavailable when it is out of stock or its quantity is above the available stock (combo stock is derived from its components). The cart shows "N item(s) unavailable" (FIX-2026-10-06-45).
- **CRT-06** Guests keep their cart on the device. Automatic savings are shown to guests, but manual offers are not promised until login (FIX-2026-10-04-20).

## 3. Addresses

- **CRT-07** A customer address has name, mobile, pincode, door number, address, landmark, city and state. The default address is returned by `GET /v1/addresses/default/:userId`.
- **CRT-08** Mobile numbers are normalised before saving: a leading +91, 91 or 0 is removed and 10 digits are kept (FIX-2026-10-05-33).
- **CRT-09** Checkout and Saved Addresses use the same address form, with inline errors and the +91 prefix (FIX-2026-10-05-34).
- **CRT-10** The order stores the address id it was delivered to.

## 4. Checkout price

- **CRT-11** The price is built in this order:
  1. list price
  2. product discount
  3. promotions (module 05)
  4. standalone coupon (merchandise only)
  5. shipping
  6. wallet
  7. amount payable online / COD
- **CRT-12** Standard shipping is **₹150** (`STANDARD_CHECKOUT_SHIPPING_AMOUNT`). Only a Free Shipping promotion can waive it.
- **CRT-13** The totals use **only the live V2 quote**. Saved selections and old free-shipping records are never merged in (FIX-2026-10-06-43).
- **CRT-14** Cart and Checkout use the same offer-button rule. An applied offer shows as a green "✓ Applied" card with a grey Remove link (FIX-2026-10-05-28 / -29).
- **CRT-15** Before payment the backend checks again:
  - product price available (`CHECKOUT_PRODUCT_PRICE_UNAVAILABLE`)
  - promotion evaluation still valid
  - coupon quote unchanged
  - wallet reservation unchanged
  - stock sufficient: `product.availablequantity ≥ qty` **and** platform `availableqty ≥ qty` (`availableqty` already excludes locked units)
- **CRT-16** Every product on the order must have valid HSN/GST, otherwise the order is refused.

## 5. Screens

- **E-com:** Cart, Checkout (address, offers, "Your coupons", wallet row, payment), Wishlist (skeleton until product details load), Saved Addresses.
- **Mobile:** Cart → Stepper (address → offers → payment), Wishlist, Address Book.

## 6. Gaps and items to confirm

- Shipping is a flat ₹150 in checkout. `logistics_costs` and `shippingCalculator.ts` (Ekart dimensions / weight) are not used for customer charges. Confirm that this is final.
- There is no requirement for cart expiry or abandoned-cart cleanup. Push cart reminders exist (module 13).

## 7. Source documents

`CART_UPSERT_IMPLEMENTATION.md`, `CART_DELETION_IN_PHONEPE_FLOW.md`, `GUEST_CHECKOUT_*`, `free_shipping_implementation_guide.md`, mobile `CART_STOCK_VALIDATION.md`, `CART_EVALUATION_INTEGRATION.md`, `ADDRESS_SELECTION_FEATURE.md`.
