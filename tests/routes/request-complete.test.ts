import { describe, expect, it } from "vitest";

import type { ServiceRequestWithId } from "@/src/server/repositories/request-repository";
import { createRequestCompleteHandler } from "@/app/api/requests/[id]/complete/handler";

const inProgressForPro1: ServiceRequestWithId = {
  id: "request-1",
  customerId: "customer-1",
  description: "La canilla pierde agua debajo de la mesada de la cocina.",
  location: {
    lat: -34.6,
    lng: -58.4,
    displayRadiusKm: 3,
    province: "Buenos Aires",
    locality: "Lanús",
  },
  media: [],
  status: "in_progress",
  professionalId: "pro-1",
  slaDeadline: "2026-08-10T12:00:00.000Z",
};

function context() {
  return { params: Promise.resolve({ id: "request-1" }) };
}

const completionPhoto = { storagePath: "requests/pro-1/done.jpg", mimeType: "image/jpeg" };

function call(
  handler: ReturnType<typeof createRequestCompleteHandler>,
  body: unknown = completionPhoto,
) {
  return handler(
    new Request("http://localhost/api/requests/request-1/complete", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    context(),
  );
}

function dependencies(ownJobs: ServiceRequestWithId[] = [inProgressForPro1]) {
  const completed: Array<{ id: string; input: Record<string, unknown> }> = [];
  const audits: Array<Record<string, unknown>> = [];
  return {
    completed,
    audits,
    deps: {
      authenticate: async () => ({ id: "pro-1", role: "professional" as const }),
      repository: {
        listByProfessional: async () => ownJobs,
        completeWork: async (id: string, input: Record<string, unknown>) => {
          completed.push({ id, input });
        },
      },
      appendAudit: async (event: Record<string, unknown>) => {
        audits.push(event);
      },
      now: () => new Date("2026-08-09T18:00:00.000Z"),
    },
  };
}

describe("POST /api/requests/:id/complete", () => {
  it("returns 404 when the request isn't assigned to this professional", async () => {
    const { deps } = dependencies([]);
    const response = await call(createRequestCompleteHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 409 when the request isn't in progress", async () => {
    const { deps } = dependencies([{ ...inProgressForPro1, status: "completed" }]);
    const response = await call(createRequestCompleteHandler(deps));
    expect(response.status).toBe(409);
  });

  it("returns 400 when there is no completion photo in the body", async () => {
    const { deps } = dependencies();
    const response = await call(createRequestCompleteHandler(deps), {});
    expect(response.status).toBe(400);
  });

  it("completes the job with the completion photo and appends an audit event", async () => {
    const { deps, completed, audits } = dependencies();
    const response = await call(createRequestCompleteHandler(deps));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "completed", workCompletedAt: "2026-08-09T18:00:00.000Z" });
    expect(completed[0]).toMatchObject({
      id: "request-1",
      input: { workCompletedAt: "2026-08-09T18:00:00.000Z", completionMedia: completionPhoto },
    });
    expect(audits[0]).toMatchObject({ action: "request.work_completed", entityId: "request-1" });
  });
});
