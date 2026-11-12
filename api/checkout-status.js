import { json, stripeRequest } from "./_stripe.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return json(response, 405, { error: "Method not allowed" });
  }

  const sessionId = typeof request.query?.session_id === "string" ? request.query.session_id : "";
  if (!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return json(response, 400, { error: "Invalid checkout session" });
  }

  try {
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (session.metadata?.campaign !== "worldrecordxegg") {
      return json(response, 404, { error: "Checkout session not found" });
    }
    return json(response, 200, {
      status: session.payment_status === "paid" ? "paid" : "processing",
    });
  } catch (error) {
    console.error("checkout_status_error", { code: error.code, status: error.status });
    return json(response, error.code === "stripe_not_configured" ? 503 : 404, { error: "Checkout status is unavailable." });
  }
}
