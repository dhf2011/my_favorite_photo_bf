import express from "express";
import {
    draw,
    getDrawHistory,
    list,
    getPointHistory,
    getUserPoints,
} from "../controllers/pointBoxDrawController.js";

const router = express.Router();

// 포인트 뽑기
router.post("/draw", draw);

// 포인트 뽑기 내역 조회
router.get("/draw-history/:userId", getDrawHistory);
router.get("/draw-history", getDrawHistory);

// 포인트 내역 조회
router.get("/history/:userId", getPointHistory);
router.get("/history", getPointHistory);

// 유저 포인트 조회
router.get("/user/:userId", getUserPoints);
router.get("/user", getUserPoints);

// 포인트 뽑기 목록 조회 (관리자용)
router.get("/", list);

export default router;
