import { isStripeCheckoutAmount, json, parseUsdToCents, publicSiteUrl, stripeRequest } from "./_stripe.js";

function cleanName(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return cleaned.slice(0, 32) || fallback;
}

function cleanEmail(value) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed" });
  }

  const donor = cleanName(request.body?.donor, "Anonymous");
  const donorEmail = cleanEmail(request.body?.donorEmail);
  const eggName = cleanName(request.body?.eggName);
  const cents = parseUsdToCents(String(request.body?.amount || ""));
  const consent = request.body?.consent === true;
  if (!donorEmail || !eggName || !cents || !consent) {
    return json(response, 400, { error: "Enter a valid email, amount, egg name, and leaderboard consent." });
  }

  if (!isStripeCheckoutAmount(cents)) {
    return json(response, 409, {
      error: "Contributions of $1,000,000 or more require a verified bank-transfer arrangement.",
      code: "bank_transfer_required",
      highValueUrl: process.env.HIGH_VALUE_CONTRIBUTION_URL || null,
    });
  }

  try {
    const site = publicSiteUrl();
    const amount = cents.toString();
    const params = new URLSearchParams({
      mode: "payment",
      submit_type: "pay",
      success_url: `${site}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/?payment=cancelled`,
      customer_email: donorEmail,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": "World Record X Egg contribution",
      "line_items[0][price_data][unit_amount]": amount,
      "line_items[0][quantity]": "1",
      "payment_method_types[0]": "card",
      "payment_method_types[1]": "us_bank_account",
      "payment_method_options[us_bank_account][verification_method]": "automatic",
      "metadata[campaign]": "worldrecordxegg",
      "metadata[donor]": donor,
      "metadata[eggName]": eggName,
      "metadata[publicConsent]": "true",
      "payment_intent_data[metadata][campaign]": "worldrecordxegg",
      "payment_intent_data[metadata][donor]": donor,
      "payment_intent_data[metadata][eggName]": eggName,
    });

    const session = await stripeRequest("/checkout/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    return json(response, 200, { url: session.url });
  } catch (error) {
    console.error("checkout_session_error", { code: error.code, status: error.status });
    const status = error.code === "stripe_not_configured" ? 503 : 502;
    return json(response, status, { error: status === 503 ? "Secure checkout is being connected." : "Stripe could not open checkout. Please try again." });
  }
}
