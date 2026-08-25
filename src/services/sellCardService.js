/**
 * Sell-card service: "포토카드 판매하기" flow.
 * Creates one listing row; delegates to listingService for validation and insert.
 */

import listingService from "./listingService.js";

/**
 * Create a sell listing for the given user card.
 * Validates ownership, quantity, and no duplicate active listing via listingService.
 * @param {number} sellerUserId - Logged-in user (from auth).
 * @param {{ userCardId: number, quantity: number, pricePerUnit: number }} payload
 * @returns {Promise<object>} Created listing (same shape as listingService.createListing).
 */
async function createSellListing(sellerUserId, payload) {
    return listingService.createListing(sellerUserId, {
        userCardId: payload.userCardId,
        quantity: payload.quantity,
        pricePerUnit: payload.pricePerUnit,
        desiredGrade: payload.desiredGrade,
        desiredGenre: payload.desiredGenre,
        desiredDesc: payload.desiredDesc,
    });
}

export default {
    createSellListing,
};
