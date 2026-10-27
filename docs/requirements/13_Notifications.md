# 13 · Notifications — Push, Email, SMS

**Version:** 1.0 · **As of:** 2026-10-27 · **Built from:** backend `DEV-NEW` (`push-notification.*`, `apns.service.ts`, `customer-notification.service.ts`, `customer-email-notification.service.ts`, `email.service.ts`, `sms.*`, `exotelSms` / `twilioSms` services).

## 1. Purpose

Tells customers what is happening with their orders, returns and offers through push, email and SMS.

## 2. Push notifications

- **NTF-01** The mobile app registers its device token after login (`POST /v1/push-notifications/register`) with platform, provider (FCM or APNs), device id, app version, build number and permission status. It unregisters on logout.
- **NTF-02** Tokens are kept per customer or inventory user (`pushdevice`). Tokens rejected by FCM / APNs raise a failure count and are disabled.
- **NTF-03** Customer push is sent on:
  - payment success
  - payment failure
  - order status change (only on a real change; never for a courier cancel)
  - return status change, including inspection rejected
- **NTF-04** **Campaigns** (admin):
  - Cart reminders (`/campaigns/cart-reminders`): carts idle for at least 15 minutes (default 60), up to 500 users per run (default 100)
  - Promotion broadcast (`/campaigns/promotions`)
- **NTF-05** `POST /test` sends a test push to the caller.

## 3. Email

- **NTF-06** Order emails, sent over Gmail SMTP:
  - order confirmation
  - payment confirmation
  - shipment update
  - delivery confirmation
  - order cancellation
  - refund notification (amount and reference)
- **NTF-07** Promotion voucher emails go to a customer or to every member of a customer group.
- **NTF-08** No shipment email is sent when a courier cancel moves an order back to Ready for Dispatch (FIX-2026-10-20-119).
- **NTF-09** The E-com contact address shown everywhere is **ReachUs@nivaana.in** (FIX-2026-10-21-122).

## 4. SMS

- **NTF-10** SMS is used for OTP only (module 01): Exotel with DLT entity / template ids, Twilio, and Infobip as fallback.

## 5. Gaps and items to confirm

- **There is no written list of which events notify which channel.** Confirm this event × channel matrix with the BA:

  | Event | Push | Email | SMS |
  | --- | --- | --- | --- |
  | Payment success | ✅ | ✅ | ❓ |
  | Order shipped / delivered | ✅ | ✅ | ❓ |
  | Order cancelled / refunded | ✅ | ✅ | ❓ |
  | Return status | ✅ | ❓ | ❓ |
  | Offers | ✅ (broadcast) | ✅ (voucher) | ❓ |

- Nothing runs the cart reminders and promotion broadcasts on a schedule; they are triggered manually through the API. Confirm whether a Cloud Scheduler job is wanted.
- There is no customer opt-out or notification preference setting. The mobile Fragrance Preferences screen covers scents, not notifications.

## 6. Source documents

`SMS_API_DOCUMENTATION.md`, `SMS_QUICK_REFERENCE.md`, `DLT_SETUP_VERIFICATION_GUIDE.md`, `TWILIO_INTEGRATION_SUMMARY.md`, mobile `APP_UPDATE_FEATURE.md`, Firebase / APNs setup notes in the mobile repo.
