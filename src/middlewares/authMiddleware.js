import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_COOKIE_NAME = "token";

/**
 * Reads JWT from cookie, verifies it, sets req.userId.
 * On invalid/missing token calls next with 401.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[JWT_COOKIE_NAME];
  if (!token) {
    const err = new Error("인증이 필요합니다.");
    err.status = 401;
    return next(err);
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    const err = new Error("인증이 필요합니다.");
    err.status = 401;
    return next(err);
  }
}
