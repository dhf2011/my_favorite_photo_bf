import { pool } from "../db/mysql.js";
import pointHistoryRepo from "../repositories/pointHistoryRepository.js";
import pointBoxDrawRepo from "../repositories/pointBoxDrawRepository.js";
import notificationRepo from "../repositories/notificationRepository.js";

// 포인트 차감/증가 (트랜잭션 처리)
async function updateUserPoints(userId, amount, type, refEntityType = null, refEntityId = null) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // 1. 포인트 내역 생성
    const pointHistoryId = await pointHistoryRepo.createPointHistory({
      userId,
      amount,
      type,
      refEntityType,
      refEntityId,
    });

    // 2. 유저 포인트 업데이트
    const updateSql = `
      UPDATE user
      SET points = points + ?, upt_date = NOW()
      WHERE user_id = ?
    `;
    const [updateResult] = await connection.query(updateSql, [amount, userId]);

    if (updateResult.affectedRows === 0) {
      throw new Error("유저를 찾을 수 없습니다.");
    }

    // 3. 업데이트된 포인트 조회
    const [userRows] = await connection.query(
      "SELECT points FROM user WHERE user_id = ?",
      [userId]
    );

    await connection.commit();

    return {
      pointHistoryId,
      newBalance: userRows[0].points,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 포인트 뽑기 (1시간 제한 체크 포함, 트랜잭션으로 연속 뽑기 방지)
async function drawPointBox(userId) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // 1. 최근 뽑기 기록 확인 (SELECT FOR UPDATE로 잠금)
    const lastDraw = await pointBoxDrawRepo.getLastDrawByUserIdForUpdate(userId, connection);
    
    // 2. 1시간 제한 체크 - 1시간이 지나지 않으면 포인트를 주지 않음
    if (lastDraw) {
      // 데이터베이스에서 계산한 초 단위 차이 사용 (더 정확함)
      const secondsSinceLastDraw = lastDraw.seconds_since_last_draw || 0;
      const oneHourInSeconds = 60 * 60; // 정확히 1시간 (3600초)

      // 1시간이 지나지 않았으면 포인트를 주지 않고 에러 반환
      if (secondsSinceLastDraw < oneHourInSeconds) {
        await connection.rollback();
        const remainingSeconds = oneHourInSeconds - secondsSinceLastDraw;
        const remainingMinutes = Math.floor(remainingSeconds / 60);
        const remainingSecs = remainingSeconds % 60;
        
        let message = "";
        if (remainingMinutes > 0 && remainingSecs > 0) {
          message += `${remainingMinutes}분 ${remainingSecs}초 후 시도해주세요.`;
        } else if (remainingMinutes > 0) {
          message += `${remainingMinutes}분 후 시도해주세요.`;
        } else {
          message += `${remainingSecs}초 후 시도해주세요.`;
        }
        
        const error = new Error(message);
        error.status = 429; // Too Many Requests
        throw error;
      }
    }

    // 3. 1시간이 지났거나 첫 뽑기인 경우에만 포인트 지급 진행

    // 4. 랜덤 포인트 생성 (1 이상의 값) - 1시간이 지난 경우에만 실행됨
    const earnedPoints = Math.floor(Math.random() * 10) + 1; // 1~10 포인트

    // 5. 포인트 내역 생성 (트랜잭션 내에서)
    const pointHistoryId = await pointHistoryRepo.createPointHistory({
      userId,
      amount: earnedPoints,
      type: "POINT_BOX_DRAW",
      refEntityType: "POINT_BOX_DRAW",
      refEntityId: null,
    }, connection);

    // 6. 유저 포인트 업데이트 (트랜잭션 내에서)
    const updateSql = `
      UPDATE user
      SET points = points + ?, upt_date = NOW()
      WHERE user_id = ?
    `;
    const [updateResult] = await connection.query(updateSql, [earnedPoints, userId]);

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      const error = new Error("유저를 찾을 수 없습니다.");
      error.status = 404;
      throw error;
    }

    // 7. 포인트 뽑기 기록 생성 (트랜잭션 내에서)
    const drawId = await pointBoxDrawRepo.createPointBoxDraw({
      userId,
      pointHistoryId,
      earnedPoints,
    }, connection);

    // 8. 업데이트된 포인트 조회
    const [userRows] = await connection.query(
      "SELECT points FROM user WHERE user_id = ?",
      [userId]
    );

    await connection.commit();

    // 알림: 랜덤포인트뽑기 결과
    await notificationRepo.create({
      userId,
      type: "POINT_BOX_DRAW",
      entityType: "POINT_BOX_DRAW",
      entityId: drawId,
    });

    return {
      drawId,
      earnedPoints,
      newBalance: userRows[0].points,
      pointHistoryId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// 포인트 내역 조회
async function getPointHistory(userId, { limit = 50, offset = 0 } = {}) {
  if (!userId) {
    const error = new Error("유저 ID가 필요합니다.");
    error.status = 400;
    throw error;
  }

  return await pointHistoryRepo.getPointHistoryByUserId(userId, { limit, offset });
}

// 포인트 뽑기 내역 조회
async function getDrawHistory(userId, { limit = 50, offset = 0 } = {}) {
  if (!userId) {
    const error = new Error("유저 ID가 필요합니다.");
    error.status = 400;
    throw error;
  }

  return await pointBoxDrawRepo.getDrawHistoryByUserId(userId, { limit, offset });
}

// 유저 포인트 조회
async function getUserPoints(userId) {
  if (!userId) {
    const error = new Error("유저 ID가 필요합니다.");
    error.status = 400;
    throw error;
  }

  const [rows] = await pool.query(
    "SELECT user_id, points FROM user WHERE user_id = ?",
    [userId]
  );

  if (rows.length === 0) {
    const error = new Error("유저를 찾을 수 없습니다.");
    error.status = 404;
    throw error;
  }

  return {
    userId: rows[0].user_id,
    points: rows[0].points,
  };
}

export default {
  updateUserPoints,
  drawPointBox,
  getPointHistory,
  getDrawHistory,
  getUserPoints,
};
