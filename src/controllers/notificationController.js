import notificationService from "../services/notificationService.js";

/**
 * GET /notifications?limit=20
 * 응답: { ok: true, data: { items: [{ id, message, createdAt, isRead }], unreadCount } }
 */
export async function getNotifications(req, res, next) {
  try {
    const userId = req.userId;
    const limit = req.query?.limit;
    const data = await notificationService.getListWithUnreadCount(userId, {
      limit,
    });
    return res.json({ ok: true, data });
  } catch (err) {
    return next(err);
  }
}
