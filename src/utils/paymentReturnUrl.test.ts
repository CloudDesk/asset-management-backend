import assert from "node:assert/strict";
import test from "node:test";
import {
  appendPaymentReturnParams,
  isAllowedPaymentReturnUrl,
  resolvePaymentReturnUrl,
} from "./paymentReturnUrl.js";

const ENV_KEYS = [
  "NODE_ENV",
  "ECOM_PAYMENT_RETURN_URL",
  "MOBILE_PAYMENT_RETURN_URL",
  "PAYMENT_RETURN_URL_ALLOWED_ORIGINS",
] as const;

function withEnvironment(
  values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  assertion: () => void
) {
  const previous = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]])
  );

  try {
    for (const key of ENV_KEYS) {
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    assertion();
  } finally {
    for (const key of ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("mobile channel always uses the configured mobile deep link", () => {
  withEnvironment(
    {
      MOBILE_PAYMENT_RETURN_URL: "nivaana://Main/ProfileTab/MyOrders",
      NODE_ENV: "production",
    },
    () => {
      assert.equal(
        resolvePaymentReturnUrl("mobile", "https://untrusted.example/result"),
        "nivaana://Main/ProfileTab/MyOrders"
      );
      assert.equal(
        isAllowedPaymentReturnUrl("nivaana://Main/ProfileTab/MyOrders"),
        true
      );
      assert.equal(
        isAllowedPaymentReturnUrl("nivaana://unexpected/path"),
        false
      );
    }
  );
});

test("ecom channel accepts only an allowlisted web origin", () => {
  withEnvironment(
    {
      NODE_ENV: "production",
      PAYMENT_RETURN_URL_ALLOWED_ORIGINS: "https://shop.example",
    },
    () => {
      assert.equal(
        resolvePaymentReturnUrl(
          "ecom",
          "https://shop.example/checkout/confirmation"
        ),
        "https://shop.example/checkout/confirmation"
      );
      assert.notEqual(
        resolvePaymentReturnUrl("ecom", "https://attacker.example/result"),
        "https://attacker.example/result"
      );
    }
  );
});

test("payment parameters can be appended to a mobile deep link", () => {
  assert.equal(
    appendPaymentReturnParams(
      "nivaana://Main/ProfileTab/MyOrders",
      "success",
      "TXN123",
      "success"
    ),
    "nivaana://Main/ProfileTab/MyOrders?payment=success&merchantTransactionId=TXN123&order=success"
  );
});
