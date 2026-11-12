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

The on-site form creates a Stripe-hosted Checkout Session through `/api/create-checkout-session`; card and bank details never touch this site. Checkout fails closed until the required Stripe secrets are configured.

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

The client combines manually verified X Money records with settled Stripe Checkout Sessions, then validates, sorts, and displays at most ten records. Stripe entries appear only after `payment_status=paid`; delayed ACH payments remain hidden until settlement. Do not add a manual donor until payment settlement, public-display consent, and the submitted egg name have been verified.

## Release boundaries

- This repository contains no merchant credentials, X Money receipt verification, or automatic like-count reader.
- Do not claim donations are charitable or tax-deductible.
- Promotion funds must not be used to buy likes, bots, or coordinated inauthentic engagement.
- Record claims require independent verification.
