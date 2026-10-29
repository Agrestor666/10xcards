import { describe, expect, it, vi } from "vitest";

import { MAX_PHOTO_BYTES, MAX_PHOTO_EDGE_PX } from "@/lib/ai-generation-limits";
import {
  JPEG_QUALITY,
  preparePhotoDataUrl,
  scaledDimensions,
  type DecodedPhoto,
  type PhotoEncoder,
} from "@/lib/photo-prep";

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const prefix = "data:image/jpeg;base64,";
  expect(dataUrl.startsWith(prefix)).toBe(true);
  const base64 = dataUrl.slice(prefix.length);
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

describe("scaledDimensions", () => {
  it("shrinks the longest edge to the photo cap", () => {
    expect(scaledDimensions(3200, 800)).toEqual({ width: MAX_PHOTO_EDGE_PX, height: 400 });
    expect(scaledDimensions(800, 3200)).toEqual({ width: 400, height: MAX_PHOTO_EDGE_PX });
  });

  it("keeps images that already fit", () => {
    expect(scaledDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(scaledDimensions(MAX_PHOTO_EDGE_PX, MAX_PHOTO_EDGE_PX)).toEqual({
      width: MAX_PHOTO_EDGE_PX,
      height: MAX_PHOTO_EDGE_PX,
    });
  });

  it("rounds the short edge and keeps at least one pixel", () => {
    expect(scaledDimensions(10_000, 10)).toEqual({ width: MAX_PHOTO_EDGE_PX, height: 2 });
    expect(scaledDimensions(10_000, 1)).toEqual({ width: MAX_PHOTO_EDGE_PX, height: 1 });
  });

  it("returns an empty size for non-positive dimensions", () => {
    expect(scaledDimensions(0, 400)).toEqual({ width: 0, height: 0 });
    expect(scaledDimensions(400, -1)).toEqual({ width: 0, height: 0 });
  });
});

describe("preparePhotoDataUrl", () => {
  it("returns a JPEG data URL of the resized bytes, not the original file", async () => {
    const encoded = new Uint8Array([1, 2, 3, 255]);
    const encodeJpeg = vi.fn(() => Promise.resolve(new Blob([encoded])));
    const encoder: PhotoEncoder = {
      decode() {
        return Promise.resolve({ width: 3200, height: 800 });
      },
      encodeJpeg,
    };

    const result = await preparePhotoDataUrl(new Blob(["ORIGINAL-CAMERA-FILE"]), encoder);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(dataUrlToBytes(result.dataUrl)).toEqual(encoded);
    expect(result.dataUrl.includes("ORIGINAL-CAMERA-FILE")).toBe(false);
    expect(encodeJpeg).toHaveBeenCalledWith(
      expect.objectContaining({ width: 3200, height: 800 }),
      MAX_PHOTO_EDGE_PX,
      400,
      JPEG_QUALITY,
    );
  });

  it("returns too_large when the JPEG is still over the decoded byte cap", async () => {
    const encoder: PhotoEncoder = {
      decode() {
        return Promise.resolve({ width: 100, height: 100 });
      },
      encodeJpeg() {
        return Promise.resolve(new Blob([new Uint8Array(MAX_PHOTO_BYTES + 1)]));
      },
    };

    await expect(preparePhotoDataUrl(new Blob(["camera"]), encoder)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("accepts a JPEG that is exactly at the decoded byte cap", async () => {
    const encoder: PhotoEncoder = {
      decode() {
        return Promise.resolve({ width: 100, height: 100 });
      },
      encodeJpeg() {
        return Promise.resolve(new Blob([new Uint8Array(MAX_PHOTO_BYTES)]));
      },
    };

    const result = await preparePhotoDataUrl(new Blob(["camera"]), encoder);
    expect(result.ok).toBe(true);
  });

  it("returns unreadable when decode fails, encode fails, or the image has no size", async () => {
    const close = vi.fn();
    const encodeJpeg = vi.fn(() => Promise.resolve(new Blob(["jpeg"])));
    const zeroSize: PhotoEncoder = {
      decode() {
        const photo: DecodedPhoto = { width: 0, height: 10, close };
        return Promise.resolve(photo);
      },
      encodeJpeg,
    };

    await expect(preparePhotoDataUrl(new Blob(["x"]), zeroSize)).resolves.toEqual({
      ok: false,
      reason: "unreadable",
    });
    expect(encodeJpeg).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();

    await expect(
      preparePhotoDataUrl(new Blob(["x"]), {
        decode() {
          return Promise.reject(new Error("decode"));
        },
        encodeJpeg() {
          return Promise.resolve(new Blob(["jpeg"]));
        },
      }),
    ).resolves.toEqual({ ok: false, reason: "unreadable" });

    await expect(
      preparePhotoDataUrl(new Blob(["x"]), {
        decode() {
          return Promise.resolve({ width: 20, height: 20 });
        },
        encodeJpeg() {
          return Promise.reject(new Error("encode"));
        },
      }),
    ).resolves.toEqual({ ok: false, reason: "unreadable" });
  });
});
