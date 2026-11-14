import { isAdmin, sameOrigin } from "./_admin-auth.js";
import { database } from "./_db.js";
import { json, parseUsdToCents } from "./_stripe.js";

function cleanText(value, max, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max) || fallback;
}

function cleanHandle(value) {
  const handle = cleanText(value, 50).replace(/^@/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? `@${handle.toLowerCase()}` : "";
}

function cleanTransactionId(value) {
  const id = cleanText(value, 128);
  return /^[A-Za-z0-9._:-]+$/.test(id) ? id : "";
}

function serialize(row) {
  return {
    transactionId: row.transaction_id,
    xHandle: row.x_handle,
    donor: row.donor_name,
    eggName: row.egg_name,
    amountUsd: Number(row.amount_cents) / 100,
    paidAt: new Date(row.paid_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export default async function handler(request, response) {
  if (!isAdmin(request)) return json(response, 401, { error: "Authentication required" });
  if (!sameOrigin(request)) return json(response, 403, { error: "Forbidden" });

  const sql = database();
  if (request.method === "GET") {
    const rows = await sql`SELECT transaction_id, x_handle, donor_name, egg_name, amount_cents, paid_at, created_at
      FROM xmoney_contributions ORDER BY paid_at DESC, id DESC LIMIT 200`;
    return json(response, 200, { entries: rows.map(serialize) });
  }

  if (request.method === "POST") {
    const transactionId = cleanTransactionId(request.body?.transactionId);
    const xHandle = cleanHandle(request.body?.xHandle);
    const donor = cleanText(request.body?.donor, 32, xHandle);
    const eggName = cleanText(request.body?.eggName, 32);
    const cents = parseUsdToCents(String(request.body?.amount || ""));
    const paidAt = new Date(request.body?.paidAt || "");
    const validTime = Number.isFinite(paidAt.getTime()) && paidAt.getTime() <= Date.now() + 5 * 60 * 1000;
    if (!transactionId || !xHandle || !donor || !eggName || !cents || !validTime) {
      return json(response, 400, { error: "Enter a valid transaction ID, X handle, names, amount and payment time." });
    }
    try {
      const rows = await sql`INSERT INTO xmoney_contributions
        (transaction_id, x_handle, donor_name, egg_name, amount_cents, paid_at)
        VALUES (${transactionId}, ${xHandle}, ${donor}, ${eggName}, ${cents.toString()}, ${paidAt.toISOString()})
        RETURNING transaction_id, x_handle, donor_name, egg_name, amount_cents, paid_at, created_at`;
      return json(response, 201, { entry: serialize(rows[0]) });
    } catch (error) {
      if (error.code === "23505") return json(response, 409, { error: "That transaction ID is already recorded." });
      console.error("xmoney_admin_insert_error", { code: error.code });
      return json(response, 500, { error: "The verified payment could not be saved." });
    }
  }

  if (request.method === "DELETE") {
    const transactionId = cleanTransactionId(request.body?.transactionId);
    if (!transactionId) return json(response, 400, { error: "Invalid transaction ID" });
    const rows = await sql`DELETE FROM xmoney_contributions WHERE transaction_id = ${transactionId} RETURNING transaction_id`;
    if (!rows.length) return json(response, 404, { error: "Transaction not found" });
    return json(response, 200, { deleted: true });
  }

  response.setHeader("Allow", "GET, POST, DELETE");
  return json(response, 405, { error: "Method not allowed" });
}
