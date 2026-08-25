import "dotenv/config";
import app from "./app.js";
import { pool } from "./db/mysql.js";

async function connectDb() {
  const conn = await pool.getConnection();
  conn.release();
}

async function start() {
  const port = process.env.PORT ?? 3000;

  try {
    await connectDb();
    console.log("DB 연결 성공");

    app.listen(port, "0.0.0.0", () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (err) {
    console.error("DB 연결 실패", err);
    process.exit(1);
  }
}

start();

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
