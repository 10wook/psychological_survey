"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "@/components/ui";

export function ArchiveImportButton({ scaleId }: { scaleId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importScale() {
    if (
      !window.confirm(
        "이 척도를 내 척도로 가져올까요? 원본과 독립된 복사본이 생성됩니다.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await api.post<{ scale: { id: string } }>(
      `/api/admin/archive/${scaleId}/import`,
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.push(`/admin/scales/${res.data.scale.id}`);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" disabled={busy} onClick={importScale}>
        {busy ? "가져오는 중..." : "내 척도로 가져오기"}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
