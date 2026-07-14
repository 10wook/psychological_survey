"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Alert, Badge, Button, Card, LinkButton } from "@/components/ui";

interface SurveyDTO {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  status: string;
  publicId: string;
  requireLogin: boolean;
  allowDuplicate: boolean;
  showResult: boolean;
  targetResponseCount: number | null;
  surveyScales: Array<{
    id: string;
    displayOrder: number;
    isRequired: boolean;
    scaleVersion: {
      versionNumber: number;
      scale: { name: string };
      _count: { questions: number };
    };
  }>;
  _count: { responses: number };
}

export function SurveyManager({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<SurveyDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [qr, setQr] = useState<{ url: string; dataUrl: string } | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<{ survey: SurveyDTO }>(`/api/admin/surveys/${surveyId}`);
    if (res.ok) setSurvey(res.data.survey);
    else setError(res.error.message);
  }, [surveyId]);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(m: string) {
    setNotice(m);
    setTimeout(() => setNotice(null), 2500);
  }

  async function act(path: string, msg: string) {
    setError(null);
    const res = await api.post(`/api/admin/surveys/${surveyId}/${path}`);
    if (!res.ok) setError(res.error.message);
    else {
      flash(msg);
      await load();
    }
  }

  const loadQr = useCallback(async () => {
    const res = await api.get<{ url: string; dataUrl: string }>(
      `/api/admin/surveys/${surveyId}/qr`,
    );
    if (res.ok) setQr(res.data);
  }, [surveyId]);

  useEffect(() => {
    if (survey && survey.status !== "DRAFT") void loadQr();
  }, [survey, loadQr]);

  if (!survey) return <p className="text-sm text-slate-500">{error ?? "불러오는 중..."}</p>;

  const publicUrl = qr?.url ?? "";
  const isPublished = survey.status === "PUBLISHED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{survey.title}</h1>
            <Badge value={survey.status} />
          </div>
          <p className="text-xs text-slate-500">응답 {survey._count.responses}건</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/admin/surveys/${surveyId}/responses`} variant="secondary" size="sm">
            응답 관리
          </LinkButton>
          <LinkButton href={`/admin/surveys/${surveyId}/statistics`} variant="secondary" size="sm">
            통계
          </LinkButton>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-slate-900">연결된 척도</h2>
        <ul className="space-y-1 text-sm text-slate-700">
          {survey.surveyScales.map((ss) => (
            <li key={ss.id} className="flex items-center gap-2">
              <span className="text-slate-400">{ss.displayOrder}.</span>
              {ss.scaleVersion.scale.name} v{ss.scaleVersion.versionNumber}
              <span className="text-xs text-slate-400">
                (문항 {ss.scaleVersion._count.questions}개{ss.isRequired ? ", 필수" : ""})
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* 상태 액션 */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-slate-600">
          로그인 {survey.requireLogin ? "필수" : "선택"} · 결과 공개{" "}
          {survey.showResult ? "O" : "X"} · 중복응답 {survey.allowDuplicate ? "허용" : "불가"}
        </p>
        <div className="flex gap-2">
          {survey.status === "DRAFT" && (
            <Button size="sm" onClick={() => act("publish", "설문을 게시했습니다.")}>
              게시
            </Button>
          )}
          {survey.status === "PUBLISHED" && (
            <Button size="sm" variant="secondary" onClick={() => act("close", "설문을 종료했습니다.")}>
              종료
            </Button>
          )}
          {survey.status !== "DRAFT" && survey.status !== "LOCKED" && (
            <Button size="sm" variant="secondary" onClick={() => act("lock", "설문을 잠갔습니다.")}>
              잠금
            </Button>
          )}
        </div>
      </Card>

      {/* 배포 URL & QR */}
      {survey.status !== "DRAFT" && (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-slate-900">배포</h2>
          {isPublished ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-slate-100 px-2 py-1 text-xs">{publicUrl}</code>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (publicUrl) navigator.clipboard.writeText(publicUrl);
                    flash("링크를 복사했습니다.");
                  }}
                >
                  링크 복사
                </Button>
                <Link href={`/s/${survey.publicId}`} className="text-sm text-brand-600 hover:underline" target="_blank">
                  미리보기 ↗
                </Link>
              </div>
              {qr?.dataUrl && (
                <img src={qr.dataUrl} alt="설문 QR 코드" className="h-40 w-40 rounded border border-slate-200" />
              )}
            </>
          ) : (
            <Alert variant="warning">종료/잠금된 설문은 새 응답을 받을 수 없습니다.</Alert>
          )}
        </Card>
      )}
    </div>
  );
}
