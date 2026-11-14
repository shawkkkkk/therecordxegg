import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "egg_admin";
const SESSION_SECONDS = 8 * 60 * 60;

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function signature(expiresAt) {
  const secret = process.env.ADMIN_SESSION_SECRET || "";
  return createHmac("sha256", secret).update(String(expiresAt)).digest("base64url");
}

function cookies(request) {
  return Object.fromEntries(String(request.headers.cookie || "").split(";").map((part) => {
    const index = part.indexOf("=");
    return index === -1 ? [part.trim(), ""] : [part.slice(0, index).trim(), part.slice(index + 1)];
  }).filter(([key]) => key));
}

export function validAdminPassword(value) {
  const configured = process.env.ADMIN_PASSWORD;
  return typeof value === "string" && Boolean(configured) && safeEqual(value, configured);
}

export function isAdmin(request) {
  if (!process.env.ADMIN_SESSION_SECRET) return false;
  const token = cookies(request)[COOKIE_NAME] || "";
  const [expiresRaw, suppliedSignature] = token.split(".");
  const expiresAt = Number(expiresRaw);
  return Number.isSafeInteger(expiresAt) && expiresAt > Math.floor(Date.now() / 1000) &&
    Boolean(suppliedSignature) && safeEqual(suppliedSignature, signature(expiresAt));
}

export function adminSessionCookie() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  return `${COOKIE_NAME}=${expiresAt}.${signature(expiresAt)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}
