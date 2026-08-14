# Fiakto — P&L summary

## Actuals to date (pilot / validation phase)

Fiakto has not launched commercially yet — the requests, quotes, and payments
exercised so far were run end to end by the founding team (acting as both
customer and professional) to validate the product, not by independent
paying customers. Actuals reflect that honestly:

| Item | Amount (ARS) | Notes |
|---|---|---|
| Revenue (commission collected) | 0 | No independent, third-party paying customers yet |
| Transaction volume processed | ~$16,200 | One real bank transfer moved through the platform's payment/commission flow during end-to-end validation, between the founders' own test accounts |
| External funding raised | 0 | Self-funded |

## Costs incurred to date

| Item | Status | Notes |
|---|---|---|
| Firebase App Hosting (Next.js deployment) | Within free/low-usage tier | Single staging backend, low traffic |
| Firestore + Cloud Storage | Within free/low-usage tier | Validation-scale data volume |
| Gemini API (`gemini-flash-latest`) | Within free/low-usage tier | Triage calls during development and testing |
| Google Cloud Text-to-Speech / Speech-to-Text | Within free/low-usage tier | Used only to produce the Devpost demo video |
| Domain / other recurring costs | 0 | None yet |

No material cash costs have been incurred; the project has run inside free
or negligible-usage tiers of Google Cloud / Firebase throughout development.

## Forward-looking model

The five-year revenue and cost model — completed jobs, average order value,
the platform's 8% take rate, professional subscription revenue, COGS, and
operating expenses — lives in
[`fiakto-five-year-projection.csv`](./fiakto-five-year-projection.csv) in
this same folder. It is an explicit **planning hypothesis**, not a forecast
backed by existing revenue: modeled operating profit only turns positive
in year 5 (2031), and turns on a thin margin at that volume, so it is
sensitive to the assumed take rate and job volume.

## What's next

The gap between the actuals above and the five-year model is, honestly, the
whole job ahead: getting real households and real professionals transacting
on Fiakto. The platform mechanics (Gemini triage, matching, private quotes,
commission, in-app chat, closing/ratings) are built and live in production;
what's missing is real demand on both sides of the marketplace.
