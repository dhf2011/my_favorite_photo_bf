import notificationRepo from "../repositories/notificationRepository.js";

/** type → 노출용 message */
const TYPE_MESSAGE = {
  PURCHASE_COMPLETED: "구매가 완료되었습니다.",
  SALE_COMPLETED: "카드가 판매되었습니다.",
  POINT_BOX_DRAW: "랜덤포인트뽑기 결과가 도착했습니다.",
};

function messageFromType(type) {
  return TYPE_MESSAGE[type] || (type ? `${type} 알림` : "알림");
}

/**
 * GET /notifications 스펙: { items: [{ id, message, createdAt, isRead }], unreadCount }
 */
async function getListWithUnreadCount(userId, { limit = 20 } = {}) {
  if (!userId) {
    const e = new Error("유저 ID가 필요합니다.");
    e.status = 400;
    throw e;
  }
  const parsedLimit = Math.min(Number(limit) || 20, 100);

  const [rows, unreadCount] = await Promise.all([
    notificationRepo.findByUserId(userId, { limit: parsedLimit, offset: 0, isRead: null }),
    notificationRepo.countUnreadByUserId(userId),
  ]);

  const items = rows.map((r) => ({
    id: Number(r.notification_id),
    message: messageFromType(r.type),
    createdAt: r.reg_date,
    isRead: Boolean(r.is_read),
  }));

  return { items, unreadCount };
}

export default {
  getListWithUnreadCount,
};
