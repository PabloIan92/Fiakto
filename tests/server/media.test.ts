import { describe, expect, it, vi } from "vitest";

const signedCalls: Array<{ storagePath: string; action: string; expires: number; contentType?: string }> = [];
const fileCalls: string[] = [];

vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      file: (path: string) => {
        fileCalls.push(path);
        return {
          getSignedUrl: async (opts: { action: string; expires: number; contentType?: string }) => {
            signedCalls.push({ storagePath: path, ...opts });
            return [`https://storage.example.com/${encodeURIComponent(path)}`];
          },
        };
      },
    }),
  }),
}));

import { createRequestMediaUploadUrls } from "@/src/server/media";

const ENV = { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "fiakto-test" };

describe("createRequestMediaUploadUrls", () => {
  it("generates signed write URLs under requests/{customer}/{uuid}-{index}.{ext}", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", ENV.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

    signedCalls.length = 0;

    const result = await createRequestMediaUploadUrls("customer-1", [
      { mimeType: "image/jpeg" },
      { mimeType: "video/mp4" },
      { mimeType: "audio/mpeg" },
      { mimeType: "audio/mp4" },
    ]);

    expect(result).toHaveLength(4);
    expect(result.map((r) => r.mimeType)).toEqual(["image/jpeg", "video/mp4", "audio/mpeg", "audio/mp4"]);

    expect(signedCalls).toHaveLength(4);
    expect(signedCalls.every((c) => c.action === "write")).toBe(true);
    expect(signedCalls[0]?.contentType).toBe("image/jpeg");
    expect(signedCalls[1]?.contentType).toBe("video/mp4");
    expect(signedCalls[2]?.contentType).toBe("audio/mpeg");
    expect(signedCalls[3]?.contentType).toBe("audio/mp4");

    expect(signedCalls.every((c) => c.storagePath.startsWith("requests/customer-1/"))).toBe(true);
    expect(fileCalls.filter((p) => p.endsWith("-0.jpg")).length).toBe(1);
    expect(fileCalls.filter((p) => p.endsWith("-1.mp4")).length).toBe(1);
    expect(fileCalls.filter((p) => p.endsWith("-2.mp3")).length).toBe(1);
    expect(fileCalls.filter((p) => p.endsWith("-3.m4a")).length).toBe(1);

    vi.unstubAllEnvs();
  });

  it("encodes the customerId in the storage path", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", ENV.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    signedCalls.length = 0;

    await createRequestMediaUploadUrls("customer with spaces", [{ mimeType: "image/png" }]);

    expect(signedCalls[0]?.storagePath.startsWith("requests/customer%20with%20spaces/")).toBe(true);
    expect(signedCalls[0]?.storagePath.endsWith("-0.png")).toBe(true);

    vi.unstubAllEnvs();
  });

  it("throws for an unsupported mime type", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", ENV.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    signedCalls.length = 0;

    await expect(createRequestMediaUploadUrls("customer-1", [{ mimeType: "image/gif" }])).rejects.toBeDefined();
    expect(signedCalls).toHaveLength(0);

    vi.unstubAllEnvs();
  });

  it("uses a 10-minute expiry window", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", ENV.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    signedCalls.length = 0;
    const before = Date.now();

    await createRequestMediaUploadUrls("customer-1", [{ mimeType: "image/jpeg" }]);

    const expires = signedCalls[0]?.expires ?? 0;
    expect(expires - before).toBeGreaterThanOrEqual(9 * 60 * 1000);
    expect(expires - before).toBeLessThanOrEqual(11 * 60 * 1000);

    vi.unstubAllEnvs();
  });
});
