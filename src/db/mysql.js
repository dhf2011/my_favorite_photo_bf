import mysql from "mysql2/promise";

function required(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env: ${name}`);
    return value;
}

export const pool = mysql.createPool({
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
    host: required("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: required("DB_USER"),
    password: process.env.DB_PASSWORD ?? "",
    database: required("DB_NAME"),
    charset: "utf8mb4",
});
