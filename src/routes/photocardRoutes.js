import express from "express";
import { create, get, getImage, list, update, listUserCards } from "../controllers/photocardController.js";
import { photocardCreateUpload } from "../controllers/uploadController.js";

const router = express.Router();

router.get("/", list);
router.get("/users/:userId", listUserCards);
router.get("/:id/image", getImage);
router.get("/:id", get);
router.patch("/:id", photocardCreateUpload, update);
router.post("/", photocardCreateUpload, create);

export default router;
