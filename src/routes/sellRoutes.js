import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { create } from "../controllers/sellCardController.js";

const router = express.Router();

router.post("/", requireAuth, create);

export default router;
