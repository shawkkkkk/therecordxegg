import { json, readRawBody, verifyStripeSignature } from "./_stripe.js";

export const config = { api: { bodyParser: false } };

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed" });
  }

  const rawBody = await readRawBody(request);
  const signature = request.headers["stripe-signature"];
  if (!verifyStripeSignature(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)) {
    return json(response, 400, { error: "Invalid webhook signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return json(response, 400, { error: "Invalid webhook payload" });
  }

  if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"].includes(event.type)) {
    console.log("stripe_checkout_event", { id: event.id, type: event.type, session: event.data?.object?.id });
  }
  return json(response, 200, { received: true });
}
