"use client";

import { useState } from "react";
import { Alert, Button, Card } from "@/components/ui";

// 데이터 내보내기 (이슈 #28: 설정 간소화).
// - 다운로드 1회에 CSV·XLSX 를 모두 받는다 (형식 드롭다운 삭제)
// - 완료 응답만·변환점수·개인정보 포함(권한 시)·wide(응답자당 1행) 는 디폴트 적용
// - 척도 총점·하위요인 점수는 XLSX 에서 독립 시트로 분리
export function ExportPanel({ surveyId, canPii }: { surveyId: string; canPii: boolean }) {
  const [opts, setOpts] = useState({
    includeScaleTotals: true,
    includeSubfactorScores: true,
    includePresentedOrder: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(key: keyof typeof opts) {
    setOpts((o) => ({ ...o, [key]: !o[key] }));
  }

  async function downloadOne(format: "csv" | "xlsx") {
    const res = await fetch(`/api/admin/surveys/${surveyId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format,
        layout: "wide",
        onlyCompleted: true,
        includeRaw: false,
        includeConverted: true,
        includePii: canPii,
        useBom: true,
        ...opts,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.error?.message ?? "내보내기에 실패했습니다.");
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="(.+?)"/);
    const filename = match?.[1] ?? `export.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function download() {
    setError(null);
    setLoading(true);
    try {
      await downloadOne("xlsx");
      await downloadOne("csv");
    } catch (e) {
      setError(e instanceof Error ? e.message : "내보내기에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const checks: Array<[keyof typeof opts, string]> = [
    ["includeScaleTotals", "척도 총점 (독립 시트)"],
    ["includeSubfactorScores", "하위요인 점수 (독립 시트)"],
    ["includePresentedOrder", "제시 순서"],
  ];

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-semibold text-slate-900">데이터 내보내기</h2>
      {error && <Alert variant="error">{error}</Alert>}
      <p className="text-xs text-slate-500">
        다운로드 시 CSV(엑셀 호환)·XLSX 파일을 함께 받습니다. 완료 응답만, 변환점수 기준,
        응답자당 1행{canPii ? ", 개인정보 포함" : ""}이 기본 적용됩니다.
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {checks.map(([key, label]) => (
          <label key={key} className="flex items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={opts[key]} onChange={() => toggle(key)} />
            {label}
          </label>
        ))}
      </div>
      <div>
        <Button size="sm" onClick={download} disabled={loading}>
          {loading ? "생성 중..." : "다운로드 (CSV + XLSX)"}
        </Button>
      </div>
    </Card>
  );
}
