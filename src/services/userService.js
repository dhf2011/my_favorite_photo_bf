import bcrypt from "bcrypt";
import userRepository from "../repositories/userRepository.js";

const BCRYPT_ROUNDS = 10;

async function createUser(userData) {
  const { email, nickname, password } = userData;

  // 필수 필드 검증
  if (!email || !nickname) {
    const error = new Error("이메일과 닉네임은 필수입니다.");
    error.code = 400;
    throw error;
  }

  // 이메일 중복 확인
  const existingUserByEmail = await userRepository.findByEmail(email);
  if (existingUserByEmail) {
    const error = new Error("이미 사용 중인 이메일입니다.");
    error.code = 409;
    throw error;
  }

  // 닉네임 중복 확인
  const existingUserByNickname = await userRepository.findByNickname(nickname);
  if (existingUserByNickname) {
    const error = new Error("이미 사용 중인 닉네임입니다.");
    error.code = 409;
    throw error;
  }

  // 비밀번호 bcrypt 해싱
  const password_hash = password
    ? await bcrypt.hash(password, BCRYPT_ROUNDS)
    : null;

  // 유저 생성
  const newUser = await userRepository.save({
    email,
    nickname,
    password_hash,
  });

  // 비밀번호 해시는 응답에서 제외
  delete newUser.password_hash;

  return newUser;
}

async function getUserById(userId) {
  if (!userId) {
    const error = new Error("유저 ID가 필요합니다.");
    error.code = 400;
    throw error;
  }

  const user = await userRepository.findById(userId);

  if (!user) {
    const error = new Error("유저를 찾을 수 없습니다.");
    error.code = 404;
    throw error;
  }

  // 비밀번호 해시는 응답에서 제외
  delete user.password_hash;

  return user;
}

/**
 * 로그인: 이메일로 유저 조회 후 비밀번호 검증, getUserById로 정제된 유저 반환
 */
async function login(email, password) {
  if (!email || !password) {
    const error = new Error("이메일과 비밀번호를 입력해 주세요.");
    error.status = 400;
    throw error;
  }

  const userByEmail = await userRepository.findByEmail(email);
  if (!userByEmail) {
    const error = new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    error.status = 401;
    throw error;
  }

  // 비밀번호 검증 (bcrypt.compare)
  if (!userByEmail.password_hash || !(await bcrypt.compare(password, userByEmail.password_hash))) {
    const err = new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    err.status = 401;
    throw err;
  }

  return getUserById(userByEmail.id);
}

/**
 * Google OAuth: find or create user by email/name, return sanitized user
 */
async function loginWithGoogle(profile) {
  const { id: providerId, email, name } = profile;
  if (!email) {
    const err = new Error("Google 계정에서 이메일을 가져올 수 없습니다.");
    err.status = 400;
    throw err;
  }
  const user = await userRepository.createOrUpdate("google", providerId, email, name ?? email.split("@")[0]);
  const sanitized = await getUserById(user.id);
  return sanitized;
}

async function getAllUsers() {
  const users = await userRepository.findAll();
  
  // 모든 유저의 비밀번호 해시 제외
  return users.map(user => {
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });
}

export default {
  createUser,
  getUserById,
  getAllUsers,
  login,
  loginWithGoogle,
};
