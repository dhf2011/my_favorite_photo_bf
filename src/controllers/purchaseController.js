import purchaseService from "../services/purchaseService.js";

/**
 * 카드 구매 (포인트 결제)
 * POST body: { buyerUserId, listingId, quantity }
 */
export async function purchase(req, res, next) {
  try {
    const buyerUserId = req.user?.user_id ?? req.body?.buyerUserId;
    const listingId = req.body?.listingId;
    const quantity = req.body?.quantity;

    if (buyerUserId == null || buyerUserId === "") {
      return res.status(400).json({ ok: false, error: "구매자 ID가 필요합니다." });
    }
    if (listingId == null || listingId === "") {
      return res.status(400).json({ ok: false, error: "리스팅 ID가 필요합니다." });
    }
    if (quantity == null || quantity === "") {
      return res.status(400).json({ ok: false, error: "구매 수량이 필요합니다." });
    }

    const data = await purchaseService.purchaseCard(
      Number(buyerUserId),
      Number(listingId),
      Number(quantity)
    );
    return res.status(201).json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}

/**
 * 구매 내역 조회 (구매자) - 카드 구매 API
 */
export async function listByBuyer(req, res, next) {
  try {
    const buyerUserId = req.user?.user_id ?? req.params.buyerUserId ?? req.query.buyerUserId;
    if (!buyerUserId) {
      return res.status(400).json({ ok: false, error: "구매자 ID가 필요합니다." });
    }
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const data = await purchaseService.getPurchasesByBuyer(buyerUserId, { limit, offset });
    return res.json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}

/**
 * 판매 내역 조회 (판매자) - 카드 판매 API
 */
export async function listBySeller(req, res, next) {
  try {
    const sellerUserId = req.user?.user_id ?? req.params.sellerUserId ?? req.query.sellerUserId;
    if (!sellerUserId) {
      return res.status(400).json({ ok: false, error: "판매자 ID가 필요합니다." });
    }
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const data = await purchaseService.getPurchasesBySeller(sellerUserId, { limit, offset });
    return res.json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}

/**
 * 구매 상세 조회
 */
export async function getById(req, res, next) {
  try {
    const purchaseId = req.params.purchaseId;
    if (!purchaseId) {
      return res.status(400).json({ ok: false, error: "구매 ID가 필요합니다." });
    }
    const data = await purchaseService.getPurchaseById(purchaseId);
    return res.json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}
