import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";
const MAX_STRIPE_USD_CENTS = 99_999_999n;

export function json(response, status, body) {
  response.status(status);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

export function parseUsdToCents(value) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
  if (cents < 100n) return null;
  return cents;
}

export function isStripeCheckoutAmount(cents) {
  return typeof cents === "bigint" && cents <= MAX_STRIPE_USD_CENTS;
}

export function publicSiteUrl() {
  const configured = process.env.PUBLIC_SITE_URL || "https://worldrecordxegg.com";
  const url = new URL(configured);
  if (url.protocol !== "https:") throw new Error("PUBLIC_SITE_URL must use HTTPS");
  return url.origin;
}

export async function stripeRequest(path, options = {}) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    const error = new Error("Stripe is not configured");
    error.code = "stripe_not_configured";
    throw error;
  }

  const response = await fetch(`${STRIPE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...options.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Stripe request failed");
    error.code = payload?.error?.code || "stripe_request_failed";
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function readRawBody(request) {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return Buffer.from(request.body);
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function verifyStripeSignature(rawBody, signature, secret, toleranceSeconds = 300) {
  if (!signature || !secret) return false;
  const parts = signature.split(",").map((part) => part.split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString("utf8")}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return signatures.some((candidate) => {
    if (!/^[a-f0-9]{64}$/i.test(candidate)) return false;
    const candidateBuffer = Buffer.from(candidate, "hex");
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}
