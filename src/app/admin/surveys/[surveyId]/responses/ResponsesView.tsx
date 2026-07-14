"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Badge, Button, Card, LinkButton, Select } from "@/components/ui";
import { ExportPanel } from "./ExportPanel";

interface Monitoring {
  started: number;
  inProgress: number;
  completed: number;
  abandoned: number;
  completionRate: number | null;
  averageDurationSeconds: number | null;
  targetResponseCount: number | null;
  achievementRate: number | null;
}
interface ResponseRow {
  id: string;
  anonymousCode: string;
  status: string;
  startedAt: string;
  lastSavedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  pii: { email: string | null; birthYear: number | null; gender: string | null } | null;
}

export function ResponsesView({ surveyId }: { surveyId: string }) {
  const [monitoring, setMonitoring] = useState<Monitoring | null>(null);
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [canPii, setCanPii] = useState(false);
  const [showPii, setShowPii] = useState(false);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (showPii) qs.set("pii", "1");
    const res = await api.get<{
      monitoring: Monitoring;
      canViewPii: boolean;
      responses: ResponseRow[];
    }>(`/api/admin/surveys/${surveyId}/responses?${qs.toString()}`);
    if (res.ok) {
      setMonitoring(res.data.monitoring);
      setRows(res.data.responses);
      setCanPii(res.data.canViewPii);
    }
  }, [surveyId, status, showPii]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = monitoring
    ? [
        { label: "시작", value: monitoring.started },
        { label: "진행 중", value: monitoring.inProgress },
        { label: "완료", value: monitoring.completed },
        { label: "완료율", value: monitoring.completionRate === null ? "-" : `${monitoring.completionRate}%` },
        {
          label: "평균 응답시간",
          value:
            monitoring.averageDurationSeconds === null
              ? "-"
              : `${Math.round(monitoring.averageDurationSeconds / 60)}분`,
        },
        {
          label: "목표 달성률",
          value: monitoring.achievementRate === null ? "-" : `${monitoring.achievementRate}%`,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">응답 관리</h1>
        <LinkButton href={`/admin/surveys/${surveyId}`} variant="ghost" size="sm">
          ← 설문으로
        </LinkButton>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="p-3 text-center">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{c.value}</p>
          </Card>
        ))}
      </div>

      <ExportPanel surveyId={surveyId} canPii={canPii} />

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            <option value="">모든 상태</option>
            <option value="IN_PROGRESS">진행 중</option>
            <option value="COMPLETED">완료</option>
            <option value="ABANDONED">이탈</option>
          </Select>
          {canPii && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={showPii} onChange={(e) => setShowPii(e.target.checked)} />
              개인정보 표시
            </label>
          )}
          <Button size="sm" variant="secondary" onClick={() => void load()}>새로고침</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4">응답자</th>
                {showPii && <th className="py-2 pr-4">이메일</th>}
                <th className="py-2 pr-4">상태</th>
                <th className="py-2 pr-4">시작</th>
                <th className="py-2 pr-4">완료</th>
                <th className="py-2 pr-4">응답시간</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    응답이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-mono text-xs">{r.anonymousCode}</td>
                    {showPii && <td className="py-2 pr-4">{r.pii?.email ?? "-"}</td>}
                    <td className="py-2 pr-4"><Badge value={r.status} /></td>
                    <td className="py-2 pr-4 text-xs text-slate-500">
                      {new Date(r.startedAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-500">
                      {r.completedAt ? new Date(r.completedAt).toLocaleString("ko-KR") : "-"}
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-500">
                      {r.durationSeconds ? `${r.durationSeconds}초` : "-"}
                    </td>
                    <td className="py-2">
                      <Link href={`/admin/responses/${r.id}`} className="text-brand-600 hover:underline">
                        상세
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
