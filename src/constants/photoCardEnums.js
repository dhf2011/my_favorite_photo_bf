export const ALLOWED_GRADES = new Set(['common', 'rare', 'superrare', 'legendary']);
export const ALLOWED_GRADE_LABELS = ['COMMON', 'RARE', 'SUPER RARE', 'LEGENDARY'];

export const ALLOWED_GENRES = new Set(['풍경', '음식', '인물', '동물']);

export function normalizeGrade(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

export function normalizeGenre(value) {
  return String(value ?? '').trim();
}

export function assertAllowedGrade(grade) {
  if (!ALLOWED_GRADES.has(grade)) {
    const err = new Error('INVALID_GRADE');
    err.status = 400;
    err.meta = { allowed: ALLOWED_GRADE_LABELS };
    throw err;
  }
}

export function assertAllowedGenre(genre) {
  if (!ALLOWED_GENRES.has(genre)) {
    const err = new Error('INVALID_GENRE');
    err.status = 400;
    err.meta = { allowed: Array.from(ALLOWED_GENRES) };
    throw err;
  }
}
