import multer from "multer";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    const err = new Error("UNSUPPORTED_FILE_TYPE");
    err.status = 400;
    err.meta = { allowed: Array.from(ALLOWED_MIME) };
    return cb(err, false);
  }
  return cb(null, true);
}

export const photocardImageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("file");

export const photocardCreateUpload = photocardImageUpload;

export async function uploadPhotocardImage(req, res, next) {
  try {
    const err = new Error("이미지는 포토카드 등록 요청의 file 필드로 보내 DB에 저장합니다.");
    err.status = 400;
    err.meta = { use: "POST /api/photo-cards", field: "file" };
    throw err;
  } catch (err) {
    return next(err);
  }
}
