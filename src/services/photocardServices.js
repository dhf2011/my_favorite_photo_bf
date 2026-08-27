// BE/src/services/photocardServices.js
import photocardRepo from '../repositories/photocardRepository.js';
import {
  createUserCard,
  getTotalQuantityByPhotoCardId,
  findPagedByUserId,
  countByUserIdFiltered,
  countGradesByUserId,
} from '../repositories/userCardRepository.js';
import {
  normalizeGrade,
  normalizeGenre,
  assertAllowedGrade,
  assertAllowedGenre,
} from '../constants/photoCardEnums.js';
import { photocardImageUrl, hashImageBuffer } from '../utils/photocardImage.js';

const ALLOWED_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

function parseImageInput(file, imageUrl) {
  if (file?.buffer?.length) {
    const mime = String(file.mimetype || '').trim();
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      const err = new Error('UNSUPPORTED_FILE_TYPE');
      err.status = 400;
      err.meta = { allowed: Array.from(ALLOWED_IMAGE_MIME) };
      throw err;
    }
    return {
      data: file.buffer,
      mime,
      hash: hashImageBuffer(file.buffer),
    };
  }

  const raw = String(imageUrl || '').trim();
  const dataUri = raw.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i);
  if (dataUri) {
    const mime = dataUri[1].toLowerCase();
    const data = Buffer.from(dataUri[2], 'base64');
    if (!data.length) return null;
    return { data, mime, hash: hashImageBuffer(data) };
  }

  return null;
}

function mapRow(row) {
  return {
    photoCardId: Number(row.photo_card_id),
    creatorUserId: Number(row.creator_user_id),
    name: row.name,
    description: row.description,
    genre: row.genre,
    grade: row.grade,
    minPrice: Number(row.min_price),
    totalSupply: Number(row.total_supply),
    imageUrl: photocardImageUrl(row.photo_card_id),
    regDate: row.reg_date,
    uptDate: row.upt_date,
  };
}

// ✅ MyGallery items 매핑 (CardOriginal에 꽂기 좋게 id 포함)
function mapUserCardRow(row) {
  return {
    id: Number(row.user_card_id),
    userCardId: Number(row.user_card_id),
    photoCardId: Number(row.photo_card_id),
    quantity: Number(row.quantity),
    acquiredDate: row.acquired_date,
    name: row.name,
    description: row.description,
    genre: row.genre,
    grade: row.grade, // DB: common/rare/superrare/legendary
    minPrice: Number(row.min_price),
    imageUrl: photocardImageUrl(row.photo_card_id),
    creatorUserId: Number(row.creator_user_id),
  };
}

function buildCounts(rows) {
  const counts = { total: 0, common: 0, rare: 0, superRare: 0, legendary: 0 };

  for (const r of rows) {
    const g = normalizeGrade(r.grade);
    const qty = Number(r.qty || 0);

    counts.total += qty;

    if (g === 'common') counts.common += qty;
    else if (g === 'rare') counts.rare += qty;
    else if (g === 'superrare') counts.superRare += qty;
    else if (g === 'legendary') counts.legendary += qty;
  }

  return counts;
}

