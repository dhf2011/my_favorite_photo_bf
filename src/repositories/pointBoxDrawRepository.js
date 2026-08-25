import { pool } from "../db/mysql.js";

// 포인트 뽑기 생성
async function createPointBoxDraw({ userId, pointHistoryId, earnedPoints }, connection = null) {
  const sql = `
    INSERT INTO point_box_draw
      (user_id, point_history_id, earned_points)
    VALUES
      (?, ?, ?)
  `;
  const queryFn = connection ? connection.query.bind(connection) : pool.query.bind(pool);
  const [result] = await queryFn(sql, [userId, pointHistoryId, earnedPoints]);
  return result.insertId;
}

// 유저의 최근 포인트 뽑기 조회 (1시간 제한 체크용)
async function getLastDrawByUserId(userId) {
  const sql = `
    SELECT *
    FROM point_box_draw
    WHERE user_id = ?
    ORDER BY reg_date DESC
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [userId]);
  return rows[0] ?? null;
}

// 유저의 최근 포인트 뽑기 조회 (트랜잭션용, SELECT FOR UPDATE)
async function getLastDrawByUserIdForUpdate(userId, connection) {
  // MySQL에서 직접 시간 비교를 수행하여 더 정확하게 체크
  const sql = `
    SELECT 
      *,
      TIMESTAMPDIFF(SECOND, reg_date, NOW()) as seconds_since_last_draw
    FROM point_box_draw
    WHERE user_id = ?
    ORDER BY reg_date DESC
    LIMIT 1
    FOR UPDATE
  `;
  const [rows] = await connection.query(sql, [userId]);
  return rows[0] ?? null;
}

// 유저의 포인트 뽑기 목록 조회
async function getDrawHistoryByUserId(userId, { limit = 50, offset = 0 } = {}) {
  const sql = `
    SELECT 
      pbd.point_box_draw_id,
      pbd.user_id,
      pbd.point_history_id,
      pbd.earned_points,
      pbd.reg_date,
      ph.amount,
      ph.type
    FROM point_box_draw pbd
    JOIN point_history ph ON pbd.point_history_id = ph.point_history_id
    WHERE pbd.user_id = ?
    ORDER BY pbd.reg_date DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(sql, [userId, limit, offset]);
  return rows;
}

// 모든 포인트 뽑기 조회 (관리자용)
async function findAll() {
  const sql = `
    SELECT 
      pbd.point_box_draw_id,
      pbd.user_id,
      pbd.point_history_id,
      pbd.earned_points,
      pbd.reg_date,
      ph.amount,
      ph.type,
      u.nickname
    FROM point_box_draw pbd
    JOIN point_history ph ON pbd.point_history_id = ph.point_history_id
    JOIN user u ON pbd.user_id = u.user_id
    ORDER BY pbd.reg_date DESC
  `;
  const [rows] = await pool.query(sql);
  return rows;
}

export default {
  createPointBoxDraw,
  getLastDrawByUserId,
  getLastDrawByUserIdForUpdate,
  getDrawHistoryByUserId,
  findAll,
};
