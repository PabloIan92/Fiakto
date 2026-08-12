import { z } from "zod";
import { getStorage } from "firebase-admin/storage";

import { MediaMimeTypeSchema } from "@/src/domain/requests";

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

const EXTENSION_BY_MIME_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "video/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
} satisfies Record<z.infer<typeof MediaMimeTypeSchema>, string>;

export type RequestMediaUpload = {
  storagePath: string;
  uploadUrl: string;
  mimeType: z.infer<typeof MediaMimeTypeSchema>;
};

// Contraparte de escritura de signRequestMedia (que es de lectura): el
// cliente pide signed URLs de PUT y sube cada archivo directo a Storage, en
// vez de mandarlo embebido en el body del POST a /api/requests (los archivos
// pueden pesar hasta 20MB y eso romperia el limite de payload de la route).
export async function createRequestMediaUploadUrls(
  customerId: string,
  files: Array<{ mimeType: string }>,
): Promise<RequestMediaUpload[]> {
  const expires = Date.now() + 10 * 60 * 1000;
  const customerSegment = encodeURIComponent(customerId);
  return Promise.all(
    files.map(async (file, index) => {
      const mimeType = MediaMimeTypeSchema.parse(file.mimeType);
      const extension = EXTENSION_BY_MIME_TYPE[mimeType];
      const storagePath = `requests/${customerSegment}/${crypto.randomUUID()}-${index}.${extension}`;
      const [uploadUrl] = await bucket()
        .file(storagePath)
        .getSignedUrl({ action: "write", expires, contentType: mimeType });
      return { storagePath, uploadUrl, mimeType };
    }),
  );
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
