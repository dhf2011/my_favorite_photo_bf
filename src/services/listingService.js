import listingRepo from "../repositories/listingRepository.js";

// 리스팅 생성
async function createListing(sellerUserId, payload) {
    if (!Number.isInteger(sellerUserId) || sellerUserId <= 0) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "sellerUserId", rule: "must be a positive integer" };
        throw err;
    }

    const userCardId = Number(payload?.userCardId);
    if (!Number.isInteger(userCardId) || userCardId <= 0) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "userCardId", rule: "must be a positive integer" };
        throw err;
    }

    const quantity = Number(payload?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "quantity", rule: "must be a positive integer" };
        throw err;
    }

    const pricePerUnit = Number(payload?.pricePerUnit);
    if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "pricePerUnit", rule: "must be a positive number" };
        throw err;
    }

    // user_card 존재 및 소유권 확인
    const userCard = await listingRepo.getUserCardById(userCardId);
    if (!userCard) {
        const err = new Error("NOT_FOUND");
        err.status = 404;
        err.meta = { message: "user_card not found" };
        throw err;
    }

    if (Number(userCard.user_id) !== sellerUserId) {
        const err = new Error("FORBIDDEN");
        err.status = 403;
        err.meta = { reason: "NOT_OWNER" };
        throw err;
    }

    // 발행량 이내인지 확인
    if (quantity > userCard.quantity) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = {
            field: "quantity",
            rule: `cannot exceed owned quantity (${userCard.quantity})`,
        };
        throw err;
    }

    // 이미 활성 리스팅이 있는지 확인
    const existingListing = await listingRepo.getActiveListingByUserCardId(userCardId);
    if (existingListing) {
        const err = new Error("CONFLICT");
        err.status = 409;
        err.meta = { message: "Active listing already exists for this user_card" };
        throw err;
    }

    const desiredGrade = payload?.desiredGrade != null ? String(payload.desiredGrade).trim() || null : null;
    const desiredGenre = payload?.desiredGenre != null ? String(payload.desiredGenre).trim() || null : null;
    const desiredDesc = payload?.desiredDesc != null ? String(payload.desiredDesc).trim() || null : null;

    const listingId = await listingRepo.createListing({
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

    const listing = await listingRepo.getListingById(listingId);
    return mapRow(listing);
}

// 리스팅 목록 조회 (전체 판매 목록)
async function listListings({ limit = 20, cursor = null, sortBy = "reg_date", sortOrder = "DESC", status = "ACTIVE", grade = null, genre = null } = {}) {
    const parsedLimit = Math.min(Number(limit) || 20, 50);
    const parsedCursor = cursor != null ? Number(cursor) : null;

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "limit", rule: "must be a positive integer" };
        throw err;
    }

    if (parsedCursor != null && (!Number.isInteger(parsedCursor) || parsedCursor <= 0)) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "cursor", rule: "must be a positive integer" };
        throw err;
    }

    // 정렬 옵션 검증
    const allowedSortFields = ["reg_date", "price"];
    if (!allowedSortFields.includes(sortBy)) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "sortBy", rule: `must be one of: ${allowedSortFields.join(", ")}` };
        throw err;
    }

    const allowedSortOrders = ["ASC", "DESC"];
    if (!allowedSortOrders.includes(sortOrder.toUpperCase())) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "sortOrder", rule: `must be one of: ${allowedSortOrders.join(", ")}` };
        throw err;
    }

    const rows = await listingRepo.listListings({
        limit: parsedLimit,
        cursor: parsedCursor,
        sortBy,
        sortOrder: sortOrder.toUpperCase(),
        status,
        grade: grade ?? null,
        genre: genre ?? null,
    });

    const items = rows.map(mapRow);
    const nextCursor = items.length ? items[items.length - 1].listingId : null;

    return { items, nextCursor };
}

// 로그인한 유저(판매자)의 리스팅 목록 (판매 중인 카드 등)
async function listListingsBySellerId(sellerUserId, opts = {}) {
    if (!Number.isInteger(sellerUserId) || sellerUserId <= 0) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "sellerUserId", rule: "must be a positive integer" };
        throw err;
    }

    const limit = Math.min(Number(opts.limit) || 20, 50);
    const cursor = opts.cursor != null ? Number(opts.cursor) : null;
    const sortBy = opts.sortBy || "reg_date";
    const sortOrder = (opts.sortOrder || "DESC").toUpperCase();
    const status = opts.status ?? "ACTIVE";
    const grade = opts.grade ?? null;
    const genre = opts.genre ?? null;

    const rows = await listingRepo.listListingsBySellerId(sellerUserId, {
        limit,
        cursor,
        sortBy,
        sortOrder,
        status,
        grade,
        genre,
    });

    const items = rows.map(mapRow);
    const nextCursor = items.length ? items[items.length - 1].listingId : null;

    return { items, nextCursor };
}

