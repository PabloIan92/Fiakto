# Fiakto — Product Design Specification

**Date:** 2026-08-02  
**Status:** Approved concept  
**Tagline:** Todo tiene solución.

## 1. Product vision

Fiakto is an Argentina-wide trusted marketplace for hiring verified tradespeople. A customer publishes a real-world problem with photos, video or audio; verified professionals submit private quotes; the customer chooses and pays electronically; and the platform holds the funds until both parties confirm completion.

The product is not a generic AI chat or a directory. Its value comes from verified people, competitive quotes, protected payments, evidence, reputation and human dispute resolution.

## 2. Target users

### Customers

People and small businesses anywhere in Argentina that need repairs, installations or maintenance and want a fast, safe alternative to informal referrals.

### Professionals

Independent tradespeople and small service teams seeking qualified leads, digital payment, reputation and more predictable demand.

### Administrator

The platform operator, responsible for verification oversight, fraud review, disputes, refunds and exceptional payment decisions.

## 3. Core customer journey

1. The customer registers and verifies email, phone, DNI and liveness through an external identity provider.
2. They publish a request with location, description and optional photos, video or audio.
3. Gemini analyzes the media and text, asks clarifying questions, suggests the correct trade and produces a contextual reference range. AI does not set the final price.
4. Matching verified professionals receive the request based on trade, coverage and availability.
5. Professionals can ask private questions and submit private quotes. They cannot see competitors' prices.
6. The customer compares price, profile, verification badges, ratings, experience and timing, then accepts one quote.
7. The customer pays electronically inside Fiakto. The platform service fee is added to the professional's quote.
8. The precise address is revealed only after acceptance and payment. Both parties use the internal chat and evidence trail.
9. Any extra work requires a written change order and explicit electronic approval from the customer before it begins.
10. When the work is complete, both parties confirm independently.
11. If both confirm, the transactional agent triggers the deterministic payment-release workflow to the professional.
12. If either party disagrees, funds remain held and the administrator resolves the case using messages, media, change orders and confirmations. The administrator may release, refund or split the funds.
13. Both parties leave bilateral ratings after closure.

## 4. Trust and safety

### Verification

Both customers and professionals must verify email, phone, government identity and liveness before their first transaction. Professionals additionally provide payment destination, trade, experience, coverage, availability, references and optional certifications.

Badges remain separate and truthful:

- Identity verified
- References verified
- Certification verified

### Safety controls

- Exact addresses stay hidden until contracting.
- Internal chat and immutable event logs preserve evidence.
- In-app reporting and emergency guidance are always accessible.
- Off-platform payment solicitation is prohibited and monitored.
- Suspicious accounts, repeated cancellations and unusual payment behavior are flagged.
- No payment is released merely because time elapsed.
- AI may recommend or orchestrate actions, but deterministic rules and authorized humans control money movement.

## 5. Payments and revenue

- Professionals register and quote for free during the initial model.
- Standard customers pay the accepted quote plus Fiakto's service fee.
- Initial service-fee hypothesis: 8%, subject to payment costs and pilot economics.
- Premium customers pay a monthly subscription that waives only Fiakto's service fee; payment-processing costs remain applicable.
- Professionals receive the amount they quoted into their registered account or wallet.
- Cash payment is not supported.
- Funds remain protected until double confirmation or an administrative dispute decision.

The legal and technical payment structure must use a regulated payment provider and must not imply that Fiakto independently operates an unlicensed escrow service.

## 6. Gemini and agentic functionality

Gemini is used where multimodal reasoning materially improves the workflow:

- Analyze request photos, video, audio and text.
- Identify likely issue category and appropriate trade.
- Ask targeted follow-up questions.
- Detect missing or inconsistent information.
- Produce a non-binding contextual price reference.
- Summarize quotes and trade-offs without choosing for the customer.
- Organize dispute evidence and generate a neutral case summary for the administrator.
- Monitor workflow state and request confirmations.
- After bilateral confirmation, call the deterministic release workflow.

Every agent action is logged. High-impact actions remain rule-gated and auditable.

## 7. MVP scope

### Included

- Customer, professional and administrator roles
- Registration and identity-verification integration
- Professional profiles, trades, coverage and availability
- Multimedia service requests
- Gemini classification and clarification flow
- Geographic/trade matching and notifications
- Private questions and quotes
- Quote comparison and selection
- Electronic checkout and protected payment state
- Internal chat
- Change orders
- Double completion confirmation
- Administrator dispute panel
- Refund, release and split-decision records
- Bilateral ratings
- Standard and Premium customer plans
- Agent activity and transaction audit history

### Excluded from first version

- Native mobile applications
- Live GPS tracking
- Video calls
- Platform-provided insurance
- Fiakto financing or credit
- Public reverse auctions
- AI-determined final pricing
- International operations

The MVP will be a responsive web application designed to work well on low- and mid-range phones.

## 8. Pilot and contest evidence

The validation target is:

- 20 verified professionals
- 50 genuine customer requests
- 10 paid and completed jobs
- At least 5 independent paying customers
- Customer and professional testimonials
- Logged Gemini/agent workflows
- Documented revenue, payment costs, refunds and operating expenses

Success is not measured only by registrations. The strongest evidence is safe, completed transactions between independent users.

## 9. Product principles

- Trust before scale
- Humans choose professionals and resolve ambiguity
- AI assists; it does not fabricate certainty
- Money movement is deterministic, authorized and auditable
- Private competitive quotes, not a race to the cheapest bid
- Evidence and change orders prevent avoidable disputes
- Nationwide architecture, focused geographic pilot
- Brand language should be direct, reassuring and locally natural

## 10. Brand decision

Working brand: **Fiakto**  
Working tagline: **Todo tiene solución.**

The name was selected for distinctiveness and low visible collision in an initial public-web search. Before commercial launch, the team must complete an INPI phonetic and class-specific trademark search and verify domains and social handles. The name remains a working brand until that clearance is complete.

## 11. Open implementation decisions

The implementation plan must select:

- Web framework and hosting architecture
- Database and media storage
- Argentina-compatible identity provider
- Regulated payment provider and compliant hold/release model
- Notification channels
- Gemini model and tool-calling boundaries
- Initial pilot city or metro area, while retaining nationwide data architecture
- Premium price after estimating payment and support economics

