"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Alert, Badge, Button, Card } from "@/components/ui";

interface QuestionRow {
  code: string;
  content: string;
  isReverse: boolean;
  presentedOrder: number | null;
  rawScore: number | null;
  convertedScore: number | null;
}
interface ScaleBlock {
  scaleName: string;
  versionNumber: number;
  questions: QuestionRow[];
  scaleResult: { rawTotal: number; convertedTotal: number; averageScore: number } | null;
  subfactors: Array<{ name: string; totalScore: number; averageScore: number }>;
}
interface ResponseDTO {
  id: string;
  anonymousCode: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  demographics: { email: string | null; birthYear: number | null; gender: string | null } | null;
  scales: ScaleBlock[];
}

export function ResponseDetail({ responseId }: { responseId: string }) {
  const [data, setData] = useState<ResponseDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPii, setShowPii] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<{ response: ResponseDTO }>(
      `/api/admin/responses/${responseId}${showPii ? "?pii=1" : ""}`,
    );
    if (res.ok) setData(res.data.response);
    else setError(res.error.message);
  }, [responseId, showPii]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <p className="text-sm text-slate-500">불러오는 중...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900">{data.anonymousCode}</h1>
          <Badge value={data.status} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showPii} onChange={(e) => setShowPii(e.target.checked)} />
          개인정보 표시
        </label>
      </div>

      <Card className="grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
        <div><p className="text-xs text-slate-500">시작</p><p>{new Date(data.startedAt).toLocaleString("ko-KR")}</p></div>
        <div><p className="text-xs text-slate-500">완료</p><p>{data.completedAt ? new Date(data.completedAt).toLocaleString("ko-KR") : "-"}</p></div>
        <div><p className="text-xs text-slate-500">응답시간</p><p>{data.durationSeconds ? `${data.durationSeconds}초` : "-"}</p></div>
        {data.demographics && (
          <div>
            <p className="text-xs text-slate-500">인구통계</p>
            <p>{data.demographics.email ?? "-"} · {data.demographics.birthYear ?? "-"} · {data.demographics.gender ?? "-"}</p>
          </div>
        )}
      </Card>

      {data.scales.map((s) => (
        <Card key={s.scaleName} className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">{s.scaleName} v{s.versionNumber}</h2>
            {s.scaleResult && (
              <span className="text-sm text-slate-500">
                총점 {s.scaleResult.convertedTotal} · 평균 {s.scaleResult.averageScore}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-1.5 pr-3">문항</th>
                  <th className="py-1.5 pr-3">내용</th>
                  <th className="py-1.5 pr-3 text-center">역</th>
                  <th className="py-1.5 pr-3 text-right">제시순서</th>
                  <th className="py-1.5 pr-3 text-right">원점수</th>
                  <th className="py-1.5 text-right">변환점수</th>
                </tr>
              </thead>
              <tbody>
                {s.questions.map((q) => (
                  <tr key={q.code} className="border-b border-slate-100">
                    <td className="py-1.5 pr-3 font-mono text-xs">{q.code}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{q.content}</td>
                    <td className="py-1.5 pr-3 text-center">{q.isReverse ? "Y" : ""}</td>
                    <td className="py-1.5 pr-3 text-right text-slate-400">{q.presentedOrder ?? "-"}</td>
                    <td className="py-1.5 pr-3 text-right">{q.rawScore ?? "-"}</td>
                    <td className="py-1.5 text-right">{q.convertedScore ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {s.subfactors.length > 0 && (
            <div className="text-sm text-slate-600">
              {s.subfactors.map((sf) => (
                <span key={sf.name} className="mr-4">
                  {sf.name}: 총 {sf.totalScore} / 평균 {sf.averageScore}
                </span>
              ))}
            </div>
          )}
        </Card>
      ))}

      <Button variant="secondary" size="sm" onClick={() => history.back()}>
        ← 돌아가기
      </Button>
    </div>
  );
}
