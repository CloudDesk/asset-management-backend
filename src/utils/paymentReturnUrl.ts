export type PaymentChannel = "ecom" | "mobile";

const DEFAULT_ECOM_RETURN_URL =
  "https://nivaana.in/checkout/confirmation";
const DEFAULT_MOBILE_RETURN_URL = "nivaana://Main/ProfileTab/MyOrders";

function configuredOrigins(): string[] {
  return (process.env.PAYMENT_RETURN_URL_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedWebReturnUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const url = new URL(value);
    const isConfiguredOrigin = configuredOrigins().includes(url.origin);
    const isLocalDevelopment =
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      (isConfiguredOrigin || isLocalDevelopment)
    );
  } catch {
    return false;
  }
}

export function getEcomPaymentReturnUrl(): string {
  return (
    process.env.ECOM_PAYMENT_RETURN_URL ||
    process.env.REDIRECT_URL_SUCCESS ||
    DEFAULT_ECOM_RETURN_URL
  ).trim();
}

export function getMobilePaymentReturnUrl(): string {
  return (
    process.env.MOBILE_PAYMENT_RETURN_URL || DEFAULT_MOBILE_RETURN_URL
  ).trim();
}

export function resolvePaymentReturnUrl(
  paymentChannel: PaymentChannel | undefined,
  requestedReturnUrl?: string
): string {
  if (paymentChannel === "mobile") {
    return getMobilePaymentReturnUrl();
  }

  if (paymentChannel === "ecom") {
    if (process.env.ECOM_PAYMENT_RETURN_URL?.trim()) {
      return process.env.ECOM_PAYMENT_RETURN_URL.trim();
    }

    if (isAllowedWebReturnUrl(requestedReturnUrl)) {
      return requestedReturnUrl;
    }

    return getEcomPaymentReturnUrl();
  }

  // Backward compatibility for transactions created before payment_channel.
  if (isAllowedWebReturnUrl(requestedReturnUrl)) {
    return requestedReturnUrl;
  }

  return getEcomPaymentReturnUrl();
}

export function isAllowedPaymentReturnUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;

  // Only the exact server-configured mobile deep link is trusted.
  if (value === getMobilePaymentReturnUrl()) {
    return true;
  }

  if (value === getEcomPaymentReturnUrl()) {
    return true;
  }

  return isAllowedWebReturnUrl(value);
}

export function appendPaymentReturnParams(
  baseUrl: string,
  status: "success" | "failure" | "pending" | "processing",
  transactionId: string,
  orderCreationStatus?: string
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("payment", status);
  url.searchParams.set("merchantTransactionId", transactionId);

  if (orderCreationStatus) {
    url.searchParams.set("order", orderCreationStatus);
  }

  return url.toString();
}
