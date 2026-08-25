import { pool } from "../db/mysql.js";

// 리스팅 생성
async function createListing({
    userCardId,
    sellerUserId,
    saleType,
    status,
    quantity,
    pricePerUnit,
    desiredGrade = null,
    desiredGenre = null,
    desiredDesc = null,
}) {
    const sql = `
        INSERT INTO listing
            (user_card_id, seller_user_id, sale_type, status, quantity, price_per_unit, desired_grade, desired_genre, desired_desc)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [
        userCardId,
        sellerUserId,
        saleType,
        status,
        quantity,
        pricePerUnit,
        desiredGrade ?? null,
        desiredGenre ?? null,
        desiredDesc ?? null,
    ]);
    return result.insertId;
}

// 리스팅 ID로 조회
async function getListingById(listingId) {
    const sql = `
        SELECT
            l.listing_id,
            l.user_card_id,
            l.seller_user_id,
            l.sale_type,
            l.status,
            l.quantity,
            l.price_per_unit,
            NULL AS desired_grade,
            NULL AS desired_genre,
            NULL AS desired_desc,
            l.reg_date,
            l.upt_date,
            uc.photo_card_id,
            pc.name,
            pc.description,
            pc.genre,
            pc.grade,
            pc.min_price,
            pc.image_url,
            pc.creator_user_id,
            u.nickname AS seller_nickname
        FROM listing l
        JOIN user_card uc ON l.user_card_id = uc.user_card_id
        JOIN photo_card pc ON uc.photo_card_id = pc.photo_card_id
        LEFT JOIN \`user\` u ON l.seller_user_id = u.user_id
        WHERE l.listing_id = ?
        LIMIT 1
    `;
    const [rows] = await pool.query(sql, [listingId]);
    return rows[0] ?? null;
}

// 리스팅 목록 조회 (필터링 및 정렬) - 전체 판매 목록
async function listListings({
    limit,
    cursor,
    sortBy = "reg_date",
    sortOrder = "DESC",
    status = "ACTIVE",
    grade = null,
    genre = null,
}) {
    // 정렬 필드 검증
    const allowedSortFields = {
        reg_date: "l.reg_date",
        price: "l.price_per_unit",
    };
    const sortField = allowedSortFields[sortBy] || allowedSortFields.reg_date;
    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // status 필터
    const statusFilter = status ? "AND l.status = ?" : "";
    const statusParam = status ? [status] : [];
    const gradeFilter = grade ? "AND pc.grade = ?" : "";
    const gradeParam = grade ? [String(grade).trim().toLowerCase()] : [];
    const genreFilter = genre ? "AND pc.genre = ?" : "";
    const genreParam = genre ? [String(genre).trim()] : [];

    let sql = `
        SELECT
            l.listing_id,
            l.user_card_id,
            l.seller_user_id,
            l.sale_type,
            l.status,
            l.quantity,
            l.price_per_unit,
            NULL AS desired_grade,
            NULL AS desired_genre,
            NULL AS desired_desc,
            l.reg_date,
            l.upt_date,
            uc.photo_card_id,
            pc.name,
            pc.description,
            pc.genre,
            pc.grade,
            pc.min_price,
            pc.image_url,
            pc.creator_user_id,
            u.nickname AS seller_nickname
        FROM listing l
        JOIN user_card uc ON l.user_card_id = uc.user_card_id
        JOIN photo_card pc ON uc.photo_card_id = pc.photo_card_id
        LEFT JOIN \`user\` u ON l.seller_user_id = u.user_id
        WHERE 1=1
        ${statusFilter}
        ${gradeFilter}
        ${genreFilter}
    `;

    const params = [...statusParam, ...gradeParam, ...genreParam];

    // cursor 기반 페이지네이션 (listing_id를 cursor로 사용)
    if (cursor != null) {
        // cursor가 가리키는 리스팅의 정렬 기준값을 가져와서 비교
        if (sortBy === "reg_date") {
            sql += ` AND (l.reg_date ${order === "DESC" ? "<" : ">"} (SELECT reg_date FROM listing WHERE listing_id = ?)
                    OR (l.reg_date = (SELECT reg_date FROM listing WHERE listing_id = ?) AND l.listing_id < ?))`;
            params.push(cursor, cursor, cursor);
        } else if (sortBy === "price") {
            sql += ` AND (l.price_per_unit ${order === "DESC" ? "<" : ">"} (SELECT price_per_unit FROM listing WHERE listing_id = ?) 
                    OR (l.price_per_unit = (SELECT price_per_unit FROM listing WHERE listing_id = ?) 
                    AND l.listing_id < ?))`;
            params.push(cursor, cursor, cursor);
        } else {
            sql += ` AND l.listing_id < ?`;
            params.push(cursor);
        }
    }

    sql += ` ORDER BY ${sortField} ${order}, l.listing_id DESC LIMIT ?`;
    params.push(limit);

    const [rows] = await pool.query(sql, params);
    return rows;
}

