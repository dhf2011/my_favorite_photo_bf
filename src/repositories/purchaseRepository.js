import { pool } from "../db/mysql.js";

/**
 * 구매 기록 생성 (ERD: 구매)
 * schema: buyer_user_id, listing_id, quantity, unit_price, total_price
 */
async function createPurchase(
  { buyerUserId, listingId, quantity, unitPrice, totalPrice },
  connection = null
) {
  const sql = `
    INSERT INTO purchase
      (buyer_user_id, listing_id, quantity, unit_price, total_price)
    VALUES
      (?, ?, ?, ?, ?)
  `;
  const q = connection ? connection.query.bind(connection) : pool.query.bind(pool);
  const [r] = await q(sql, [buyerUserId, listingId, quantity, unitPrice, totalPrice]);
  return r.insertId;
}

/**
 * 구매 ID로 조회 (listing → user_card, photo_card JOIN)
 */
async function getPurchaseById(purchaseId) {
  const sql = `
    SELECT
      p.purchase_id,
      p.buyer_user_id,
      p.listing_id,
      p.quantity,
      p.unit_price,
      p.total_price,
      p.reg_date,
      l.seller_user_id AS user_id,
      l.user_card_id,
      uc.photo_card_id,
      pc.creator_user_id,
      pc.name,
      pc.image_url,
      pc.genre,
      pc.grade
    FROM purchase p
    JOIN listing l ON p.listing_id = l.listing_id
    JOIN user_card uc ON l.user_card_id = uc.user_card_id
    JOIN photo_card pc ON uc.photo_card_id = pc.photo_card_id
    WHERE p.purchase_id = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [purchaseId]);
  return rows[0] ?? null;
}

/**
 * 구매자별 구매 내역 (카드 구매 API)
 */
async function getPurchasesByBuyerId(buyerUserId, { limit = 50, offset = 0 } = {}) {
  const sql = `
    SELECT
      p.purchase_id,
      p.buyer_user_id,
      p.listing_id,
      p.quantity,
      p.unit_price,
      p.total_price,
      p.reg_date,
      l.seller_user_id,
      l.user_card_id,
      uc.photo_card_id,
      pc.creator_user_id,
      pc.name,
      pc.image_url,
      pc.genre,
      pc.grade
    FROM purchase p
    JOIN listing l ON p.listing_id = l.listing_id
    JOIN user_card uc ON l.user_card_id = uc.user_card_id
    JOIN photo_card pc ON uc.photo_card_id = pc.photo_card_id
    WHERE p.buyer_user_id = ?
    ORDER BY p.reg_date DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(sql, [buyerUserId, limit, offset]);
  return rows;
}

/**
 * 판매자별 판매 내역 (카드 판매 API)
 */
async function getPurchasesBySellerId(sellerUserId, { limit = 50, offset = 0 } = {}) {
  const sql = `
    SELECT
      p.purchase_id,
      p.buyer_user_id,
      p.listing_id,
      p.quantity,
      p.unit_price,
      p.total_price,
      p.reg_date,
      l.seller_user_id,
      l.user_card_id,
      uc.photo_card_id,
      pc.creator_user_id,
      pc.name,
      pc.image_url,
      pc.genre,
      pc.grade
    FROM purchase p
    JOIN listing l ON p.listing_id = l.listing_id
    JOIN user_card uc ON l.user_card_id = uc.user_card_id
    JOIN photo_card pc ON uc.photo_card_id = pc.photo_card_id
    WHERE l.seller_user_id = ?
    ORDER BY p.reg_date DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(sql, [sellerUserId, limit, offset]);
  return rows;
}

export default {
  createPurchase,
  getPurchaseById,
  getPurchasesByBuyerId,
  getPurchasesBySellerId,
};
