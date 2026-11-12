import { json, stripeRequest } from "./_stripe.js";

function verifiedContribution(session) {
  const metadata = session.metadata || {};
  return session.status === "complete" && session.payment_status === "paid" &&
    metadata.campaign === "worldrecordxegg" && metadata.publicConsent === "true" &&
    typeof metadata.donor === "string" && typeof metadata.eggName === "string" &&
    Number.isSafeInteger(session.amount_total) && session.amount_total > 0;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return json(response, 405, { error: "Method not allowed" });
  }

  try {
    const sessions = await stripeRequest("/checkout/sessions?limit=100&status=complete");
    const donors = sessions.data.filter(verifiedContribution).map((session) => ({
      verified: true,
      route: "site",
      donor: session.metadata.donor.slice(0, 32),
      eggName: session.metadata.eggName.slice(0, 32),
      amountUsd: session.amount_total / 100,
      verifiedAt: new Date(session.created * 1000).toISOString(),
    })).sort((a, b) => b.amountUsd - a.amountUsd || Date.parse(a.verifiedAt) - Date.parse(b.verifiedAt)).slice(0, 10);
    return json(response, 200, { donors });
  } catch (error) {
    console.error("contributions_error", { code: error.code, status: error.status });
    const status = error.code === "stripe_not_configured" ? 503 : 502;
    return json(response, status, { error: "Verified contributions are temporarily unavailable." });
  }
}
