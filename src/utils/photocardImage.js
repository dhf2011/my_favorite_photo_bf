import crypto from "crypto";
import sharp from "sharp";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 82;

export function photocardImageUrl(photoCardId) {
  const id = Number(photoCardId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return `/api/photo-cards/${id}/image`;
}

export function hashImageBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function resizePhotocardImage(buffer, mime) {
  const meta = await sharp(buffer, { failOn: "none" }).rotate().metadata();
  const width = Number(meta.width) || 0;
  const height = Number(meta.height) || 0;

  if (width <= MAX_EDGE && height <= MAX_EDGE) {
    return { data: buffer, mime };
  }

  let pipeline = sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });

  const format = String(meta.format || "").toLowerCase();
  if (format === "jpeg" || mime === "image/jpeg") {
    return {
      data: await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer(),
      mime: "image/jpeg",
    };
  }
  if (format === "webp" || mime === "image/webp") {
    return {
      data: await pipeline.webp({ quality: JPEG_QUALITY }).toBuffer(),
      mime: "image/webp",
    };
  }
  return {
    data: await pipeline.png({ compressionLevel: 8 }).toBuffer(),
    mime: "image/png",
  };
}

export function applyPhotocardImageUrl(row) {
  if (!row) return row;
  const imageUrl = photocardImageUrl(row.photo_card_id ?? row.photoCardId);
  if (imageUrl) {
    row.image_url = imageUrl;
    row.imageUrl = imageUrl;
  }
  return row;
}
