import { MAX_PHOTO_BYTES, MAX_PHOTO_EDGE_PX } from "@/lib/ai-generation-limits";

/** JPEG quality used when resizing a photo before transcription. */
export const JPEG_QUALITY = 0.8;

export type PhotoPrepFailure = "too_large" | "unreadable";

export type PhotoPrepResult = { ok: true; dataUrl: string } | { ok: false; reason: PhotoPrepFailure };

export interface DecodedPhoto {
  width: number;
  height: number;
  close?: () => void;
}

export interface PhotoEncoder {
  decode(file: Blob): Promise<DecodedPhoto>;
  encodeJpeg(photo: DecodedPhoto, width: number, height: number, quality: number): Promise<Blob>;
}

interface BrowserDecodedPhoto extends DecodedPhoto {
  source: CanvasImageSource;
}

export function scaledDimensions(
  width: number,
  height: number,
  maxEdge = MAX_PHOTO_EDGE_PX,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }

  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function jpegBytesToDataUrl(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const end = Math.min(index + chunkSize, bytes.length);
    const codes: number[] = [];
    for (let cursor = index; cursor < end; cursor += 1) {
      codes.push(bytes[cursor] ?? 0);
    }
    binary += String.fromCharCode(...codes);
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

function loadHtmlImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    image.src = url;
  });
}

async function decodeBrowserPhoto(file: Blob): Promise<BrowserDecodedPhoto> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      close: () => {
        bitmap.close();
      },
    };
  }

  const image = await loadHtmlImage(file);
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    source: image,
  };
}

function encodeBrowserJpeg(photo: BrowserDecodedPhoto, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("canvas"));
  }

  context.drawImage(photo.source, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("blob"));
        }
      },
      "image/jpeg",
      quality,
    );
  });
}

const browserPhotoEncoder: PhotoEncoder = {
  decode(file) {
    return decodeBrowserPhoto(file);
  },
  encodeJpeg(photo, width, height, quality) {
    return encodeBrowserJpeg(photo as BrowserDecodedPhoto, width, height, quality);
  },
};

export async function preparePhotoDataUrl(
  file: Blob,
  encoder: PhotoEncoder = browserPhotoEncoder,
): Promise<PhotoPrepResult> {
  let photo: DecodedPhoto | undefined;
  try {
    try {
      photo = await encoder.decode(file);
    } catch {
      return { ok: false, reason: "unreadable" };
    }

    const { width, height } = scaledDimensions(photo.width, photo.height);
    if (width < 1 || height < 1) {
      return { ok: false, reason: "unreadable" };
    }

    const blob = await encoder.encodeJpeg(photo, width, height, JPEG_QUALITY);
    if (blob.size < 1) {
      return { ok: false, reason: "unreadable" };
    }
    if (blob.size > MAX_PHOTO_BYTES) {
      return { ok: false, reason: "too_large" };
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { ok: true, dataUrl: jpegBytesToDataUrl(bytes) };
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    photo?.close?.();
  }
}
