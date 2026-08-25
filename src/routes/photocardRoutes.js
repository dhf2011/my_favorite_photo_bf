import express from "express";
import { create, get, list, update, listUserCards } from "../controllers/photocardController.js";
import { photocardCreateUpload } from "../controllers/uploadController.js";

const router = express.Router();

router.get("/", list);
router.get("/users/:userId", listUserCards);
router.get("/:id", get);
router.patch("/:id", update);
router.post("/", photocardCreateUpload, create);

export default router;
