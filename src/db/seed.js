import "dotenv/config";
import bcrypt from "bcrypt";
import { pool } from "./mysql.js";

const PASSWORD = "12345678";

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const users = [
      ["test0202@naver.com", "테스터원", passwordHash, 50000],
      ["qwer1234@naver.com", "테스터투", passwordHash, 30000],
      ["seller@test.com", "판매자킴", passwordHash, 80000],
      ["buyer@test.com", "구매자박", passwordHash, 20000],
    ];

    const userIds = [];
    for (const [email, nickname, hash, points] of users) {
      const [existing] = await conn.query(
        "SELECT user_id FROM `user` WHERE email = ? LIMIT 1",
        [email],
      );
      if (existing.length) {
        userIds.push(Number(existing[0].user_id));
        await conn.query("UPDATE `user` SET points = ? WHERE user_id = ?", [
          points,
          existing[0].user_id,
        ]);
      } else {
        const [r] = await conn.query(
          "INSERT INTO `user` (email, nickname, password_hash, points) VALUES (?, ?, ?, ?)",
          [email, nickname, hash, points],
        );
        userIds.push(Number(r.insertId));
      }
    }
    const [u1, u2, u3, u4] = userIds;

    const [oauthExist] = await conn.query(
      "SELECT oauth_account_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ? LIMIT 1",
      ["google", "google-test-user-001"],
    );
    if (!oauthExist.length) {
      await conn.query(
        "INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)",
        [u1, "google", "google-test-user-001"],
      );
    }

    await conn.query(
      "UPDATE photo_card SET grade = 'common' WHERE LOWER(REPLACE(REPLACE(grade, ' ', ''), '_', '')) = 'epic'",
    );
    await conn.query(
      "UPDATE listing SET desired_grade = 'common' WHERE LOWER(REPLACE(REPLACE(IFNULL(desired_grade, ''), ' ', ''), '_', '')) = 'epic'",
    );

    const cards = [
      [u1, "핑크 앨범 포카", "2024 앨범 미공포", "인물", "rare", 10000, 10, "/public/users/1/photocards/seed-album-rare.jpg"],
      [u1, "팬싸 특전 카드", "팬싸인회 특전", "인물", "common", 25000, 5, "/public/users/1/photocards/seed-fansign-epic.jpg"],
      [u2, "콘서트 포토카드", "서울 콘서트 MD", "풍경", "legendary", 50000, 3, "/public/users/2/photocards/seed-concert-legend.jpg"],
      [u2, "시즌그리팅 세트", "2025 시즌그리팅", "음식", "common", 5000, 20, "/public/users/2/photocards/seed-sg-common.jpg"],
      [u3, "콜라보 한정판", "브랜드 콜라보", "풍경", "common", 30000, 8, "/public/users/3/photocards/seed-collab-epic.jpg"],
      [u3, "팬클럽 키트 포카", "공식 팬클럽 키트", "동물", "rare", 12000, 15, "/public/users/3/photocards/seed-fanclub-rare.jpg"],
    ];

    const photoCardIds = [];
    for (const c of cards) {
      const [exist] = await conn.query(
        "SELECT photo_card_id FROM photo_card WHERE creator_user_id = ? AND name = ? LIMIT 1",
        [c[0], c[1]],
      );
      if (exist.length) {
        photoCardIds.push(Number(exist[0].photo_card_id));
        await conn.query(
          `UPDATE photo_card
           SET description = ?, genre = ?, grade = ?, min_price = ?, total_supply = ?, image_url = ?
           WHERE photo_card_id = ?`,
          [c[2], c[3], c[4], c[5], c[6], c[7], exist[0].photo_card_id],
        );
      } else {
        const [r] = await conn.query(
          `INSERT INTO photo_card
            (creator_user_id, name, description, genre, grade, min_price, total_supply, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          c,
        );
        photoCardIds.push(Number(r.insertId));
      }
    }
    const [pc1, pc2, pc3, pc4, pc5, pc6] = photoCardIds;

    async function upsertUserCard(userId, photoCardId, qty) {
      const [exist] = await conn.query(
        "SELECT user_card_id FROM user_card WHERE user_id = ? AND photo_card_id = ? LIMIT 1",
        [userId, photoCardId],
      );
      if (exist.length) {
        await conn.query(
          "UPDATE user_card SET quantity = ? WHERE user_card_id = ?",
          [qty, exist[0].user_card_id],
        );
        return Number(exist[0].user_card_id);
      }
      const [r] = await conn.query(
        "INSERT INTO user_card (user_id, photo_card_id, quantity) VALUES (?, ?, ?)",
        [userId, photoCardId, qty],
      );
      return Number(r.insertId);
    }

    const uc1 = await upsertUserCard(u1, pc1, 6);
    const uc2 = await upsertUserCard(u1, pc2, 3);
    const uc3 = await upsertUserCard(u2, pc3, 2);
    const uc4 = await upsertUserCard(u2, pc4, 12);
    const uc5 = await upsertUserCard(u3, pc5, 5);
    const uc6 = await upsertUserCard(u3, pc6, 8);
    const uc7 = await upsertUserCard(u4, pc1, 2);
    const uc8 = await upsertUserCard(u4, pc4, 4);
    await upsertUserCard(u2, pc2, 1);

    async function upsertListing(userCardId, sellerId, saleType, status, qty, price) {
      const [exist] = await conn.query(
        `SELECT listing_id FROM listing
         WHERE user_card_id = ? AND seller_user_id = ? AND sale_type = ? AND status = ?
         LIMIT 1`,
        [userCardId, sellerId, saleType, status],
      );
      if (exist.length) {
        await conn.query(
          "UPDATE listing SET quantity = ?, price_per_unit = ? WHERE listing_id = ?",
          [qty, price, exist[0].listing_id],
        );
        return Number(exist[0].listing_id);
      }
      const [r] = await conn.query(
        `INSERT INTO listing
          (user_card_id, seller_user_id, sale_type, status, quantity, price_per_unit)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userCardId, sellerId, saleType, status, qty, price],
      );
      return Number(r.insertId);
    }

    const l1 = await upsertListing(uc1, u1, "SELL", "ACTIVE", 2, 12000);
    const l2 = await upsertListing(uc2, u1, "SELL_OR_EXCHANGE", "ACTIVE", 1, 28000);
    const l3 = await upsertListing(uc3, u2, "SELL", "ACTIVE", 1, 55000);
    const l4 = await upsertListing(uc4, u2, "SELL", "SOLD_OUT", 0, 6000);
    const l5 = await upsertListing(uc5, u3, "SELL", "ACTIVE", 3, 32000);
    const l6 = await upsertListing(uc6, u3, "SELL", "SOLD_OUT", 0, 15000);

    const [exExist] = await conn.query(
      "SELECT exchange_offer_id FROM exchange_offer WHERE listing_id = ? AND offer_user_id = ? LIMIT 1",
      [l2, u4],
    );
    if (!exExist.length) {
      await conn.query(
        `INSERT INTO exchange_offer
          (listing_id, seller_user_id, offer_user_id, requested_user_card_id, offered_user_card_id, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [l2, u1, u4, uc2, uc8, "PENDING"],
      );
    }

    const [pExist] = await conn.query(
      "SELECT purchase_id FROM purchase WHERE buyer_user_id = ? AND listing_id = ? LIMIT 1",
      [u4, l4],
    );
    let purchaseId;
    if (pExist.length) {
      purchaseId = Number(pExist[0].purchase_id);
    } else {
      const [r] = await conn.query(
        `INSERT INTO purchase
          (buyer_user_id, listing_id, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?)`,
        [u4, l4, 2, 6000, 12000],
      );
      purchaseId = Number(r.insertId);
    }

    const [pExist2] = await conn.query(
      "SELECT purchase_id FROM purchase WHERE buyer_user_id = ? AND listing_id = ? LIMIT 1",
      [u2, l6],
    );
    if (!pExist2.length) {
      await conn.query(
        `INSERT INTO purchase
          (buyer_user_id, listing_id, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?)`,
        [u2, l6, 1, 15000, 15000],
      );
    }

    async function insertPointIfMissing(userId, amount, type, refType, refId) {
      const [exist] = await conn.query(
        `SELECT point_history_id FROM point_history
         WHERE user_id = ? AND type = ? AND amount = ? AND IFNULL(ref_entity_id, 0) = IFNULL(?, 0)
         LIMIT 1`,
        [userId, type, amount, refId],
      );
      if (exist.length) return Number(exist[0].point_history_id);
      const [r] = await conn.query(
        `INSERT INTO point_history (user_id, amount, type, ref_entity_type, ref_entity_id)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, amount, type, refType, refId],
      );
      return Number(r.insertId);
    }

    await insertPointIfMissing(u1, 10000, "CHARGE", "MANUAL", null);
    const drawPh1 = await insertPointIfMissing(u1, 7, "POINT_BOX_DRAW", "POINT_BOX_DRAW", null);
    await insertPointIfMissing(u2, -15000, "PURCHASE", "PURCHASE", purchaseId);
    await insertPointIfMissing(u3, 15000, "SELL", "PURCHASE", purchaseId);
    const drawPh2 = await insertPointIfMissing(u4, 3, "POINT_BOX_DRAW", "POINT_BOX_DRAW", null);

    const [drawExist1] = await conn.query(
      "SELECT point_box_draw_id FROM point_box_draw WHERE point_history_id = ? LIMIT 1",
      [drawPh1],
    );
    if (!drawExist1.length) {
      await conn.query(
        "INSERT INTO point_box_draw (user_id, point_history_id, earned_points) VALUES (?, ?, ?)",
        [u1, drawPh1, 7],
      );
    }
    const [drawExist2] = await conn.query(
      "SELECT point_box_draw_id FROM point_box_draw WHERE point_history_id = ? LIMIT 1",
      [drawPh2],
    );
    if (!drawExist2.length) {
      await conn.query(
        "INSERT INTO point_box_draw (user_id, point_history_id, earned_points) VALUES (?, ?, ?)",
        [u4, drawPh2, 3],
      );
    }

    const notifs = [
      [u1, "PURCHASE_COMPLETED", "PURCHASE", purchaseId, 0],
      [u1, "POINT_BOX_DRAW", "POINT_BOX_DRAW", drawPh1, 0],
      [u2, "SALE_COMPLETED", "PURCHASE", purchaseId, 1],
      [u3, "SALE_COMPLETED", "PURCHASE", purchaseId, 0],
      [u4, "PURCHASE_COMPLETED", "PURCHASE", purchaseId, 0],
    ];
    for (const [userId, type, entityType, entityId, isRead] of notifs) {
      const [exist] = await conn.query(
        `SELECT notification_id FROM notification
         WHERE user_id = ? AND type = ? AND IFNULL(entity_id, 0) = IFNULL(?, 0)
         LIMIT 1`,
        [userId, type, entityId],
      );
      if (!exist.length) {
        await conn.query(
          `INSERT INTO notification (user_id, type, entity_type, entity_id, is_read)
           VALUES (?, ?, ?, ?, ?)`,
          [userId, type, entityType, entityId, isRead],
        );
      }
    }

    await conn.commit();
    console.log("시드 완료");
    console.log("로그인 비밀번호(공통):", PASSWORD);
    console.log("유저:", {
      test0202: u1,
      qwer1234: u2,
      seller: u3,
      buyer: u4,
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("시드 실패:", err);
  process.exit(1);
});
