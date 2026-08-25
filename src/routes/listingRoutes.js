import express from "express";
import { create, list, get, update, cancel } from "../controllers/listingController.js";

const router = express.Router();

router.get("/", list);
router.get("/:id", get);
router.post("/", create);
router.patch("/:id", update);
router.delete("/:id", cancel);

export default router;
