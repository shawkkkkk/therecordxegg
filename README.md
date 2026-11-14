# World Record X Egg

Minimal single-page campaign site for `worldrecordxegg.com`.

## Local preview

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173`.

## Deployment

The repository is linked to the `therecordxegg` project on Vercel. Pull-request branches receive preview deployments; merges to `main` publish the production build.

## Campaign configuration

Edit `data/site.json`:

- `xPostUrl`: the final HTTPS URL of the X post.
- `xMoneyUrl`: the approved X Money payment URL for this campaign.
- `currentLikes`: a verified integer like count, or `null` before launch.
- `recordTarget`: the campaign target as an integer.
- `recordTargetLabel`: the short display label.

The on-site form creates a Stripe-hosted Checkout Session through `/api/create-checkout-session`; card and bank details never touch this site. The return page verifies the Checkout Session server-side through `/api/checkout-status` before showing a result. Checkout fails closed until the required Stripe secrets are configured.

## Stripe setup

Add the variables from `.env.example` to Vercel. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must be Secret values. `PUBLIC_SITE_URL` is a non-secret Config value. Point the Stripe webhook endpoint at `https://worldrecordxegg.com/api/stripe-webhook` and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`.

Stripe Checkout handles contributions below $1,000,000. Configure `HIGH_VALUE_CONTRIBUTION_URL` with a secure bank-transfer intake URL for larger contributions; the browser does not impose a maximum, but the server routes amounts above Stripe's per-charge ceiling to that verified flow.

## Leaderboard

`data/leaderboard.json` accepts settled, verified entries only:

```json
{
  "updatedAt": "2026-11-12T00:00:00Z",
  "donors": [
    {
      "verified": true,
      "route": "xmoney",
      "donor": "Example",
      "eggName": "Eggward",
      "amountUsd": 100,
      "verifiedAt": "2026-11-12T00:00:00Z"
    }
  ]
}
```

The client combines manually verified X Money records with settled Stripe Checkout Sessions, then validates, sorts, and displays at most ten records. Stripe entries appear only after `payment_status=paid`; delayed ACH payments remain hidden until settlement. Repeat Stripe contributions using the same normalized checkout email are summed into one leaderboard total; the most recently submitted public name and egg name are displayed, while the email remains private and is never returned by the leaderboard API. Contributions made with different emails remain separate. Do not add a manual donor until payment settlement, public-display consent, and the submitted egg name have been verified.

### Private X Money admin

The owner workspace is available at `/admin`. It is protected by an eight-hour, signed, HTTP-only session cookie. Configure `DATABASE_URL`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in Vercel. The admin form records only payments the owner has verified as completed in X Money Activity. Transaction IDs are unique, so retrying or submitting the same receipt twice cannot double-count a payment. Contributions from the same normalized X handle are summed; the newest public name and egg name are displayed.

The schema is tracked in `migrations/001_xmoney_contributions.sql`.

## Automatic X like count

The browser reads campaign configuration from `/api/site-status`. When `X_BEARER_TOKEN` is configured and the X post ID is present in `data/site.json` (or `X_POST_ID`), the endpoint requests `public_metrics.like_count` from the official X API. Results are cached for five minutes to control API usage. Without those credentials, it safely falls back to the verified manual count in `data/site.json`.

## Release boundaries

- This repository contains no merchant credentials. X Money receipt verification remains owner-confirmed until X exposes an official incoming-payment API.
- Do not claim donations are charitable or tax-deductible.
- Promotion funds must not be used to buy likes, bots, or coordinated inauthentic engagement.
- Record claims require independent verification.
