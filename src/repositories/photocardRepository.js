import { pool } from "../db/mysql.js";

async function countMonthlyByCreatorUserId(creatorUserId, from, to) {
    const sql = `
    SELECT COUNT(*) AS cnt
    FROM photo_card
    WHERE creator_user_id = ?
      AND reg_date >= ?
      AND reg_date < ?
  `;
    const [rows] = await pool.query(sql, [creatorUserId, from, to]);
    return Number(rows[0]?.cnt || 0);
}

async function createPhotoCard({
    creatorUserId,
    name,
    description,
    genre,
    grade,
    minPrice,
    totalSupply,
    imageUrl,
}) {
    const sql = `
    INSERT INTO photo_card
      (creator_user_id, name, description, genre, grade, min_price, total_supply, image_url)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
  `;
    const [result] = await pool.query(sql, [
        creatorUserId,
        name,
        description ?? null,
        genre,
        grade,
        minPrice ?? 0,
        totalSupply,
        imageUrl,
    ]);

    return result.insertId;
}

async function listPhotoCards({ limit, cursor }) {
    const baseSql = `
    SELECT
      photo_card_id,
      creator_user_id,
      name,
      description,
      genre,
      grade,
      min_price,
      total_supply,
      image_url,
      reg_date,
      upt_date
    FROM photo_card
  `;

    if (cursor != null) {
        const sql = `${baseSql}
    WHERE photo_card_id < ?
    ORDER BY photo_card_id DESC
    LIMIT ?
    `;
        const [rows] = await pool.query(sql, [cursor, limit]);
        return rows;
    }

    const sql = `${baseSql}
    ORDER BY photo_card_id DESC
    LIMIT ?
    `;
    const [rows] = await pool.query(sql, [limit]);
    return rows;
}

async function getPhotoCardById(photoCardId) {
    const sql = `
    SELECT
      photo_card_id,
      creator_user_id,
      name,
      description,
      genre,
      grade,
      min_price,
      total_supply,
      image_url,
      reg_date,
      upt_date
    FROM photo_card
    WHERE photo_card_id = ?
    LIMIT 1
  `;
    const [rows] = await pool.query(sql, [photoCardId]);
    return rows[0] ?? null;
}

async function updatePhotoCardById(photoCardId, patch) {
    const fields = [];
    const params = [];

    if (patch.name !== undefined) {
        fields.push("name = ?");
        params.push(patch.name);
    }
    if (patch.description !== undefined) {
        fields.push("description = ?");
        params.push(patch.description);
    }
    if (patch.genre !== undefined) {
        fields.push("genre = ?");
        params.push(patch.genre);
    }
    if (patch.grade !== undefined) {
        fields.push("grade = ?");
        params.push(patch.grade);
    }
    if (patch.minPrice !== undefined) {
        fields.push("min_price = ?");
        params.push(patch.minPrice);
    }
    if (patch.totalSupply !== undefined) {
        fields.push("total_supply = ?");
        params.push(patch.totalSupply);
    }
    if (patch.imageUrl !== undefined) {
        fields.push("image_url = ?");
        params.push(patch.imageUrl);
    }

    if (fields.length === 0) {
        return 0;
    }

    // upt_date는 변경 시점으로 갱신
    const sql = `
    UPDATE photo_card
    SET ${fields.join(", ")}, upt_date = NOW()
    WHERE photo_card_id = ?
    `;
    const [result] = await pool.query(sql, [...params, photoCardId]);
    return result.affectedRows;
}

// 동일한 포토카드 찾기 (name, description, genre, grade, min_price, image_url로 검색)
async function findDuplicatePhotoCard({ name, description, genre, grade, minPrice, imageUrl }) {
    const sql = `
        SELECT photo_card_id, total_supply
        FROM photo_card
        WHERE name = ?
          AND (description = ? OR (description IS NULL AND ? IS NULL))
          AND genre = ?
          AND grade = ?
          AND min_price = ?
          AND image_url = ?
        LIMIT 1
    `;
    const [rows] = await pool.query(sql, [name, description, description, genre, grade, minPrice, imageUrl]);
    return rows[0] ?? null;
}

// total_supply 증가
async function incrementTotalSupply(photoCardId, increment = 1) {
    const sql = `
        UPDATE photo_card
        SET total_supply = total_supply + ?, upt_date = NOW()
        WHERE photo_card_id = ?
    `;
    const [result] = await pool.query(sql, [increment, photoCardId]);
    return result.affectedRows;
}

// total_supply를 지정된 값으로 업데이트
async function updateTotalSupply(photoCardId, totalSupply) {
    const sql = `
        UPDATE photo_card
        SET total_supply = ?, upt_date = NOW()
        WHERE photo_card_id = ?
    `;
    const [result] = await pool.query(sql, [totalSupply, photoCardId]);
    return result.affectedRows;
}

async function createPhotocard({ card_name, card_type, description }) {
    const query = `INSERT INTO photocard (card_name, card_type, description, created_at) VALUES (?, ?, ?, NOW())`;
    const params = [card_name, card_type, description];
    const [result] = await db.query(query, params);
    return result.insertId;
}

export default {
    countMonthlyByCreatorUserId,
    createPhotoCard,
    listPhotoCards,
    getPhotoCardById,
    updatePhotoCardById,
    createPhotocard,
    findDuplicatePhotoCard,
    incrementTotalSupply,
    updateTotalSupply,
};