// =========================
// PhotoCard Create
// =========================
async function createPhotoCard(creatorUserId, payload) {
  if (!Number.isInteger(creatorUserId) || creatorUserId <= 0) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { field: 'creatorUserId', rule: 'must be a positive integer' };
    throw err;
  }

  const name = String(payload?.name || '').trim();
  const genre = normalizeGenre(payload?.genre);
  const grade = normalizeGrade(payload?.grade);

  if (!name || !genre || !grade) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { required: ['name', 'genre', 'grade'] };
    throw err;
  }

  assertAllowedGenre(genre);
  assertAllowedGrade(grade);

  const totalSupply = Number(payload?.totalSupply);
  if (!Number.isFinite(totalSupply) || totalSupply <= 0) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { field: 'totalSupply', rule: 'must be positive number' };
    throw err;
  }
  if (totalSupply > 10) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { field: 'totalSupply', rule: 'cannot exceed 10' };
    throw err;
  }

  const minPrice = payload?.minPrice != null ? Number(payload.minPrice) : 0;

  const image = parseImageInput(payload?.imageFile, payload?.imageUrl);
  if (!image) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { required: ['file'], note: 'png/jpeg/webp, max 5MB' };
    throw err;
  }

  const description = payload?.description ?? null;

  const existing = await photocardRepo.findDuplicatePhotoCard({
    name,
    description,
    genre,
    grade,
    minPrice,
    imageHash: image.hash,
  });

  let id;
  if (existing) {
    const currentTotalQuantity = await getTotalQuantityByPhotoCardId(
      existing.photo_card_id,
    );
    const newTotalSupply = currentTotalQuantity + totalSupply;
    if (newTotalSupply > 10) {
      const err = new Error('VALIDATION_ERROR');
      err.status = 400;
      err.meta = {
        field: 'totalSupply',
        rule: `cannot exceed 10 (current: ${currentTotalQuantity}, requested: ${totalSupply}, would be: ${newTotalSupply})`,
      };
      throw err;
    }
    id = existing.photo_card_id;
  } else {
    id = await photocardRepo.createPhotoCard({
      creatorUserId,
      name,
      description,
      genre,
      grade,
      minPrice,
      totalSupply,
      imageUrl: '',
      imageData: image.data,
      imageMime: image.mime,
      imageHash: image.hash,
    });
    await photocardRepo.updatePhotoCardById(id, {
      imageUrl: photocardImageUrl(id),
    });
  }

  await createUserCard({
    ownerId: creatorUserId,
    photocardId: id,
    createdUserId: creatorUserId,
    quantity: totalSupply,
  });

  const actualTotalSupply = await getTotalQuantityByPhotoCardId(id);
  await photocardRepo.updateTotalSupply(id, actualTotalSupply);

  return { photoCardId: id, imageUrl: photocardImageUrl(id) };
}

// =========================
// PhotoCard List / Get / Update
// =========================
async function listPhotoCards({ limit = 20, cursor = null } = {}) {
  const parsedLimit = Math.min(Number(limit) || 20, 50);
  const parsedCursor = cursor != null ? Number(cursor) : null;

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { field: 'limit', rule: 'must be a positive integer' };
    throw err;
  }
  if (
    parsedCursor != null &&
    (!Number.isInteger(parsedCursor) || parsedCursor <= 0)
  ) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { field: 'cursor', rule: 'must be a positive integer' };
    throw err;
  }

  const rows = await photocardRepo.listPhotoCards({
    limit: parsedLimit,
    cursor: parsedCursor,
  });

  const items = rows.map(mapRow);
  const nextCursor = items.length ? items[items.length - 1].photoCardId : null;

  return { items, nextCursor };
}

async function getPhotoCardById(photoCardId) {
  const id = Number(photoCardId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { field: 'id', rule: 'must be a positive integer' };
    throw err;
  }

  const row = await photocardRepo.getPhotoCardById(id);
  if (!row) {
    const err = new Error('NOT_FOUND');
    err.status = 404;
    err.meta = { photoCardId: id };
    throw err;
  }

  return mapRow(row);
}

async function getPhotoCardImage(photoCardId) {
  const id = Number(photoCardId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { field: 'id', rule: 'must be a positive integer' };
    throw err;
  }

  const row = await photocardRepo.getPhotoCardImageById(id);
  if (!row) {
    const err = new Error('NOT_FOUND');
    err.status = 404;
    err.meta = { photoCardId: id };
    throw err;
  }
  if (!row.image_data) {
    const err = new Error('IMAGE_NOT_FOUND');
    err.status = 404;
    err.meta = { photoCardId: id };
    throw err;
  }

  return {
    data: row.image_data,
    mime: row.image_mime || 'application/octet-stream',
  };
}

