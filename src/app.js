import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import path from "path";

import errorHandler from "./middlewares/errorHandler.js";
import userRoutes from "./routes/userRoutes.js";
import photocardRoutes from "./routes/photocardRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import listingRoutes from "./routes/listingRoutes.js";
import sellRoutes from "./routes/sellRoutes.js";
import pointBoxDrawRoutes from "./routes/pointBoxDrawRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";


const app = express();

// 미들웨어
app.use(express.json());
app.use(cookieParser());
// credentials 사용 시 origin은 * 불가 → 구체적 출처 지정
app.use(
  cors({
    origin: true,        // 요청 들어온 origin 그대로 허용
    credentials: true,   // 쿠키 허용
  })
);

app.options('*', cors());
app.use(morgan("dev"));

// 로컬 업로드 파일 정적 서빙
app.use("/public", express.static(path.join(process.cwd(), "public")));

// 라우터
app.use("/users", userRoutes);
app.use("/api/photo-cards", photocardRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/sell", sellRoutes);
app.use("/api/point-box-draws", pointBoxDrawRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/notifications", notificationRoutes);

// 에러 핸들러
app.use(errorHandler);

export default app;