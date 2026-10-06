"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "@/components/ui";

/**
 * 완전 삭제 버튼 (이슈 #30).
 * 확인 창에 '삭제'를 입력해야 실제 삭제가 실행된다.
 */
export function HardDeleteButton({
  url,
  targetName,
  warning,
}: {
  /** DELETE 요청을 보낼 API 경로 */
  url: string;
  /** 삭제 대상 이름 (확인 메시지에 표시) */
  targetName: string;
  /** 추가 경고 문구 */
  warning?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setError(null);
    const typed = window.prompt(
      `"${targetName}"을(를) 완전 삭제합니다. 이 작업은 되돌릴 수 없습니다.${warning ? `\n${warning}` : ""}\n\n계속하려면 아래에 "삭제"를 입력하세요.`,
    );
    if (typed === null) return;
    if (typed.trim() !== "삭제") {
      setError('"삭제"를 정확히 입력해야 완전 삭제됩니다.');
      return;
    }
    setLoading(true);
    const res = await api.del(url);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="danger" onClick={onDelete} disabled={loading}>
        {loading ? "삭제 중..." : "완전 삭제"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