// 판매자(seller_user_id) 기준 리스팅 목록 (로그인한 유저의 판매 중인 카드 등)
async function listListingsBySellerId(sellerUserId, {
    limit = 20,
    cursor = null,
    sortBy = "reg_date",
    sortOrder = "DESC",
    status = "ACTIVE",
    grade = null,
    genre = null,
} = {}) {
    const allowedSortFields = {
        reg_date: "l.reg_date",
        price: "l.price_per_unit",
    };
    const sortField = allowedSortFields[sortBy] || allowedSortFields.reg_date;
    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const statusFilter = status ? "AND l.status = ?" : "";
    const statusParam = status ? [status] : [];
    const gradeFilter = grade ? "AND pc.grade = ?" : "";
    const gradeParam = grade ? [String(grade).trim().toLowerCase()] : [];
    const genreFilter = genre ? "AND pc.genre = ?" : "";
    const genreParam = genre ? [String(genre).trim()] : [];

    let sql = `
        SELECT
            l.listing_id,
            l.user_card_id,
            l.seller_user_id,
            l.sale_type,
            l.status,
            l.quantity,
            l.price_per_unit,
            l.desired_grade,
            l.desired_genre,
            l.desired_desc,
            l.reg_date,
            l.upt_date,
            uc.photo_card_id,
            pc.name,
            pc.description,
            pc.genre,
            pc.grade,
            pc.min_price,
            pc.image_url,
            pc.creator_user_id,
            u.nickname AS seller_nickname
        FROM listing l
        JOIN user_card uc ON l.user_card_id = uc.user_card_id
        JOIN photo_card pc ON uc.photo_card_id = pc.photo_card_id
        LEFT JOIN \`user\` u ON l.seller_user_id = u.user_id
        WHERE l.seller_user_id = ?
        ${statusFilter}
        ${gradeFilter}
        ${genreFilter}
    `;

    const params = [sellerUserId, ...statusParam, ...gradeParam, ...genreParam];

    if (cursor != null) {
        if (sortBy === "reg_date") {
            sql += ` AND (l.reg_date ${order === "DESC" ? "<" : ">"} (SELECT reg_date FROM listing WHERE listing_id = ?)
                    OR (l.reg_date = (SELECT reg_date FROM listing WHERE listing_id = ?) AND l.listing_id < ?))`;
            params.push(cursor, cursor, cursor);
        } else if (sortBy === "price") {
            sql += ` AND (l.price_per_unit ${order === "DESC" ? "<" : ">"} (SELECT price_per_unit FROM listing WHERE listing_id = ?)
                    OR (l.price_per_unit = (SELECT price_per_unit FROM listing WHERE listing_id = ?) AND l.listing_id < ?))`;
            params.push(cursor, cursor, cursor);
        } else {
            sql += ` AND l.listing_id < ?`;
            params.push(cursor);
        }
    }

    sql += ` ORDER BY ${sortField} ${order}, l.listing_id DESC LIMIT ?`;
    params.push(limit);

    const [rows] = await pool.query(sql, params);
    return rows;
}

// 리스팅 수정
async function updateListing(listingId, patch) {
    const fields = [];
    const params = [];

    if (patch.quantity !== undefined) {
        fields.push("quantity = ?");
        params.push(patch.quantity);
    }
    if (patch.pricePerUnit !== undefined) {
        fields.push("price_per_unit = ?");
        params.push(patch.pricePerUnit);
    }
    if (patch.status !== undefined) {
        fields.push("status = ?");
        params.push(patch.status);
    }
    if (patch.saleType !== undefined) {
        fields.push("sale_type = ?");
        params.push(patch.saleType);
    }

    if (fields.length === 0) {
        return 0;
    }

    const sql = `
        UPDATE listing
        SET ${fields.join(", ")}, upt_date = NOW()
        WHERE listing_id = ?
    `;
    const [result] = await pool.query(sql, [...params, listingId]);
    return result.affectedRows;
}

// 리스팅 삭제 (실제 레코드 삭제)
async function deleteListing(listingId) {
    const sql = `
        DELETE FROM listing
        WHERE listing_id = ?
    `;
    const [result] = await pool.query(sql, [listingId]);
    return result.affectedRows;
}

// user_card_id로 리스팅 조회 (중복 등록 방지용)
async function getActiveListingByUserCardId(userCardId) {
    const sql = `
        SELECT *
        FROM listing
        WHERE user_card_id = ? AND status = 'ACTIVE'
        LIMIT 1
    `;
    const [rows] = await pool.query(sql, [userCardId]);
    return rows[0] ?? null;
}

// user_card 정보 조회 (소유권 확인용)
async function getUserCardById(userCardId) {
    const sql = `
        SELECT
            uc.user_card_id,
            uc.user_id,
            uc.quantity,
            uc.photo_card_id,
            pc.total_supply
        FROM user_card uc
        JOIN photo_card pc ON uc.photo_card_id = pc.photo_card_id
        WHERE uc.user_card_id = ?
        LIMIT 1
    `;
    const [rows] = await pool.query(sql, [userCardId]);
    return rows[0] ?? null;
}

export default {
    createListing,
    getListingById,
    listListings,
    listListingsBySellerId,
    updateListing,
    deleteListing,
    getActiveListingByUserCardId,
    getUserCardById,
};
