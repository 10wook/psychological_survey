"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Button, Card } from "@/components/ui";

interface Intro {
  title: string;
  description: string | null;
  instructions: string | null;
  requireLogin: boolean;
  notStarted: boolean;
  ended: boolean;
  totalQuestions: number;
  estimatedSeconds: number;
  scales: Array<{ name: string; questionCount: number }>;
}

export function SurveyIntro({ publicId }: { publicId: string }) {
  const router = useRouter();
  const [intro, setIntro] = useState<Intro | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await api.get<{ survey: Intro }>(`/api/public/surveys/${publicId}`);
      if (res.ok) setIntro(res.data.survey);
      else setError(res.error.message);
    })();
  }, [publicId]);

  async function start() {
    setError(null);
    setStarting(true);
    const res = await api.post<{ responseId: string }>(`/api/public/surveys/${publicId}/start`);
    setStarting(false);
    if (!res.ok) {
      if (res.error.code === "UNAUTHORIZED") {
        router.push(`/login?next=/s/${publicId}`);
        return;
      }
      setError(res.error.message);
      return;
    }
    router.push(`/respond/${res.data.responseId}`);
  }

  if (error && !intro) return <Alert variant="error">{error}</Alert>;
  if (!intro) return <p className="text-sm text-slate-500">불러오는 중...</p>;

  const minutes = Math.max(1, Math.round(intro.estimatedSeconds / 60));

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{intro.title}</h1>
        {intro.description && <p className="mt-1 text-slate-600">{intro.description}</p>}
      </div>

      <div className="flex gap-4 text-sm text-slate-600">
        <span>문항 {intro.totalQuestions}개</span>
        <span>예상 소요 약 {minutes}분</span>
      </div>

      {intro.instructions && (
        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-line">
          {intro.instructions}
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-slate-700">포함된 척도</p>
        <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
          {intro.scales.map((s) => (
            <li key={s.name}>
              {s.name} <span className="text-slate-400">({s.questionCount}문항)</span>
            </li>
          ))}
        </ul>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {intro.notStarted ? (
        <Alert variant="warning">아직 시작되지 않은 설문입니다.</Alert>
      ) : intro.ended ? (
        <Alert variant="warning">종료된 설문입니다. 응답을 받을 수 없습니다.</Alert>
      ) : (
        <>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={agree}
              onChange={(e) => setAgree(e.target.checked)} />
            <span>연구 참여 및 개인정보 수집·이용에 동의하며 설문에 응답합니다.</span>
          </label>
          <Button className="w-full" onClick={start} disabled={!agree || starting}>
            {starting ? "시작하는 중..." : "설문 시작"}
          </Button>
        </>
      )}
    </Card>
  );
}
