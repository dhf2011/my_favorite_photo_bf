/**
 * Sell-card controller: POST /api/sell (auth required).
 * req.userId is set by requireAuth middleware.
 */

import sellCardService from "../services/sellCardService.js";

export async function create(req, res, next) {
    try {
        const sellerUserId = Number(req.userId);
        const userCardId = req.body?.userCardId != null ? Number(req.body.userCardId) : null;
        const quantity = req.body?.quantity != null ? Number(req.body.quantity) : null;
        const pricePerUnit = req.body?.pricePerUnit != null ? Number(req.body.pricePerUnit) : null;
        const desiredGrade = req.body?.desired_grade != null ? String(req.body.desired_grade).trim() || null : null;
        const desiredGenre = req.body?.desired_genre != null ? String(req.body.desired_genre).trim() || null : null;
        const desiredDesc = req.body?.desired_desc != null ? String(req.body.desired_desc).trim() || null : null;

        const data = await sellCardService.createSellListing(sellerUserId, {
            userCardId,
            quantity,
            pricePerUnit,
            desiredGrade,
            desiredGenre,
            desiredDesc,
        });
        return res.status(201).json({ ok: true, data });
    } catch (err) {
        return next(err);
    }
}
