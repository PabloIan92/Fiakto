import { describe, expect, it } from "vitest";

import type { ServiceRequest } from "@/src/domain/requests";
import type { TriageResult } from "@/src/domain/triage";
import { createTriagePostHandler } from "@/app/api/requests/[id]/triage/route";

const storedRequest: ServiceRequest = {
  customerId: "customer-1",
  description: "La canilla pierde agua debajo de la mesada.",
  province: "Buenos Aires",
  locality: "Lanús",
  media: [{ storagePath: "requests/1/photo.jpg", mimeType: "image/jpeg" }],
  status: "triaging",
};

const normalTriage: TriageResult = {
  trade: "plomeria",
  summary: "Probable pérdida en una conexión bajo la mesada.",
  questions: ["¿La pérdida continúa con la llave cerrada?"],
  riskLevel: "normal",
  referenceRangeArs: null,
  confidence: 0.8,
};

function dependencies(options?: { owner?: string; result?: TriageResult }) {
  const saved: Array<{ id: string; result: TriageResult; open?: boolean }> = [];
  const audits: Array<Record<string, unknown>> = [];
  const triageInputs: Array<{ description: string; mediaUrls: string[] }> = [];
  return {
    saved,
    audits,
    triageInputs,
    deps: {
      authenticate: async () => ({ id: "customer-1", role: "customer" as const }),
      repository: {
        findById: async () => ({ ...storedRequest, customerId: options?.owner ?? storedRequest.customerId }),
        saveTriage: async (id: string, result: TriageResult, saveOptions?: { open?: boolean }) => {
          saved.push({ id, result, open: saveOptions?.open });
        },
      },
      signMedia: async (paths: string[]) => paths.map((path) => `https://signed.example/${path}`),
      triageProvider: {
        triage: async (input: { description: string; mediaUrls: string[] }) => {
          triageInputs.push(input);
          return options?.result ?? normalTriage;
        },
      },
      appendAudit: async (event: Record<string, unknown>) => { audits.push(event); },
    },
  };
}

function call(handler: ReturnType<typeof createTriagePostHandler>) {
  return handler(new Request("http://localhost/api/requests/request-1/triage", { method: "POST" }), {
    params: Promise.resolve({ id: "request-1" }),
  });
}

describe("POST /api/requests/:id/triage", () => {
  it("rejects a customer who does not own the request", async () => {
    const { deps } = dependencies({ owner: "another-customer" });
    const response = await call(createTriagePostHandler(deps));
    expect(response.status).toBe(403);
  });

  it("signs media, saves normal triage and appends an audit event", async () => {
    const { deps, saved, audits, triageInputs } = dependencies();
    const response = await call(createTriagePostHandler(deps));
    expect(response.status).toBe(200);
    expect(triageInputs[0]?.mediaUrls[0]).toContain("https://signed.example/");
    expect(saved[0]).toMatchObject({ id: "request-1", open: true });
    expect(audits[0]).toMatchObject({ action: "request.triaged", entityId: "request-1" });
  });

  it("stops matching and returns guidance for an emergency", async () => {
    const emergency = { ...normalTriage, riskLevel: "emergency" as const };
    const { deps, saved } = dependencies({ result: emergency });
    const response = await call(createTriagePostHandler(deps));
    const body = await response.json();
    expect(saved[0]?.open).toBe(false);
    expect(body).toMatchObject({ mustStop: true, triage: emergency });
    expect(body.guidance).toBeTruthy();
  });
});
