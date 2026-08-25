import jwt from "jsonwebtoken";
import axios from "axios";
import userService from "../services/userService.js";
import listingService from "../services/listingService.js";
import { findAllByUserId } from "../repositories/userCardRepository.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_COOKIE_NAME = "token";
const COOKIE_OPTIONS = {
  httpOnly: true,

  secure: process.env.NODE_ENV === "production",
  // SameSite=None required when frontend (Netlify) and backend are on different origins
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",

  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

/**
 * POST /users/login
 * Body: { email, password }
 * On success: set JWT in httpOnly cookie, return { user }
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const user = await userService.login(email, password);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie(JWT_COOKIE_NAME, token, COOKIE_OPTIONS);
    return res.status(200).json({ user });
  } catch (err) {
    err.status = err.status ?? err.code ?? 500;
    next(err);
  }
}

/**
 * GET /users/me
 * Requires cookie with JWT. Returns current user via getUserById.
 */
export async function getMe(req, res, next) {
  try {
    if (!req.userId) {
      return res.status(401).json({
        message: "인증이 필요합니다.",
        redirectTo: `${FRONTEND_URL}/mygallery`,
      });
    }
    const user = await userService.getUserById(req.userId);
    return res.status(200).json({ user });
  } catch (err) {
    err.status = err.status ?? err.code ?? 500;
    next(err);
  }
}

/**
 * GET /users/me/cards
 * Requires cookie with JWT. Returns current user's owned cards (user_card joined with photo_card).
 */
export async function getMyCards(req, res, next) {
  try {
    if (!req.userId) {
      const err = new Error("인증이 필요합니다.");
      err.status = 401;
      return next(err);
    }
    const rows = await findAllByUserId(req.userId);
    return res.status(200).json({ data: rows ?? [] });
  } catch (err) {
    err.status = err.status ?? err.code ?? 500;
    next(err);
  }
}

/**
 * GET /users/me/listings
 * 로그인한 유저가 판매 중인 카드 목록. Cookie 필요.
 * 쿼리: status (ACTIVE | SOLD_OUT), grade (common|rare|epic|legendary), genre (앨범|팬싸|...), sortBy (reg_date|price), sortOrder, limit, cursor
 */
export async function getMyListings(req, res, next) {
  try {
    if (!req.userId) {
      const err = new Error("인증이 필요합니다.");
      err.status = 401;
      return next(err);
    }
    const limit = req.query?.limit;
    const cursor = req.query?.cursor;
    const sortBy = req.query?.sortBy || "reg_date";
    const sortOrder = req.query?.sortOrder || "DESC";
    const status = req.query?.status ?? "ACTIVE";
    const grade = req.query?.grade ?? null;
    const genre = req.query?.genre ?? null;

    const data = await listingService.listListingsBySellerId(req.userId, {
      limit,
      cursor,
      sortBy,
      sortOrder,
      status,
      grade,
      genre,
    });
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    err.status = err.status ?? err.code ?? 500;
    next(err);
  }
}

/**
 * POST /users/logout
 * Clear JWT cookie
 */
export function logout(req, res) {
  res.clearCookie(JWT_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    sameSite: "none",
    secure: true,
    domain: "be-1-yqrf.onrender.com",
  });

  return res.status(200).json({ ok: true, message: "로그아웃되었습니다." });
}

/**
 * GET /users/auth/google
 * Redirect to Google OAuth consent screen
 */
export function getAuthGoogle(req, res, next) {
  if (!GOOGLE_CLIENT_ID) {
    const err = new Error("Google OAuth is not configured.");
    err.status = 503;
    return next(err);
  }
  const baseUrl =
    process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${baseUrl}/users/auth/google/callback`;
  const scope = "openid email profile";
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return res.redirect(url.toString());
}

export async function signup(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    return res.status(201).json({ user });
  } catch (err) {
    err.status = err.status ?? err.code ?? 500;
    next(err);
  }
}

/**
 * GET /users/auth/google/callback?code=...
 * Exchange code for tokens, get userinfo, login/signup, set JWT cookie, redirect to frontend
 */
export async function getAuthGoogleCallback(req, res, next) {
  const { code, error } = req.query;
  if (error) {
    return res.redirect(
      `${FRONTEND_URL}/auth/login?error=${encodeURIComponent(error)}`,
    );
  }
  if (!code || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${FRONTEND_URL}/auth/login?error=invalid_callback`);
  }

  const baseUrl =
    process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${baseUrl}/users/auth/google/callback`;

  try {
    const tokenRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
    const accessToken = tokenRes.data.access_token;

    const userRes = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const profile = userRes.data; // { id, email, name, picture, ... }

    const user = await userService.loginWithGoogle({
      id: profile.id,
      email: profile.email,
      name: profile.name,
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie(JWT_COOKIE_NAME, token, COOKIE_OPTIONS);
    return res.redirect(FRONTEND_URL + "/mygallery");
  } catch (err) {
    console.error(
      "Google OAuth callback error:",
      err?.response?.data ?? err.message,
    );
    const message =
      err.response?.data?.error_description ??
      err.message ??
      "google_login_failed";
    return res.redirect(
      `${FRONTEND_URL}/auth/login?error=${encodeURIComponent(message)}`,
    );
  }
}
