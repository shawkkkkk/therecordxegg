import { adminSessionCookie, sameOrigin, validAdminPassword } from "./_admin-auth.js";
import { json } from "./_stripe.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed" });
  }
  if (!sameOrigin(request) || !validAdminPassword(request.body?.password)) {
    return json(response, 401, { error: "Invalid credentials" });
  }
  response.setHeader("Set-Cookie", adminSessionCookie());
  return json(response, 200, { authenticated: true });
}
