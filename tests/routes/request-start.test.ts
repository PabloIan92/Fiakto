import { describe, expect, it } from "vitest";

import type { ServiceRequestWithId } from "@/src/server/repositories/request-repository";
import type { UserProfile } from "@/src/domain/profile";
import { createRequestStartHandler } from "@/app/api/requests/[id]/start/handler";

const openInLanus: ServiceRequestWithId = {
  id: "request-1",
  customerId: "customer-1",
  description: "La canilla pierde agua debajo de la mesada de la cocina.",
  location: {
    lat: -34.6,
    lng: -58.4,
    displayRadiusKm: 3,
    province: "Buenos Aires",
    locality: "Lanús",
    exactAddress: "Calle Falsa 123",
  },
  media: [],
  status: "open",
  triage: {
    trade: "plomeria",
    summary: "Pérdida en la canilla.",
    questions: [],
    riskLevel: "urgent",
    referenceRangeArs: null,
    confidence: 0.9,
  },
};

function context() {
  return { params: Promise.resolve({ id: "request-1" }) };
}

function call(handler: ReturnType<typeof createRequestStartHandler>) {
  return handler(
    new Request("http://localhost/api/requests/request-1/start", { method: "POST" }),
    context(),
  );
}

function dependencies(options?: { open?: ServiceRequestWithId[]; profile?: UserProfile | null }) {
  const started: Array<{ id: string; input: Record<string, unknown> }> = [];
  const audits: Array<Record<string, unknown>> = [];
  return {
    started,
    audits,
    deps: {
      authenticate: async () => ({ id: "pro-1", role: "professional" as const }),
      repository: {
        listOpen: async () => options?.open ?? [openInLanus],
        startWork: async (id: string, input: Record<string, unknown>) => {
          started.push({ id, input });
        },
      },
      profileRepository: {
        get: async () =>
          options?.profile === undefined
            ? ({
                userId: "pro-1",
                role: "professional",
                phone: "1",
                trades: ["plomeria"],
                coverage: ["Lanús"],
              } as UserProfile)
            : options.profile,
        upsert: async () => undefined,
      },
      appendAudit: async (event: Record<string, unknown>) => {
        audits.push(event);
      },
      now: () => new Date("2026-08-09T12:00:00.000Z"),
    },
  };
}

describe("POST /api/requests/:id/start", () => {
  it("rejects a professional whose trade doesn't match", async () => {
    const { deps } = dependencies({
      profile: {
        userId: "pro-1",
        role: "professional",
        phone: "1",
        trades: ["electricidad"],
        coverage: ["Lanús"],
      },
    });
    const response = await call(createRequestStartHandler(deps));
    expect(response.status).toBe(403);
  });

  it("returns 404 when the request isn't open", async () => {
    const { deps } = dependencies({ open: [] });
    const response = await call(createRequestStartHandler(deps));
    expect(response.status).toBe(404);
  });

  it("starts work with an SLA deadline based on the triage risk level and appends an audit event", async () => {
    const { deps, started, audits } = dependencies();
    const response = await call(createRequestStartHandler(deps));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "in_progress",
      workStartedAt: "2026-08-09T12:00:00.000Z",
      slaDeadline: "2026-08-10T12:00:00.000Z",
      slaHours: 24,
    });
    expect(started[0]).toMatchObject({
      id: "request-1",
      input: { professionalId: "pro-1", slaHours: 24 },
    });
    expect(audits[0]).toMatchObject({ action: "request.work_started", entityId: "request-1" });
  });
});
