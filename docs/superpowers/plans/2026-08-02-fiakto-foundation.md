# Fiakto Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a responsive, testable Fiakto vertical slice in which a customer creates a service request, Gemini returns structured triage, and a professional submits a private quote.

**Architecture:** Use a Next.js App Router application on Firebase App Hosting, with Firebase Authentication, Firestore and Cloud Storage. Domain operations live in server-only modules behind repository and provider interfaces so Gemini, identity and payment vendors can be replaced without changing UI or business rules.

**Tech Stack:** TypeScript, Next.js App Router, React, Firebase Admin/Web SDKs, Google Gen AI SDK, Zod, Vitest, Testing Library, Playwright, Tailwind CSS.

## Global Constraints

- Working brand: **Fiakto**.
- Working tagline: **Todo tiene solución.**
- Responsive web application optimized for low- and mid-range phones.
- Nationwide data architecture with the initial pilot configured as CABA and Greater Buenos Aires.
- Exact customer addresses remain hidden until quote acceptance and payment.
- Quotes are private; professionals never receive competitors' prices.
- Gemini suggestions are non-binding and every agent action is auditable.
- AI never directly moves money.
- Secrets are server-only and must never use a `NEXT_PUBLIC_` prefix.

---

## File map

```text
app/
  (public)/page.tsx                 Landing page
  cliente/solicitudes/nueva/       Customer request form
  profesional/oportunidades/       Matched request list and quote form
  api/requests/route.ts             Authenticated request creation
  api/requests/[id]/triage/route.ts Gemini triage endpoint
  api/requests/[id]/quotes/route.ts Private quote endpoint
src/
  domain/requests.ts                Request schemas and state rules
  domain/quotes.ts                  Quote schemas and authorization rules
  domain/triage.ts                  Structured AI output contract
  server/auth.ts                    Session-to-actor boundary
  server/firebase-admin.ts          Admin SDK singleton
  server/repositories/              Firestore ports and implementations
  server/ai/                        Gemini port and implementation
  server/audit.ts                   Append-only audit writer
tests/                              Unit and route integration tests
e2e/                                Browser acceptance tests
```

### Task 1: Application shell and quality gates

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `app/layout.tsx`
- Create: `app/(public)/page.tsx`
- Create: `app/globals.css`
- Create: `tests/smoke/brand.test.tsx`

**Interfaces:**
- Consumes: none
- Produces: Next.js application shell and `npm run validate`

- [ ] **Step 1: Scaffold the project and install dependencies**

Run:

```powershell
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"
npm install firebase firebase-admin @google/genai zod
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

Expected: commands exit 0 and `app/page.tsx` exists.

- [ ] **Step 2: Add one brand smoke test**

Create `tests/smoke/brand.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/(public)/page";

