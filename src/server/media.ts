import { getStorage } from "firebase-admin/storage";

export async function signRequestMedia(storagePaths: string[]) {
  const expires = Date.now() + 5 * 60 * 1000;
  return Promise.all(
    storagePaths.map(async (storagePath) => {
      const [url] = await getStorage()
        .bucket()
        .file(storagePath)
        .getSignedUrl({ action: "read", expires });
      return url;
    }),
  );
}