// 리스팅 상세 조회
async function getListingById(listingId) {
    const id = Number(listingId);
    if (!Number.isInteger(id) || id <= 0) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "id", rule: "must be a positive integer" };
        throw err;
    }

    const row = await listingRepo.getListingById(id);
    if (!row) {
        const err = new Error("NOT_FOUND");
        err.status = 404;
        err.meta = { listingId: id };
        throw err;
    }

    return mapRow(row);
}

// 리스팅 수정
async function updateListing(listingId, sellerUserId, patch) {
    const id = Number(listingId);
    if (!Number.isInteger(id) || id <= 0) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "id", rule: "must be a positive integer" };
        throw err;
    }

    if (!Number.isInteger(sellerUserId) || sellerUserId <= 0) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "sellerUserId", rule: "must be a positive integer" };
        throw err;
    }

    const existing = await listingRepo.getListingById(id);
    if (!existing) {
        const err = new Error("NOT_FOUND");
        err.status = 404;
        err.meta = { listingId: id };
        throw err;
    }

    if (Number(existing.seller_user_id) !== sellerUserId) {
        const err = new Error("FORBIDDEN");
        err.status = 403;
        err.meta = { reason: "NOT_OWNER" };
        throw err;
    }

    const nextPatch = {};

    if (patch?.quantity !== undefined) {
        const quantity = Number(patch.quantity);
        if (!Number.isInteger(quantity) || quantity < 0) {
            const err = new Error("VALIDATION_ERROR");
            err.status = 400;
            err.meta = { field: "quantity", rule: "must be a non-negative integer" };
            throw err;
        }

        // user_card의 quantity 확인
        const userCard = await listingRepo.getUserCardById(existing.user_card_id);
        if (quantity > userCard.quantity) {
            const err = new Error("VALIDATION_ERROR");
            err.status = 400;
            err.meta = {
                field: "quantity",
                rule: `cannot exceed owned quantity (${userCard.quantity})`,
            };
            throw err;
        }

        nextPatch.quantity = quantity;

        // quantity가 0이면 SOLD_OUT으로 변경
        if (quantity === 0) {
            nextPatch.status = "SOLD_OUT";
        }
    }

    if (patch?.pricePerUnit !== undefined) {
        const pricePerUnit = Number(patch.pricePerUnit);
        if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
            const err = new Error("VALIDATION_ERROR");
            err.status = 400;
            err.meta = { field: "pricePerUnit", rule: "must be a positive number" };
            throw err;
        }
        nextPatch.pricePerUnit = pricePerUnit;
    }

    if (Object.keys(nextPatch).length === 0) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { message: "no fields to update" };
        throw err;
    }

    const affected = await listingRepo.updateListing(id, nextPatch);
    if (!affected) {
        const err = new Error("UPDATE_FAILED");
        err.status = 500;
        throw err;
    }

    const updated = await listingRepo.getListingById(id);
    return mapRow(updated);
}

// 리스팅 취소
async function cancelListing(listingId, sellerUserId) {
    const id = Number(listingId);
    if (!Number.isInteger(id) || id <= 0) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "id", rule: "must be a positive integer" };
        throw err;
    }

    if (!Number.isInteger(sellerUserId) || sellerUserId <= 0) {
        const err = new Error("VALIDATION_ERROR");
        err.status = 400;
        err.meta = { field: "sellerUserId", rule: "must be a positive integer" };
        throw err;
    }

    const existing = await listingRepo.getListingById(id);
    if (!existing) {
        const err = new Error("NOT_FOUND");
        err.status = 404;
        err.meta = { listingId: id };
        throw err;
    }

    if (Number(existing.seller_user_id) !== sellerUserId) {
        const err = new Error("FORBIDDEN");
        err.status = 403;
        err.meta = { reason: "NOT_OWNER" };
        throw err;
    }

    const affected = await listingRepo.deleteListing(id);
    if (!affected) {
        const err = new Error("DELETE_FAILED");
        err.status = 500;
        throw err;
    }

    return { success: true };
}

// DB row를 응답 형식으로 변환
function mapRow(row) {
    if (!row) return null;

    return {
        listingId: Number(row.listing_id),
        userCardId: Number(row.user_card_id),
        sellerUserId: Number(row.seller_user_id),
        sellerNickname: row.seller_nickname ?? null,
        saleType: row.sale_type,
        status: row.status,
        quantity: Number(row.quantity),
        pricePerUnit: row.price_per_unit ? Number(row.price_per_unit) : null,
        desiredGrade: row.desired_grade,
        desiredGenre: row.desired_genre,
        desiredDesc: row.desired_desc,
        regDate: row.reg_date,
        uptDate: row.upt_date,
        // 포토카드 정보
        photoCard: {
            photoCardId: Number(row.photo_card_id),
            name: row.name,
            description: row.description,
            genre: row.genre,
            grade: row.grade,
            minPrice: Number(row.min_price),
            imageUrl: row.image_url,
            creatorUserId: Number(row.creator_user_id),
        },
    };
}

export default {
    createListing,
    listListings,
    listListingsBySellerId,
    getListingById,
    updateListing,
    cancelListing,
};
