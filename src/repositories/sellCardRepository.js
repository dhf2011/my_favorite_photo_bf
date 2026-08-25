/**
 * Sell-card repository: inserts a listing row for "포토카드 판매하기" flow.
 * Delegates to listingRepository to avoid duplicating listing table logic.
 */

import listingRepository from "./listingRepository.js";

/**
 * Create a sell listing (one row in listing table).
 * @param {{ userCardId: number, sellerUserId: number, quantity: number, pricePerUnit: number, desiredGrade?: string, desiredGenre?: string, desiredDesc?: string }}
 * @returns {Promise<number>} listing_id (insertId)
 */
async function createSellListing({ userCardId, sellerUserId, quantity, pricePerUnit, desiredGrade, desiredGenre, desiredDesc }) {
    return listingRepository.createListing({
        userCardId,
        sellerUserId,
        saleType: "SELL",
        status: "ACTIVE",
        quantity,
        pricePerUnit,
        desiredGrade,
        desiredGenre,
        desiredDesc,
    });
}

export default {
    createSellListing,
};
