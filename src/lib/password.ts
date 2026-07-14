import bcrypt from "bcryptjs";

// 문서 9.1: 비밀번호 평문 저장 금지. bcrypt 사용.
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** 비밀번호 정책: 8자 이상, 영문/숫자 포함 */
export function isPasswordStrong(pw: string): boolean {
  return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}
