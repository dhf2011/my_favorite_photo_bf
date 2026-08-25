import { pool } from "../db/mysql.js";
import purchaseRepo from "../repositories/purchaseRepository.js";
import pointHistoryRepo from "../repositories/pointHistoryRepository.js";
import notificationRepo from "../repositories/notificationRepository.js";

/**
 * 카드 구매 (포인트 결제)
 * - 리스팅 조회 및 검증
 * - 구매자 포인트 확인 (없으면 거래 불가)
 * - 포인트 차감/증가, user_card 이전, listing 수량 감소, purchase 기록
 */
async function purchaseCard(buyerUserId, listingId, quantity) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const listingRes = await conn.query(
      `SELECT
        l.listing_id,
        l.user_card_id,
        l.seller_user_id,
        l.sale_type,
        l.status,
        l.quantity AS listing_quantity,
        l.price_per_unit,
        uc.user_id AS seller_user_id,
        uc.photo_card_id,
        uc.quantity AS user_card_quantity,
        pc.creator_user_id
      FROM listing l
      JOIN user_card uc ON l.user_card_id = uc.user_card_id
      JOIN photo_card pc ON uc.photo_card_id = pc.photo_card_id
      WHERE l.listing_id = ?
      FOR UPDATE`,
      [listingId]
    );
    const row = listingRes[0]?.[0];
    if (!row) {
      await conn.rollback();
      const e = new Error("리스팅을 찾을 수 없습니다.");
      e.status = 404;
      throw e;
    }

    if (row.status !== "ACTIVE") {
      await conn.rollback();
      const e = new Error("판매 중인 리스팅이 아닙니다.");
      e.status = 400;
      throw e;
    }
    const saleType = (row.sale_type || "").toUpperCase();
    if (saleType !== "SELL" && saleType !== "SELL_OR_EXCHANGE") {
      await conn.rollback();
      const e = new Error("구매할 수 없는 리스팅입니다.");
      e.status = 400;
      throw e;
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      await conn.rollback();
      const e = new Error("구매 수량은 1 이상이어야 합니다.");
      e.status = 400;
      throw e;
    }
    if (qty > row.listing_quantity) {
      await conn.rollback();
      const e = new Error(`구매 가능 수량 초과 (가능: ${row.listing_quantity})`);
      e.status = 400;
      throw e;
    }

    const unitPrice = Number(row.price_per_unit);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      await conn.rollback();
      const e = new Error("가격 정보가 올바르지 않습니다.");
      e.status = 400;
      throw e;
    }
    const totalPrice = qty * unitPrice;

    const [buyerRows] = await conn.query(
      "SELECT points FROM user WHERE user_id = ? FOR UPDATE",
      [buyerUserId]
    );
    if (!buyerRows?.length) {
      await conn.rollback();
      const e = new Error("구매자를 찾을 수 없습니다.");
      e.status = 404;
      throw e;
    }
    const buyerPoints = Number(buyerRows[0].points) ?? 0;
    if (buyerPoints <= 0) {
      await conn.rollback();
      const e = new Error("포인트가 없어 구매할 수 없습니다.");
      e.status = 400;
      throw e;
    }
    if (buyerPoints < totalPrice) {
      await conn.rollback();
      const e = new Error(`포인트 부족 (필요: ${totalPrice}, 보유: ${buyerPoints})`);
      e.status = 400;
      throw e;
    }

    const [upd] = await conn.query(
      "UPDATE user SET points = points - ?, upt_date = NOW() WHERE user_id = ? AND points >= ?",
      [totalPrice, buyerUserId, totalPrice]
    );
    if (upd.affectedRows === 0) {
      await conn.rollback();
      const e = new Error("포인트가 부족하여 구매할 수 없습니다.");
      e.status = 400;
      throw e;
    }

    await conn.query(
      "UPDATE user SET points = points + ?, upt_date = NOW() WHERE user_id = ?",
      [totalPrice, row.seller_user_id]
    );

    const buyPhId = await pointHistoryRepo.createPointHistory(
      {
        userId: buyerUserId,
        amount: -totalPrice,
        type: "PURCHASE",
        refEntityType: "PURCHASE",
        refEntityId: null,
      },
      conn
    );
    const sellPhId = await pointHistoryRepo.createPointHistory(
      {
        userId: row.seller_user_id,
        amount: totalPrice,
        type: "SELL",
        refEntityType: "PURCHASE",
        refEntityId: null,
      },
      conn
    );

    await conn.query(
      "UPDATE user_card SET quantity = quantity - ?, upt_date = NOW() WHERE user_card_id = ?",
      [qty, row.user_card_id]
    );

    await conn.query(
      `INSERT INTO user_card (user_id, photo_card_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), upt_date = NOW()`,
      [buyerUserId, row.photo_card_id, qty]
    );

    const newQty = row.listing_quantity - qty;
    const status = newQty === 0 ? "SOLD_OUT" : "ACTIVE";
    await conn.query(
      "UPDATE listing SET quantity = ?, status = ?, upt_date = NOW() WHERE listing_id = ?",
      [newQty, status, listingId]
    );

    const purchaseId = await purchaseRepo.createPurchase(
      {
        buyerUserId,
        listingId,
        quantity: qty,
        unitPrice,
        totalPrice,
      },
      conn
    );

    await conn.query(
      "UPDATE point_history SET ref_entity_id = ? WHERE point_history_id IN (?, ?)",
      [purchaseId, buyPhId, sellPhId]
    );

    await conn.commit();

    // 알림: 구매자(구매 완료), 판매자(카드 판매)
    await notificationRepo.create({
      userId: buyerUserId,
      type: "PURCHASE_COMPLETED",
      entityType: "PURCHASE",
      entityId: purchaseId,
    });
    await notificationRepo.create({
      userId: row.seller_user_id,
      type: "SALE_COMPLETED",
      entityType: "PURCHASE",
      entityId: purchaseId,
    });

    const purchase = await purchaseRepo.getPurchaseById(purchaseId);
    return {
      purchaseId,
      buyerUserId,
      sellerUserId: row.seller_user_id,
      listingId,
      quantity: qty,
      unitPrice,
      totalPrice,
      purchase,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getPurchaseById(purchaseId) {
  if (!purchaseId) {
    const e = new Error("구매 ID가 필요합니다.");
    e.status = 400;
    throw e;
  }
  const p = await purchaseRepo.getPurchaseById(purchaseId);
  if (!p) {
    const e = new Error("구매 내역을 찾을 수 없습니다.");
    e.status = 404;
    throw e;
  }
  return p;
}

async function getPurchasesByBuyer(buyerUserId, { limit = 50, offset = 0 } = {}) {
  if (!buyerUserId) {
    const e = new Error("구매자 ID가 필요합니다.");
    e.status = 400;
    throw e;
  }
  return purchaseRepo.getPurchasesByBuyerId(buyerUserId, { limit, offset });
}

async function getPurchasesBySeller(sellerUserId, { limit = 50, offset = 0 } = {}) {
  if (!sellerUserId) {
    const e = new Error("판매자 ID가 필요합니다.");
    e.status = 400;
    throw e;
  }
  return purchaseRepo.getPurchasesBySellerId(sellerUserId, { limit, offset });
}

export default {
  purchaseCard,
  getPurchaseById,
  getPurchasesByBuyer,
  getPurchasesBySeller,
};
