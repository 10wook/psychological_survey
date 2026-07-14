// 클라이언트 컴포넌트용 fetch 래퍼.
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}
export interface ApiFailure {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json()) as ApiResult<T>;
    return json;
  } catch {
    return {
      ok: false,
      error: { code: "NETWORK", message: "네트워크 오류가 발생했습니다." },
    };
  }
}

export const api = {
  get: <T>(url: string) => apiFetch<T>(url),
  post: <T>(url: string, body?: unknown) =>
    apiFetch<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body?: unknown) =>
    apiFetch<T>(url, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) =>
    apiFetch<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(url: string) => apiFetch<T>(url, { method: "DELETE" }),
};
