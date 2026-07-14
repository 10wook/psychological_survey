import { randomBytes } from "node:crypto";

// 추측하기 어려운 설문 공개 ID (문서 5.9)
export function generatePublicId(): string {
  return randomBytes(6).toString("hex"); // 12 hex chars
}

// 익명 응답자 코드 R-000012 형식 (문서 5.11)
export function formatAnonymousCode(seq: number): string {
  return `R-${String(seq).padStart(6, "0")}`;
}
