import { pool } from "../db/mysql.js";

/**
 * notification 스키마:
 * notification_id, user_id, type, entity_type, entity_id, is_read, reg_date
 */

/** 알림 생성 */
async function create({ userId, type, entityType = null, entityId = null }) {
  const sql = `
    INSERT INTO notification (user_id, type, entity_type, entity_id, is_read)
    VALUES (?, ?, ?, ?, 0)
  `;
  const [r] = await pool.query(sql, [userId, type, entityType, entityId]);
  return r.insertId;
}

/** 유저별 알림 목록 (최신순) */
async function findByUserId(userId, { limit = 50, offset = 0, isRead = null } = {}) {
  let sql = `
    SELECT notification_id, user_id, type, entity_type, entity_id, is_read, reg_date
    FROM notification
    WHERE user_id = ?
  `;
  const params = [userId];
  if (isRead !== null && isRead !== undefined) {
    sql += " AND is_read = ?";
    params.push(Number(isRead));
  }
  sql += " ORDER BY reg_date DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const [rows] = await pool.query(sql, params);
  return rows;
}

/** 유저별 읽지 않은 알림 개수 */
async function countUnreadByUserId(userId) {
  const sql = `
    SELECT COUNT(*) AS cnt FROM notification WHERE user_id = ? AND is_read = 0
  `;
  const [rows] = await pool.query(sql, [userId]);
  return Number(rows[0]?.cnt ?? 0);
}

export default {
  create,
  findByUserId,
  countUnreadByUserId,
};
