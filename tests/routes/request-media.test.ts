import { describe, expect, it } from "vitest";

import { createRequestsMediaPostHandler } from "@/app/api/requests/media/handler";
import type { RequestMediaUpload } from "@/src/server/media";

function request(body: unknown) {
  return new Request("http://localhost/api/requests/media", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function dependencies(
  actor: { id: string; role: "customer" | "professional" | "admin" } | null,
) {
  const calls: Array<{ customerId: string; files: Array<{ mimeType: string }> }> = [];
  const uploads: RequestMediaUpload[] = [];
  return {
    calls,
    uploads,
    deps: {
      authenticate: async () => actor,
      createUploadUrls: async (
        customerId: string,
        files: Array<{ mimeType: string }>,
      ): Promise<RequestMediaUpload[]> => {
        calls.push({ customerId, files });
        return files.map((file, index) => {
          const item: RequestMediaUpload = {
            storagePath: `requests/${customerId}/file-${index}.${file.mimeType.split("/")[1]}`,
            uploadUrl: `https://storage.example.com/${customerId}/${index}`,
            mimeType: file.mimeType as RequestMediaUpload["mimeType"],
          };
          uploads.push(item);
          return item;
        });
      },
    },
  };
}

describe("POST /api/requests/media", () => {
  it("returns 401 without an authenticated session", async () => {
    const { deps } = dependencies(null);
    const response = await createRequestsMediaPostHandler(deps)(request({ files: [{ mimeType: "image/jpeg" }] }));
    expect(response.status).toBe(401);
  });

  it("returns 401 for an admin even with a valid session", async () => {
    const { deps } = dependencies({ id: "admin-1", role: "admin" });
    const response = await createRequestsMediaPostHandler(deps)(request({ files: [{ mimeType: "image/jpeg" }] }));
    expect(response.status).toBe(401);
  });

  it("accepts a customer and returns signed upload URLs scoped to their id", async () => {
    const { deps, calls, uploads } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createRequestsMediaPostHandler(deps)(
      request({ files: [{ mimeType: "image/jpeg" }, { mimeType: "video/mp4" }] }),
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      { customerId: "customer-1", files: [{ mimeType: "image/jpeg" }, { mimeType: "video/mp4" }] },
    ]);
    await expect(response.json()).resolves.toEqual({
      media: uploads.map(({ storagePath, uploadUrl, mimeType }) => ({ storagePath, uploadUrl, mimeType })),
    });
    expect(uploads.every((u) => u.storagePath.startsWith("requests/customer-1/"))).toBe(true);
  });

  it("accepts a professional too", async () => {
    const { deps, calls } = dependencies({ id: "pro-1", role: "professional" });
    const response = await createRequestsMediaPostHandler(deps)(request({ files: [{ mimeType: "image/png" }] }));
    expect(response.status).toBe(200);
    expect(calls[0]?.customerId).toBe("pro-1");
  });

  it("returns 400 for invalid JSON", async () => {
    const { deps } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createRequestsMediaPostHandler(deps)(
      new Request("http://localhost/api/requests/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for an empty files array", async () => {
    const { deps } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createRequestsMediaPostHandler(deps)(request({ files: [] }));
    expect(response.status).toBe(400);
  });

  it("returns 400 for more than 6 files", async () => {
    const { deps } = dependencies({ id: "customer-1", role: "customer" });
    const files = Array.from({ length: 7 }, () => ({ mimeType: "image/jpeg" }));
    const response = await createRequestsMediaPostHandler(deps)(request({ files }));
    expect(response.status).toBe(400);
  });

  it("returns 400 for an unsupported mime type", async () => {
    const { deps } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createRequestsMediaPostHandler(deps)(request({ files: [{ mimeType: "image/gif" }] }));
    expect(response.status).toBe(400);
  });

  it("returns 400 for a missing files field", async () => {
    const { deps } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createRequestsMediaPostHandler(deps)(request({}));
    expect(response.status).toBe(400);
  });
});
