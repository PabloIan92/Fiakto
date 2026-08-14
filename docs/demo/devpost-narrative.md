# Fiakto — Devpost narrative

## The problem

A pipe starts leaking at 11pm. The customer doesn't know if it's a five-minute
fix or a plumbing emergency, and has no idea what a fair price should look
like. They ask around, repeat the same explanation to three or four people,
and end up comparing quotes that describe different jobs entirely — because
nobody wrote down the same problem the same way twice. Meanwhile, a
qualified professional five blocks away has no way to see that request even
exists. The missing piece isn't more messages. It's a structured, trustworthy
handoff from "something is wrong at my house" to accountable, priced work.

## What Fiakto does

Fiakto is a home-services marketplace for Argentina (piloting in CABA and
Greater Buenos Aires) built around a single idea: the customer shouldn't have
to diagnose their own problem, and the professional shouldn't have to guess
what they're walking into.

A customer submits a request with a photo, a short free-text description,
and an approximate location (the exact address is never shown until a
professional is hired and paid). That request is sent to Gemini
(`gemini-flash-latest`, via the `@google/genai` SDK) with a system
instruction that forces a strict JSON contract: trade, a plain-language
summary, up to five clarifying questions, a risk level (`normal` / `urgent`
/ `emergency`), a non-binding reference price range in Argentine pesos, and a
confidence score. The prompt explicitly tells the model to return `null`
instead of inventing a price when the evidence is insufficient, and to
reserve `emergency` for concrete cues — visible fire, a suspected gas leak,
exposed live wiring, structural collapse — rather than diagnosing with false
certainty. This is a deliberate design choice: Gemini organizes and
structures evidence, it does not make the consequential decision.

Once triaged, the request becomes visible only to verified professionals
whose registered trade and coverage area match it. Professionals submit
private quotes — nobody sees a competitor's price — broken down into labor
and materials, with Fiakto's 8% commission calculated automatically the
moment a quote is accepted. The customer can accept and pay by transfer or
in cash; either way, the platform's fee is recorded the same way. Once
matched, customer and professional communicate through Fiakto's own internal
chat, not WhatsApp: any phone number or email address typed into a message
is detected and redacted before it's even saved, precisely so the two sides
have a reason to stay on-platform instead of moving the relationship
somewhere Fiakto can't see or protect. Closing a job requires the
professional to upload a photo of the finished work; the customer reviews
it, approves it, and leaves a star rating and comment, which is what
eventually surfaces on Fiakto's public `/impacto` page alongside the
platform's live aggregate numbers (requests, quotes, accepted jobs, closed
jobs, and fee revenue).

## What's real today, and what isn't

Every mechanism described above is live in Fiakto's production deployment
today, not a mockup or a local demo: the Gemini call, the matching logic,
the private-quote flow, the automatic commission calculation, the
in-app chat with redaction, and the photo-approval-and-rating closing flow
have all been exercised end to end on the deployed app, including a real
bank transfer moving real money through the platform's fee logic. What
Fiakto does **not** have yet is independent, third-party market traction —
the requests exercised so far were run by the founding team acting as both
customer and professional to validate the full pipeline, not by unrelated
paying customers. We're intentionally not claiming revenue or user numbers
that don't exist; the honest claim is narrower and, we think, still
meaningful: the product works, live, end to end, today.

## Why this matters for the Build with Gemini XPRIZE

Fiakto is a concrete example of Gemini doing the part only a language model
can do — turning messy, informal, multimodal human input into a structured
decision aid — while keeping every consequential action (identity,
authorization, money, final acceptance) under deterministic rules and human
control. It's a real product with a real, if early, pilot footprint in
Buenos Aires, built on Next.js and Firebase, with its full source available
publicly. The next milestone is exactly the part Gemini doesn't decide:
getting real households and real professionals through the door.

Fiakto. Todo tiene solución.
