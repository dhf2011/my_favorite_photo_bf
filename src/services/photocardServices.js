// BE/src/services/photocardServices.js
import photocardRepo from '../repositories/photocardRepository.js';
import {
  createUserCard,
  getTotalQuantityByPhotoCardId,
  findPagedByUserId,
  countByUserIdFiltered,
  countGradesByUserId,
} from '../repositories/userCardRepository.js';

const ALLOWED_GRADES = new Set(['common', 'rare', 'superrare', 'legendary']);
const ALLOWED_GENRES = new Set([
  '음식',
  '풍경',
  '동물',
  '인물',
]);

function normalizeGrade(value) {
  const v = String(value ?? '')
    .trim()
    .toLowerCase();
  return v || '';
}

function normalizeGenre(value) {
  const v = String(value ?? '').trim();
  return v || '';
}

function assertAllowedGrade(grade) {
  if (!ALLOWED_GRADES.has(grade)) {
    const err = new Error('INVALID_GRADE');
    err.status = 400;
    err.meta = { allowed: Array.from(ALLOWED_GRADES) };
    throw err;
  }
}

function assertAllowedGenre(genre) {
  if (!ALLOWED_GENRES.has(genre)) {
    const err = new Error('INVALID_GENRE');
    err.status = 400;
    err.meta = { allowed: Array.from(ALLOWED_GENRES) };
    throw err;
  }
}

function normalizeToPath(imageUrl) {
  const raw = String(imageUrl || '').trim();
  if (!raw) return '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      return new URL(raw).pathname;
    } catch {
      return '';
    }
  }
  return raw;
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
    imageUrl: row.image_url,
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
    grade: row.grade, // DB: common/rare/epic/legendary
    minPrice: Number(row.min_price),
    imageUrl: row.image_url,
    creatorUserId: Number(row.creator_user_id),
  };
}

// ✅ counts: DB epic -> FE superRare
function buildCounts(rows) {
  const counts = { total: 0, common: 0, rare: 0, superRare: 0, legendary: 0 };

  for (const r of rows) {
    const g = String(r.grade || '').toLowerCase();
    const qty = Number(r.qty || 0);

    counts.total += qty;

    if (g === 'common') counts.common += qty;
    else if (g === 'rare') counts.rare += qty;
    else if (g === 'epic') counts.superRare += qty;
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

  const imageUrl = (payload?.imageUrl && String(payload.imageUrl).trim()) || '';
  if (!imageUrl) {
    const err = new Error('VALIDATION_ERROR');
    err.status = 400;
    err.meta = { required: ['imageUrl'] };
    throw err;
  }

  const expectedPathPrefix = `/public/users/${creatorUserId}/photocards/`;
  const imagePath = normalizeToPath(imageUrl);
  if (!imagePath.startsWith(expectedPathPrefix)) {
    const err = new Error('INVALID_IMAGE_URL');
    err.status = 400;
    err.meta = { expectedPathPrefix };
    throw err;
  }

  const description = payload?.description ?? null;

  const existing = await photocardRepo.findDuplicatePhotoCard({
    name,
    description,
    genre,
    grade,
    minPrice,
    imageUrl: imagePath,
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
      imageUrl: imagePath,
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

  return { photoCardId: id, imageUrl: imagePath };
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

  if (patch?.imageUrl !== undefined) {
    const raw = (patch.imageUrl && String(patch.imageUrl).trim()) || '';
    if (!raw) {
      const err = new Error('VALIDATION_ERROR');
      err.status = 400;
      err.meta = { field: 'imageUrl', rule: 'cannot be empty' };
      throw err;
    }

    const expectedPathPrefix = `/public/users/${creatorUserId}/photocards/`;
    const imagePath = normalizeToPath(raw);
    if (!imagePath.startsWith(expectedPathPrefix)) {
      const err = new Error('INVALID_IMAGE_URL');
      err.status = 400;
      err.meta = { expectedPathPrefix };
      throw err;
    }

    nextPatch.imageUrl = imagePath;
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
  const grade = String(opts.grade || 'ALL').trim();
  const genre = String(opts.genre || 'ALL').trim();

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
  const name = String(payload?.name || '').trim();
  const genre = normalizeGenre(payload?.genre);
  const grade = normalizeGrade(payload?.grade);
  const description = payload?.description ?? null;
  const minPrice = payload?.minPrice ?? 0;
  const imageUrl = (payload?.imageUrl && String(payload.imageUrl).trim()) || '';
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

  const imagePath = normalizeToPath(imageUrl);

  const existing = await photocardRepo.findDuplicatePhotoCard({
    name,
    description,
    genre,
    grade,
    minPrice,
    imageUrl: imagePath,
  });

  let photoCardId;
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
    photoCardId = existing.photo_card_id;
  } else {
    photoCardId = await photocardRepo.createPhotoCard({
      creatorUserId,
      name,
      description,
      genre,
      grade,
      minPrice,
      totalSupply,
      imageUrl: imagePath,
    });
  }

  await createUserCard({
    ownerId: creatorUserId,
    photocardId: photoCardId,
    createdUserId: creatorUserId,
    quantity: totalSupply,
  });

  const actualTotalSupply = await getTotalQuantityByPhotoCardId(photoCardId);
  await photocardRepo.updateTotalSupply(photoCardId, actualTotalSupply);

  return { photoCardId, createdUserId: creatorUserId, quantity: totalSupply };
}

export default {
  createPhotoCard,
  listPhotoCards,
  getPhotoCardById,
  updatePhotoCard,
  listUserPhotoCards,
};
