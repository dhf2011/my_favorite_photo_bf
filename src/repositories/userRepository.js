import { pool } from "../db/mysql.js";

/**
 * user table (use backticks in SQL: `user` - MySQL reserved word).
 * Schema: user_id (PK), email, nickname, password_hash, points, reg_date, upt_date
 * Rows returned with user_id aliased as id for service layer compatibility.
 */

async function findById(id) {
  const sql = `
    SELECT
      user_id AS id,
      email,
      nickname,
      password_hash,
      points,
      reg_date,
      upt_date
    FROM \`user\`
    WHERE user_id = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [id]);
  return rows[0] ?? null;
}

async function findByEmail(email) {
  const sql = `
    SELECT
      user_id AS id,
      email,
      nickname,
      password_hash,
      points,
      reg_date,
      upt_date
    FROM \`user\`
    WHERE email = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [email]);
  return rows[0] ?? null;
}

async function findByNickname(nickname) {
  const sql = `
    SELECT
      user_id AS id,
      email,
      nickname,
      password_hash,
      points,
      reg_date,
      upt_date
    FROM \`user\`
    WHERE nickname = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(sql, [nickname]);
  return rows[0] ?? null;
}

async function save(user) {
  const { email, nickname, password_hash } = user;
  const sql = `
    INSERT INTO \`user\`
      (email, nickname, password_hash)
    VALUES
      (?, ?, ?)
  `;
  const [result] = await pool.query(sql, [email, nickname, password_hash ?? null]);
  const inserted = await findById(result.insertId);
  return inserted;
}

async function update(id, data) {
  const allowed = ["email", "nickname", "password_hash"];
  const keys = Object.keys(data).filter((k) => allowed.includes(k));
  if (keys.length === 0) return findById(id);

  const setClause = keys.map((k) => `\`${k}\` = ?`).join(", ");
  const values = keys.map((k) => data[k]);
  const sql = `
    UPDATE \`user\`
    SET ${setClause}
    WHERE user_id = ?
  `;
  await pool.query(sql, [...values, id]);
  return findById(id);
}

async function createOrUpdate(provider, providerId, email, name) {
  const existing = await findByEmail(email);
  if (existing) {
    return update(existing.id, { email, nickname: name ?? existing.nickname });
  }
  return save({
    email,
    nickname: name ?? email.split("@")[0],
    password_hash: null,
  });
}

async function findAll() {
  const sql = `
    SELECT
      user_id AS id,
      email,
      nickname,
      password_hash,
      points,
      reg_date,
      upt_date
    FROM \`user\`
    ORDER BY user_id ASC
  `;
  const [rows] = await pool.query(sql);
  return rows;
}

export default {
  findById,
  findByEmail,
  findByNickname,
  save,
  update,
  createOrUpdate,
  findAll,
};
