import express from "express";
import {
	photocardImageUpload,
	uploadPhotocardImage,
} from "../controllers/uploadController.js";

const router = express.Router();

router.post("/photocards", photocardImageUpload, uploadPhotocardImage);

export default router;
