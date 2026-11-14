import { clearAdminCookie, sameOrigin } from "./_admin-auth.js";
import { json } from "./_stripe.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed" });
  }
  if (!sameOrigin(request)) return json(response, 403, { error: "Forbidden" });
  response.setHeader("Set-Cookie", clearAdminCookie());
  return json(response, 200, { authenticated: false });
}
