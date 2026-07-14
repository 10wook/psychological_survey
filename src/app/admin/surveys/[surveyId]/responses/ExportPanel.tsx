"use client";

import { useState } from "react";
import { Alert, Button, Card, Select } from "@/components/ui";

export function ExportPanel({ surveyId, canPii }: { surveyId: string; canPii: boolean }) {
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [layout, setLayout] = useState<"wide" | "long">("wide");
  const [opts, setOpts] = useState({
    onlyCompleted: true,
    includePii: false,
    includeRaw: true,
    includeConverted: true,
    includeScaleTotals: true,
    includeSubfactorScores: true,
    includePresentedOrder: false,
    useBom: true,
    useQuestionContent: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(key: keyof typeof opts) {
    setOpts((o) => ({ ...o, [key]: !o[key] }));
  }

  async function download() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/surveys/${surveyId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, layout, ...opts }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? "내보내기에 실패했습니다.");
        return;
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
    } finally {
      setLoading(false);
    }
  }

  const checks: Array<[keyof typeof opts, string]> = [
    ["onlyCompleted", "완료 응답만"],
    ["includeRaw", "원점수"],
    ["includeConverted", "변환점수"],
    ["includeScaleTotals", "척도 총점"],
    ["includeSubfactorScores", "하위요인 점수"],
    ["includePresentedOrder", "제시 순서"],
    ["useBom", "CSV BOM(엑셀 호환)"],
    ["useQuestionContent", "문항 내용 열 이름"],
  ];

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-semibold text-slate-900">데이터 내보내기</h2>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={format} onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")} className="w-28">
          <option value="csv">CSV</option>
          <option value="xlsx">XLSX</option>
        </Select>
        <Select value={layout} onChange={(e) => setLayout(e.target.value as "wide" | "long")} className="w-36">
          <option value="wide">Wide (응답자당 1행)</option>
          <option value="long">Long (응답당 1행)</option>
        </Select>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {checks.map(([key, label]) => (
          <label key={key} className="flex items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={opts[key]} onChange={() => toggle(key)} />
            {label}
          </label>
        ))}
        <label className={`flex items-center gap-1.5 text-sm ${canPii ? "text-slate-600" : "text-slate-300"}`}>
          <input type="checkbox" checked={opts.includePii} disabled={!canPii} onChange={() => toggle("includePii")} />
          개인정보 포함{!canPii && " (권한 없음)"}
        </label>
      </div>
      <div>
        <Button size="sm" onClick={download} disabled={loading}>
          {loading ? "생성 중..." : "다운로드"}
        </Button>
      </div>
    </Card>
  );
}
