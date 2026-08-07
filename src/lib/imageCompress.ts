/**
 * Compress an image file using canvas + JPEG re-encode.
 * Reduces file size by ~70-80% while keeping quality good enough for documentation.
 */

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.7;

import { devLog, devWarn } from "@/lib/devLog";

/**
 * Compress an image File to JPEG.
 * Returns a new File at the compressed quality, or the original if compression fails.
 */
export async function compressImage(file: File): Promise<File> {
  // Only compress images
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Skip if already small enough
    if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && file.size < 300_000) {
      bitmap.close();
      return file;
    }

    // Scale down to fit within MAX_DIMENSION
    let newWidth = width;
    let newHeight = height;
    if (newWidth > MAX_DIMENSION || newHeight > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / newWidth, MAX_DIMENSION / newHeight);
      newWidth = Math.round(newWidth * ratio);
      newHeight = Math.round(newHeight * ratio);
    }

    // Draw to canvas and export as JPEG
    const canvas = document.createElement("canvas");
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
    bitmap.close();

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b as Blob),
        "image/jpeg",
        JPEG_QUALITY
      );
    });

    const compressed = new File(
      [blob],
      file.name.replace(/\.[^.]+$/, ".jpg"),
      { type: "image/jpeg" }
    );

    devLog(
      `Compressed ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB (${((1 - compressed.size / file.size) * 100).toFixed(0)}% reduction)`
    );

    return compressed;
  } catch (err) {
    devWarn("Image compression failed, uploading original:", err);
    return file;
  }
}

/**
 * Compress an array of image files. Returns new File array with compressed versions.
 */
export async function compressImages(files: File[]): Promise<File[]> {
  if (!files.length) return files;
  const compressed = await Promise.all(files.map(compressImage));
  return compressed;
}