describe("Fiakto home", () => {
  it("states the product promise", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Fiakto" })).toBeTruthy();
    expect(screen.getByText("Todo tiene solución.")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the test and verify failure**

Run: `npm test -- --run tests/smoke/brand.test.tsx`

Expected: FAIL because the generated page does not contain the approved copy.

- [ ] **Step 4: Implement the minimal landing page**

Create `app/(public)/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest">Todo tiene solución.</p>
      <h1 className="text-5xl font-bold tracking-tight">Fiakto</h1>
      <p className="mt-5 max-w-xl text-lg text-neutral-600">
        Publicá lo que necesitás y recibí presupuestos privados de profesionales verificados.
      </p>
    </main>
  );
}
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "validate": "npm run lint && npm run typecheck && npm test -- --run"
  }
}
```

- [ ] **Step 5: Run quality gates**

Run: `npm run validate`

Expected: lint, typecheck and tests all pass.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts app tests
git commit -m "feat: establish Fiakto application shell"
```

### Task 2: Domain contracts and state transitions

**Files:**
- Create: `src/domain/requests.ts`
- Create: `src/domain/triage.ts`
- Create: `src/domain/quotes.ts`
- Create: `tests/domain/requests.test.ts`
- Create: `tests/domain/quotes.test.ts`

**Interfaces:**
- Consumes: Zod
- Produces: `ServiceRequestSchema`, `TriageResultSchema`, `QuoteSchema`, `canProfessionalViewRequest()`

- [ ] **Step 1: Write failing domain tests**

Create `tests/domain/requests.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ServiceRequestSchema } from "@/src/domain/requests";

describe("ServiceRequestSchema", () => {
  it("rejects an empty description and precise public address", () => {
    const result = ServiceRequestSchema.safeParse({
      customerId: "customer-1", description: "", province: "Buenos Aires",
      locality: "Lanús", publicLocation: "Av. Siempre Viva 742", media: []
    });
    expect(result.success).toBe(false);
  });
});
```

Create `tests/domain/quotes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canProfessionalViewRequest } from "@/src/domain/quotes";

describe("private opportunity matching", () => {
  it("requires matching trade, coverage and verified identity", () => {
    expect(canProfessionalViewRequest(
      { trade: "plomeria", province: "Buenos Aires", locality: "Lanús" },
      { verified: true, trades: ["plomeria"], coverage: ["Lanús"] }
    )).toBe(true);
    expect(canProfessionalViewRequest(
      { trade: "gas", province: "Buenos Aires", locality: "Lanús" },
      { verified: true, trades: ["plomeria"], coverage: ["Lanús"] }
    )).toBe(false);
  });
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- --run tests/domain`

Expected: FAIL with missing module errors.

- [ ] **Step 3: Implement schemas and matching rule**

Create `src/domain/requests.ts`:

```ts
import { z } from "zod";

export const MediaSchema = z.object({
  storagePath: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "video/mp4", "audio/mpeg", "audio/mp4"]),
});

export const ServiceRequestSchema = z.object({
  customerId: z.string().min(1),
  description: z.string().trim().min(20).max(2000),
  province: z.string().min(2),
  locality: z.string().min(2),
  publicLocation: z.string().max(0).optional(),
  media: z.array(MediaSchema).max(6),
  status: z.enum(["draft", "triaging", "open", "quoted", "accepted", "closed"]).default("draft"),
});

export type ServiceRequest = z.infer<typeof ServiceRequestSchema>;
```

Create `src/domain/triage.ts`:

```ts
import { z } from "zod";

export const TriageResultSchema = z.object({
  trade: z.enum(["plomeria", "electricidad", "gas", "albanileria", "carpinteria", "refrigeracion", "otro"]),
  summary: z.string().min(10).max(500),
  questions: z.array(z.string().min(5)).max(5),
  riskLevel: z.enum(["normal", "urgent", "emergency"]),
  referenceRangeArs: z.object({ min: z.number().nonnegative(), max: z.number().positive() }).nullable(),
  confidence: z.number().min(0).max(1),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;
```

Create `src/domain/quotes.ts`:

```ts
import { z } from "zod";

export const QuoteSchema = z.object({
  requestId: z.string().min(1), professionalId: z.string().min(1),
  laborArs: z.number().positive(), materialsArs: z.number().nonnegative(),
  description: z.string().min(20).max(1500), estimatedHours: z.number().positive().max(240),
});

type Opportunity = { trade: string; province: string; locality: string };
type Professional = { verified: boolean; trades: string[]; coverage: string[] };

export function canProfessionalViewRequest(request: Opportunity, professional: Professional) {
  return professional.verified && professional.trades.includes(request.trade)
    && professional.coverage.includes(request.locality);
}
```

- [ ] **Step 4: Run and commit**

Run: `npm test -- --run tests/domain && npm run typecheck`

Expected: PASS.

```powershell
git add src/domain tests/domain
git commit -m "feat: define request triage and quote contracts"
```

### Task 3: Firebase persistence and append-only audit

**Files:**
- Create: `src/server/firebase-admin.ts`
- Create: `src/server/repositories/request-repository.ts`
- Create: `src/server/repositories/firestore-request-repository.ts`
- Create: `src/server/audit.ts`
- Create: `firestore.rules`
- Create: `tests/server/request-repository.test.ts`

**Interfaces:**
- Consumes: `ServiceRequest`, `TriageResult`
- Produces: `RequestRepository.create()`, `RequestRepository.saveTriage()`, `appendAuditEvent()`

- [ ] **Step 1: Define the repository contract and failing fake-backed test**

Create `src/server/repositories/request-repository.ts`:

```ts
import type { ServiceRequest } from "@/src/domain/requests";
import type { TriageResult } from "@/src/domain/triage";

export interface RequestRepository {
  create(input: ServiceRequest): Promise<{ id: string }>;
  saveTriage(id: string, result: TriageResult): Promise<void>;
}
```

Create `tests/server/request-repository.test.ts` with a local fake implementing the interface and assert that `saveTriage` changes only the named request's triage field.

- [ ] **Step 2: Run the repository test**

Run: `npm test -- --run tests/server/request-repository.test.ts`

Expected: PASS; this locks the provider contract before Firestore code.

- [ ] **Step 3: Implement Firebase singleton and repository**

Create `src/server/firebase-admin.ts` using `getApps()`, `initializeApp()` and `getFirestore()`; create `FirestoreRequestRepository` whose `create` writes `createdAt: FieldValue.serverTimestamp()` and whose `saveTriage` updates `triage`, `status: "open"`, and `triagedAt`.

Create `src/server/audit.ts`:

```ts
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/src/server/firebase-admin";

export async function appendAuditEvent(input: {
  actorId: string; actorRole: "customer" | "professional" | "admin" | "agent";
  action: string; entityType: string; entityId: string; metadata?: Record<string, unknown>;
}) {
  await db.collection("auditEvents").add({ ...input, metadata: input.metadata ?? {}, createdAt: FieldValue.serverTimestamp() });
}
```

- [ ] **Step 4: Add deny-by-default client rules**

Create `firestore.rules`:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

All MVP writes go through authenticated server routes; later plans add scoped client reads.

- [ ] **Step 5: Validate and commit**

Run: `npm run validate`

Expected: PASS.

```powershell
git add src/server firestore.rules tests/server
git commit -m "feat: add Firebase persistence and audit boundary"
```

### Task 4: Gemini structured triage provider

**Files:**
- Create: `src/server/ai/triage-provider.ts`
- Create: `src/server/ai/gemini-triage-provider.ts`
- Create: `tests/server/gemini-triage-provider.test.ts`

**Interfaces:**
- Consumes: request description plus signed media URLs
- Produces: `TriageProvider.triage(): Promise<TriageResult>`

- [ ] **Step 1: Write a failing parsing test**

Test a fake model response containing valid JSON and another containing an unknown trade. The valid result must parse; the unknown trade must reject.

- [ ] **Step 2: Define the provider port**

```ts
import type { TriageResult } from "@/src/domain/triage";

export interface TriageProvider {
  triage(input: { description: string; mediaUrls: string[] }): Promise<TriageResult>;
}
```

- [ ] **Step 3: Implement Gemini with schema validation**

Use `GoogleGenAI`, request JSON output, provide the exact `TriageResultSchema` shape in the system instruction, parse the returned JSON, then call `TriageResultSchema.parse()`. The prompt must say: do not diagnose with certainty, use `emergency` for visible fire, gas leak, exposed live wiring or structural-collapse cues, and never invent a price range when evidence is insufficient.

- [ ] **Step 4: Test and commit**

Run: `npm test -- --run tests/server/gemini-triage-provider.test.ts`

Expected: both validation cases pass without a network call.

```powershell
git add src/server/ai tests/server/gemini-triage-provider.test.ts
git commit -m "feat: add schema-validated Gemini triage"
```

### Task 5: Customer request API and mobile form

**Files:**
- Create: `src/server/auth.ts`
- Create: `app/api/requests/route.ts`
- Create: `app/api/requests/[id]/triage/route.ts`
- Create: `app/cliente/solicitudes/nueva/page.tsx`
- Create: `tests/routes/requests.test.ts`

**Interfaces:**
- Consumes: `RequestRepository`, `TriageProvider`, authenticated customer actor
- Produces: `POST /api/requests` and `POST /api/requests/:id/triage`

- [ ] **Step 1: Write route tests**

Cover: 401 without session, 400 for description under 20 characters, 201 with request ID for valid input, and an audit event named `request.created`.

- [ ] **Step 2: Implement the authenticated route**

`POST /api/requests` must derive `customerId` from the verified server session, never from JSON; validate with `ServiceRequestSchema`; create the request; append the audit event; return `{ id }` with status 201.

- [ ] **Step 3: Implement the triage route**

Load the request server-side, ensure the actor owns it, create short-lived signed media URLs, call `TriageProvider`, save the result and append `request.triaged`. If risk is `emergency`, return the triage plus `mustStop: true` and emergency guidance; do not open professional matching automatically.

- [ ] **Step 4: Build the accessible request form**

Fields: description, province, locality and up to six media files. Use visible labels, client-side size/type feedback and a single primary action “Analizar solicitud”. Do not request the street address on this screen.

- [ ] **Step 5: Run acceptance checks and commit**

Run: `npm run validate`

Expected: PASS.

```powershell
git add app/api app/cliente src/server/auth.ts tests/routes
git commit -m "feat: let customers publish and triage requests"
```

### Task 6: Private professional opportunity and quote

**Files:**
- Create: `src/server/repositories/quote-repository.ts`
- Create: `app/profesional/oportunidades/page.tsx`
- Create: `app/api/requests/[id]/quotes/route.ts`
- Create: `tests/routes/quotes.test.ts`
- Create: `e2e/request-to-quote.spec.ts`

**Interfaces:**
- Consumes: authenticated professional profile, `canProfessionalViewRequest()`, `QuoteSchema`
- Produces: private quote creation and end-to-end vertical slice

- [ ] **Step 1: Write authorization tests**

Cover: unverified professional receives 403; wrong trade receives 404 to avoid leaking the request; matched professional receives 201; duplicate professional quote receives 409; API response never includes other quotes.

- [ ] **Step 2: Implement quote persistence and route**

Store quotes under `requests/{requestId}/quotes/{professionalId}` so uniqueness is deterministic. Validate on the server, authorize using the professional profile, write the quote, update request status to `quoted`, and append `quote.submitted` without price data in audit metadata.

- [ ] **Step 3: Build the professional opportunity UI**

Show approximate locality, AI summary, media approved for professional viewing, risk notice and clarification answers. The quote form collects labor, materials, description and estimated hours. Never render quote counts, competitor identities or competitor prices.

- [ ] **Step 4: Add the Playwright happy path**

The test signs in with emulator customer and professional accounts, creates a plumbing request in Lanús, stubs Gemini with a plumbing triage, verifies it appears for the matched professional, submits a quote and confirms that the customer sees exactly one quote.

- [ ] **Step 5: Run all checks**

Run:

```powershell
npm run validate
npm run test:e2e
```

Expected: all unit, route and browser tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/server/repositories app/profesional app/api tests/routes e2e
git commit -m "feat: complete private request-to-quote flow"
```

### Task 7: Firebase App Hosting deployment

**Files:**
- Create: `apphosting.yaml`
- Create: `.env.example`
- Create: `docs/operations/deployment.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: GitHub repository, Firebase project, server secrets
- Produces: deployed staging URL and reproducible deployment instructions

- [ ] **Step 1: Add secret-safe configuration**

`.env.example` lists names only: `GEMINI_API_KEY`, Firebase server credentials and emulator flags. `apphosting.yaml` references Gemini through Cloud Secret Manager. No real value is committed.

- [ ] **Step 2: Document exact setup**

Document Firebase project creation, Blaze-plan requirement, Authentication providers, Firestore/Storage regions, Secret Manager commands, GitHub branch connection and rollback steps.

- [ ] **Step 3: Validate locally**

Run: `npm run validate && npm run build`

Expected: production build succeeds with test configuration.

- [ ] **Step 4: Deploy staging and smoke test**

Connect the GitHub branch through Firebase App Hosting, wait for a healthy rollout, open the staging URL and verify Fiakto copy plus the request form. Confirm server logs contain no tokens or raw identity data.

- [ ] **Step 5: Commit deployment configuration**

```powershell
git add apphosting.yaml .env.example docs/operations README.md
git commit -m "docs: add secure Fiakto staging deployment"
```

## Follow-on implementation plans

This foundation deliberately ends at a real request and private quote. Create separate, independently reviewable plans for:

1. Identity verification, professional badges and abuse controls.
2. Quote acceptance, Mercado Pago seller OAuth and checkout.
3. Work chat, evidence, change orders and double confirmation.
4. Administrative disputes, refunds, releases and split decisions.
5. Premium subscription, bilateral ratings, analytics and contest evidence.

Mercado Pago Split Payments 1:1 is available in Argentina, but it does not by itself implement the approved double-confirmation hold. The payments plan must validate settlement timing and refund authority with Mercado Pago before promising escrow-like behavior.

