import { json, stripeRequest } from "./_stripe.js";
import { database } from "./_db.js";

function verifiedContribution(session) {
  const metadata = session.metadata || {};
  return session.status === "complete" && session.payment_status === "paid" &&
    metadata.campaign === "worldrecordxegg" && metadata.publicConsent === "true" &&
    typeof metadata.donor === "string" && typeof metadata.eggName === "string" &&
    Number.isSafeInteger(session.amount_total) && session.amount_total > 0;
}

async function listCompletedSessions() {
  const sessions = [];
  let startingAfter = null;

  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ limit: "100", status: "complete" });
    if (startingAfter) query.set("starting_after", startingAfter);
    const batch = await stripeRequest(`/checkout/sessions?${query.toString()}`);
    const items = Array.isArray(batch.data) ? batch.data : [];
    sessions.push(...items);
    if (!batch.has_more || items.length === 0) break;
    startingAfter = items.at(-1).id;
  }

  return sessions;
}

function aggregateContributions(sessions) {
  const totals = new Map();

  for (const session of sessions.filter(verifiedContribution)) {
    const metadata = session.metadata;
    const email = typeof session.customer_details?.email === "string"
      ? session.customer_details.email.trim().toLowerCase()
      : "";
    const identity = email ? `email:${email}` : `session:${session.id}`;
    const createdAt = Number.isFinite(session.created) ? session.created : 0;
    const existing = totals.get(identity);

    if (!existing) {
      totals.set(identity, {
        verified: true,
        route: "site",
        donor: metadata.donor.slice(0, 32),
        eggName: metadata.eggName.slice(0, 32),
        amountCents: session.amount_total,
        verifiedAt: new Date(createdAt * 1000).toISOString(),
        latestCreatedAt: createdAt,
      });
      continue;
    }

    existing.amountCents += session.amount_total;
    if (createdAt >= existing.latestCreatedAt) {
      existing.donor = metadata.donor.slice(0, 32);
      existing.eggName = metadata.eggName.slice(0, 32);
      existing.latestCreatedAt = createdAt;
    }
  }

  return [...totals.values()].map(({ amountCents, latestCreatedAt, ...entry }) => ({
    ...entry,
    amountUsd: amountCents / 100,
  }));
}

async function listXMoneyContributions() {
  const sql = database();
  const rows = await sql`WITH totals AS (
      SELECT lower(x_handle) AS handle_key, SUM(amount_cents) AS total_cents, MIN(paid_at) AS first_paid
      FROM xmoney_contributions GROUP BY lower(x_handle)
    ), latest AS (
      SELECT DISTINCT ON (lower(x_handle)) lower(x_handle) AS handle_key, x_handle, donor_name, egg_name
      FROM xmoney_contributions ORDER BY lower(x_handle), paid_at DESC, id DESC
    )
    SELECT latest.x_handle, latest.donor_name, latest.egg_name, totals.total_cents, totals.first_paid
    FROM totals JOIN latest USING (handle_key)`;
  return rows.map((row) => ({
    verified: true,
    route: "xmoney",
    donor: row.donor_name,
    eggName: row.egg_name,
    amountUsd: Number(row.total_cents) / 100,
    verifiedAt: new Date(row.first_paid).toISOString(),
  }));
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return json(response, 405, { error: "Method not allowed" });
  }

  const [stripeResult, xMoneyResult] = await Promise.allSettled([
    listCompletedSessions(),
    listXMoneyContributions(),
  ]);
  if (stripeResult.status === "rejected") {
    console.error("stripe_contributions_error", { code: stripeResult.reason?.code, status: stripeResult.reason?.status });
  }
  if (xMoneyResult.status === "rejected") {
    console.error("xmoney_contributions_error", { code: xMoneyResult.reason?.code });
  }
  if (stripeResult.status === "rejected" && xMoneyResult.status === "rejected") {
    return json(response, 502, { error: "Verified contributions are temporarily unavailable." });
  }

  try {
    const stripeDonors = stripeResult.status === "fulfilled" ? aggregateContributions(stripeResult.value) : [];
    const xMoneyDonors = xMoneyResult.status === "fulfilled" ? xMoneyResult.value : [];
    const donors = [...stripeDonors, ...xMoneyDonors]
      .sort((a, b) => b.amountUsd - a.amountUsd || Date.parse(a.verifiedAt) - Date.parse(b.verifiedAt))
      .slice(0, 10);
    return json(response, 200, { donors });
  } catch (error) {
    console.error("contributions_error", { code: error.code, status: error.status });
    return json(response, 502, { error: "Verified contributions are temporarily unavailable." });
  }
}
