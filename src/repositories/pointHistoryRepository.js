import { pool } from "../db/mysql.js";

// 포인트 내역 생성
async function createPointHistory({
  userId,
  amount,
  type,
  refEntityType,
  refEntityId,
}, connection = null) {
  const sql = `
    INSERT INTO point_history
      (user_id, amount, type, ref_entity_type, ref_entity_id)
    VALUES
      (?, ?, ?, ?, ?)
  `;
  const queryFn = connection ? connection.query.bind(connection) : pool.query.bind(pool);
  const [result] = await queryFn(sql, [
    userId,
    amount,
    type,
    refEntityType,
    refEntityId,
  ]);
  return result.insertId;
}

// 유저의 포인트 내역 조회
async function getPointHistoryByUserId(userId, { limit = 50, offset = 0 } = {}) {
  const sql = `
    SELECT 
      point_history_id,
      user_id,
      amount,
      type,
      ref_entity_type,
      ref_entity_id,
      reg_date
    FROM point_history
    WHERE user_id = ?
    ORDER BY reg_date DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(sql, [userId, limit, offset]);
  return rows;
}

// 포인트 내역 ID로 조회
async function getPointHistoryById(pointHistoryId) {
  const sql = `
    SELECT *
    FROM point_history
    WHERE point_history_id = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [pointHistoryId]);
  return rows[0] ?? null;
}

export default {
  createPointHistory,
  getPointHistoryByUserId,
  getPointHistoryById,
};
