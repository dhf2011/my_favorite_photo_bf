import pointService from "../services/pointService.js";
import pointBoxDrawService from "../services/pointBoxDrawService.js";

// 포인트 뽑기
export async function draw(req, res, next) {
    try {
        const userId = req.user?.user_id || req.body.userId;
        
        if (!userId) {
            return res.status(400).json({
                ok: false,
                error: "유저 ID가 필요합니다.",
            });
        }

        const result = await pointService.drawPointBox(userId);
        return res.json({
            ok: true,
            data: result,
        });
    } catch (err) {
        return next(err);
    }
}

// 포인트 뽑기 내역 조회
export async function getDrawHistory(req, res, next) {
    try {
        const userId = req.user?.user_id || req.params.userId || req.query.userId;
        
        if (!userId) {
            return res.status(400).json({
                ok: false,
                error: "유저 ID가 필요합니다.",
            });
        }

        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const data = await pointService.getDrawHistory(userId, { limit, offset });
        return res.json({
            ok: true,
            data,
        });
    } catch (err) {
        return next(err);
    }
}

// 포인트 뽑기 목록 조회 (관리자용)
export async function list(req, res, next) {
    try {
        const data = await pointBoxDrawService.getAll();
        return res.json({ ok: true, data });
    } catch (err) {
        return next(err);
    }
}

// 포인트 내역 조회
export async function getPointHistory(req, res, next) {
    try {
        const userId = req.user?.user_id || req.params.userId || req.query.userId;
        
        if (!userId) {
            return res.status(400).json({
                ok: false,
                error: "유저 ID가 필요합니다.",
            });
        }

        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const data = await pointService.getPointHistory(userId, { limit, offset });
        return res.json({
            ok: true,
            data,
        });
    } catch (err) {
        return next(err);
    }
}

// 유저 포인트 조회
export async function getUserPoints(req, res, next) {
    try {
        const userId = req.user?.user_id || req.params.userId || req.query.userId;
        
        if (!userId) {
            return res.status(400).json({
                ok: false,
                error: "유저 ID가 필요합니다.",
            });
        }

        const data = await pointService.getUserPoints(userId);
        return res.json({
            ok: true,
            data,
        });
    } catch (err) {
        return next(err);
    }
}
