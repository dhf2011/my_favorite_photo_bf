import crypto from "crypto";

export function photocardImageUrl(photoCardId) {
  const id = Number(photoCardId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return `/api/photo-cards/${id}/image`;
}

export function hashImageBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
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
