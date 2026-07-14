import { NextResponse } from "next/server";
import { ZodError } from "zod";

// 공통 오류 처리 & 응답 헬퍼.
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new ApiError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "로그인이 필요합니다.") =>
  new ApiError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "권한이 없습니다.") =>
  new ApiError(403, "FORBIDDEN", msg);
export const notFound = (msg = "찾을 수 없습니다.") =>
  new ApiError(404, "NOT_FOUND", msg);
export const conflict = (msg: string) => new ApiError(409, "CONFLICT", msg);

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "입력값이 올바르지 않습니다.",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }
  // 프로덕션에서는 상세 오류를 노출하지 않는다. (문서 9.1)
  console.error("[API_ERROR]", error);
  return NextResponse.json(
    { ok: false, error: { code: "INTERNAL", message: "서버 오류가 발생했습니다." } },
    { status: 500 },
  );
}

/** route handler 를 감싸 공통 오류 처리 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (error) {
      return fail(error);
    }
  };
}
