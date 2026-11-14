import { publicSiteUrl } from "./_stripe.js";

function send(response, status, body, cache = false) {
  response.status(status);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cache ? "public, max-age=0, s-maxage=300, stale-while-revalidate=900" : "no-store");
  response.end(JSON.stringify(body));
}

function postIdFromUrl(value) {
  if (typeof value !== "string") return "";
  return value.match(/\/status\/(\d+)/)?.[1] || "";
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return send(response, 405, { error: "Method not allowed" });
  }

  try {
    const configResponse = await fetch(`${publicSiteUrl()}/data/site.json`, { cache: "no-store" });
    if (!configResponse.ok) throw new Error("Site configuration unavailable");
    const site = await configResponse.json();
    const postId = process.env.X_POST_ID || postIdFromUrl(site.xPostUrl);
    const token = process.env.X_BEARER_TOKEN;
    if (!postId || !token) return send(response, 200, site, true);

    const metricsResponse = await fetch(`https://api.x.com/2/tweets/${encodeURIComponent(postId)}?tweet.fields=public_metrics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metricsResponse.ok) {
      console.error("x_metrics_error", { status: metricsResponse.status });
      return send(response, 200, site, true);
    }
    const payload = await metricsResponse.json();
    const likes = payload?.data?.public_metrics?.like_count;
    if (Number.isSafeInteger(likes) && likes >= 0) {
      site.currentLikes = likes;
      site.likesUpdatedAt = new Date().toISOString();
    }
    return send(response, 200, site, true);
  } catch (error) {
    console.error("site_status_error", { message: error.message });
    return send(response, 502, { error: "Campaign status is temporarily unavailable" });
  }
}
