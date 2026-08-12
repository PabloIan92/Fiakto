import { getStorage } from "firebase-admin/storage";

// getStorage().bucket() sin nombre resuelve al bucket legacy
// "<project-id>.appspot.com", que no existe en proyectos de Firebase
// creados despues de fines de 2024 (usan "<project-id>.firebasestorage.app").
// Sin esto, cualquier lectura/escritura a Storage falla en runtime.
function bucket() {
  return getStorage().bucket(`${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`);
}

export async function signRequestMedia(storagePaths: string[]) {
  const expires = Date.now() + 5 * 60 * 1000;
  return Promise.all(
    storagePaths.map(async (storagePath) => {
      const [url] = await bucket().file(storagePath).getSignedUrl({ action: "read", expires });
      return url;
    }),
  );
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadProfilePhoto(
  userId: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (!ALLOWED_PHOTO_TYPES.has(contentType)) {
    throw new Error("Tipo de archivo no permitido");
  }
  if (buffer.byteLength > MAX_PHOTO_BYTES) {
    throw new Error("La imagen supera el tamaño máximo permitido");
  }

  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const storagePath = `profile-photos/${userId}.${extension}`;
  await bucket().file(storagePath).save(buffer, { contentType });
  return storagePath;
}

export async function signProfilePhoto(storagePath: string): Promise<string> {
  const expires = Date.now() + 60 * 60 * 1000; // 1h: suficiente para una carga de pagina
  const [url] = await bucket().file(storagePath).getSignedUrl({ action: "read", expires });
  return url;
}

// Comprobante de transferencia: mismo patron que uploadProfilePhoto (una
// sola imagen chica en base64, sin necesidad de signed URLs de escritura),
// una por solicitud.
export async function uploadPaymentReceipt(
  requestId: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (!ALLOWED_PHOTO_TYPES.has(contentType)) {
    throw new Error("Tipo de archivo no permitido");
  }
  if (buffer.byteLength > MAX_PHOTO_BYTES) {
    throw new Error("La imagen supera el tamaño máximo permitido");
  }

  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const storagePath = `payment-receipts/${requestId}.${extension}`;
  await bucket().file(storagePath).save(buffer, { contentType });
  return storagePath;
}
