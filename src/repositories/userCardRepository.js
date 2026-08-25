import { pool } from '../db/mysql.js';

export async function createUserCard({
  ownerId,
  photocardId,
  quantity,
  userId,
}) {
  const finalUserId = ownerId || userId;

  const sql = `
    INSERT INTO user_card
      (user_id, photo_card_id, quantity)
    VALUES
      (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      quantity = quantity + VALUES(quantity),
      upt_date = NOW()
  `;

  const [result] = await pool.query(sql, [finalUserId, photocardId, quantity]);
  return result.insertId;
}

export async function getUserCard(userId, photoCardId) {
  const sql = `
    SELECT * FROM user_card
    WHERE user_id = ? AND photo_card_id = ?
  `;
  const [rows] = await pool.query(sql, [userId, photoCardId]);
  return rows[0] || null;
}

export async function findAllByUserId(userId) {
  const sql = `
    SELECT 
      uc.user_card_id,
      uc.user_id,
      uc.quantity,
      uc.reg_date as acquired_date,
      pc.photo_card_id,
      pc.name,
      pc.description,
      pc.genre,
      pc.grade,
      pc.min_price,
      pc.image_url,
      pc.creator_user_id
    FROM user_card uc
    JOIN photo_card pc ON uc.photo_card_id = pc.photo_card_id
    WHERE uc.user_id = ?
    ORDER BY uc.reg_date DESC
  `;
  const [rows] = await pool.query(sql, [userId]);
  return rows;
}

// ✅ 페이지+필터 목록
export async function findPagedByUserId({
  userId,
  page,
  pageSize,
  search,
  grade,
  genre,
}) {
  const where = ['uc.user_id = ?'];
  const params = [userId];

  if (search) {
    where.push('(pc.name LIKE ? OR pc.description LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like);
  }

  if (grade && grade !== 'ALL') {
    where.push('pc.grade = ?');
    params.push(String(grade).trim().toLowerCase()); // DB는 소문자 기준
  }

  if (genre && genre !== 'ALL') {
    where.push('pc.genre = ?');
    params.push(String(genre).trim());
  }

  const safePage = Math.max(1, Number(page || 1));
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize || 15)));
  const offset = (safePage - 1) * safePageSize;

  const sql = `
    SELECT 
      uc.user_card_id,
      uc.user_id,
      uc.quantity,
      uc.reg_date as acquired_date,
      pc.photo_card_id,
      pc.name,
      pc.description,
      pc.genre,
      pc.grade,
      pc.min_price,
      pc.image_url,
      pc.creator_user_id
    FROM user_card uc
    JOIN photo_card pc ON uc.photo_card_id = pc.photo_card_id
    WHERE ${where.join(' AND ')}
    ORDER BY uc.reg_date DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query(sql, [...params, safePageSize, offset]);
  return rows;
}

// ✅ 필터 결과 totalItems
export async function countByUserIdFiltered({ userId, search, grade, genre }) {
  const where = ['uc.user_id = ?'];
  const params = [userId];

  if (search) {
    where.push('(pc.name LIKE ? OR pc.description LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like);
  }

  if (grade && grade !== 'ALL') {
    where.push('pc.grade = ?');
    params.push(String(grade).trim().toLowerCase());
  }

  if (genre && genre !== 'ALL') {
    where.push('pc.genre = ?');
    params.push(String(genre).trim());
  }

  const sql = `
    SELECT COUNT(*) as cnt
    FROM user_card uc
    JOIN photo_card pc ON uc.photo_card_id = pc.photo_card_id
    WHERE ${where.join(' AND ')}
  `;

  const [rows] = await pool.query(sql, params);
  return Number(rows[0]?.cnt || 0);
}

// ✅ 등급별 보유 개수(counts) (필터 없이 전체 보유 기준)
export async function countGradesByUserId(userId) {
  const sql = `
    SELECT pc.grade as grade, COALESCE(SUM(uc.quantity),0) as qty
    FROM user_card uc
    JOIN photo_card pc ON uc.photo_card_id = pc.photo_card_id
    WHERE uc.user_id = ?
    GROUP BY pc.grade
  `;
  const [rows] = await pool.query(sql, [userId]);
  return rows;
}

export async function getTotalQuantityByPhotoCardId(photoCardId) {
  const sql = `
    SELECT COALESCE(SUM(quantity), 0) as total_quantity
    FROM user_card
    WHERE photo_card_id = ?
  `;
  const [rows] = await pool.query(sql, [photoCardId]);
  return Number(rows[0]?.total_quantity || 0);
}