async function updatePhotoCard(photoCardId, creatorUserId, patch) {
  const id = Number(photoCardId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { field: 'id', rule: 'must be a positive integer' };
    throw err;
  }
  if (!Number.isInteger(creatorUserId) || creatorUserId <= 0) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { field: 'creatorUserId', rule: 'must be a positive integer' };
    throw err;
  }

  const existing = await photocardRepo.getPhotoCardById(id);
  if (!existing) {
    const err = new Error('NOT_FOUND');
    err.status = 404;
    err.meta = { photoCardId: id };
    throw err;
  }
  if (Number(existing.creator_user_id) !== creatorUserId) {
    const err = new Error('FORBIDDEN');
    err.status = 403;
    err.meta = { reason: 'NOT_OWNER' };
    throw err;
  }

  const nextPatch = {};

  if (patch?.name !== undefined) {
    const name = String(patch.name || '').trim();
    if (!name) {
      const err = new Error('VALIDATION_ERROR');
      err.status = 400;
      err.meta = { field: 'name', rule: 'cannot be empty' };
      throw err;
    }
    nextPatch.name = name;
  }

  if (patch?.description !== undefined) {
    nextPatch.description =
      patch.description == null ? null : String(patch.description);
  }

  if (patch?.genre !== undefined) {
    const genre = normalizeGenre(patch.genre);
    if (!genre) {
      const err = new Error('VALIDATION_ERROR');
      err.status = 400;
      err.meta = { field: 'genre', rule: 'cannot be empty' };
      throw err;
    }
    assertAllowedGenre(genre);
    nextPatch.genre = genre;
  }

  if (patch?.grade !== undefined) {
    const grade = normalizeGrade(patch.grade);
    if (!grade) {
      const err = new Error('VALIDATION_ERROR');
      err.status = 400;
      err.meta = { field: 'grade', rule: 'cannot be empty' };
      throw err;
    }
    assertAllowedGrade(grade);
    nextPatch.grade = grade;
  }

  if (patch?.minPrice !== undefined) {
    const minPrice = Number(patch.minPrice);
    if (!Number.isFinite(minPrice) || minPrice < 0) {
      const err = new Error('VALIDATION_ERROR');
      err.status = 400;
      err.meta = { field: 'minPrice', rule: 'must be a non-negative number' };
      throw err;
    }
    nextPatch.minPrice = minPrice;
  }

  if (patch?.totalSupply !== undefined) {
    const totalSupply = Number(patch.totalSupply);
    if (!Number.isFinite(totalSupply) || totalSupply <= 0) {
      const err = new Error('VALIDATION_ERROR');
      err.status = 400;
      err.meta = { field: 'totalSupply', rule: 'must be a positive number' };
      throw err;
    }
    nextPatch.totalSupply = totalSupply;
  }

  if (patch?.imageFile !== undefined || patch?.imageUrl !== undefined) {
    const image = parseImageInput(patch.imageFile, patch.imageUrl);
    if (!image) {
      const err = new Error('VALIDATION_ERROR');
      err.status = 400;
      err.meta = { field: 'file', rule: 'png/jpeg/webp image required' };
      throw err;
    }
    nextPatch.imageData = image.data;
    nextPatch.imageMime = image.mime;
    nextPatch.imageHash = image.hash;
    nextPatch.imageUrl = photocardImageUrl(id);
  }

  if (Object.keys(nextPatch).length === 0) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { message: 'no fields to update' };
    throw err;
  }

  const affected = await photocardRepo.updatePhotoCardById(id, nextPatch);
  if (!affected) {
    const err = new Error('UPDATE_FAILED');
    err.status = 500;
    throw err;
  }

  const updated = await photocardRepo.getPhotoCardById(id);
  return mapRow(updated);
}

// =========================
// ✅ MyGallery: User Cards (Paged + Filters + Counts)
// =========================
async function listUserPhotoCards(userId, opts = {}) {
  if (!Number.isInteger(userId) || userId <= 0) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { field: 'userId', rule: 'must be a positive integer' };
    throw err;
  }

  const page = Math.max(1, Number(opts.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(opts.pageSize || 15)));

  const search = String(opts.search || '').trim();
  const gradeRaw = String(opts.grade || 'ALL').trim();
  const genreRaw = String(opts.genre || 'ALL').trim();
  const grade = !gradeRaw || gradeRaw.toUpperCase() === 'ALL' ? 'ALL' : normalizeGrade(gradeRaw);
  const genre = !genreRaw || genreRaw.toUpperCase() === 'ALL' ? 'ALL' : normalizeGenre(genreRaw);

  const rows = await findPagedByUserId({
    userId,
    page,
    pageSize,
    search: search || null,
    grade,
    genre,
  });
  const items = rows.map(mapUserCardRow);

  const totalItems = await countByUserIdFiltered({
    userId,
    search: search || null,
    grade,
    genre,
  });

  const gradeRows = await countGradesByUserId(userId);
  const counts = buildCounts(gradeRows);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    items,
    counts,
    pageInfo: { page, pageSize, totalItems, totalPages },
  };
}

// =========================
// (옵션) create + user_card 같이 생성하는 기존 함수 유지
// =========================
export async function createPhotoCardWithUserCard(creatorUserId, payload) {
  const data = await createPhotoCard(creatorUserId, payload);
  return {
    photoCardId: data.photoCardId,
    createdUserId: creatorUserId,
    quantity: Number(payload?.totalSupply),
    imageUrl: data.imageUrl,
  };
}

export default {
  createPhotoCard,
  listPhotoCards,
  getPhotoCardById,
  getPhotoCardImage,
  updatePhotoCard,
  listUserPhotoCards,
};
