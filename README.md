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
- `directDonationCheckoutUrl`: the approved hosted checkout URL. The site appends `donor`, `eggName`, and whole-dollar `amount` query parameters; the eventual payment integration must bind and validate them server-side rather than trusting the browser.
- `currentLikes`: a verified integer like count, or `null` before launch.
- `recordTarget`: the campaign target as an integer.
- `recordTargetLabel`: the short display label.

All contribution links fail closed until configured. The site never collects card details.

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

The client validates, sorts, and displays at most ten records. Do not add a donor until payment settlement, public-display consent, and the submitted egg name have been verified. A production payment integration still needs a payment processor, webhook signature validation, durable storage, idempotency, refunds/disputes handling, and an operator review path.

## Release boundaries

- This repository contains no merchant credentials, payment processor, payment webhook, X Money receipt verification, or automatic like-count reader.
- Do not claim donations are charitable or tax-deductible.
- Promotion funds must not be used to buy likes, bots, or coordinated inauthentic engagement.
- Record claims require independent verification.
