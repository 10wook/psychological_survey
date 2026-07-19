"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";

type ScaleDisplayMode = "NAME" | "DESCRIPTION" | "CUSTOM";
type QuestionOrderMode = "SCALE_GROUPED" | "SHUFFLE_ALL";
type ScaleOrderMode = "FIXED" | "SHUFFLE";
type ScalePinPosition = "NONE" | "FIRST" | "LAST";

interface ScaleConfig {
  displayMode: ScaleDisplayMode;
  displayLabel: string;
  shuffleQuestions: boolean;
  includeInGlobalShuffle: boolean;
  pinPosition: ScalePinPosition;
}

interface AvailableVersion {
  id: string;
  versionNumber: number;
  status: string;
  scale: { name: string };
  _count: { questions: number };
}

export default function NewSurveyPage() {
  const router = useRouter();
  const [versions, setVersions] = useState<AvailableVersion[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    requireLogin: true,
    allowDuplicate: false,
    showResult: true,
    targetResponseCount: "",
    questionOrderMode: "SCALE_GROUPED" as QuestionOrderMode,
    scaleOrderMode: "FIXED" as ScaleOrderMode,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [scaleConfig, setScaleConfig] = useState<Record<string, ScaleConfig>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function configOf(id: string): ScaleConfig {
    return (
      scaleConfig[id] ?? {
        displayMode: "NAME",
        displayLabel: "",
        shuffleQuestions: false,
        includeInGlobalShuffle: true,
        pinPosition: "NONE",
      }
    );
  }
  function updateConfig(id: string, patch: Partial<ScaleConfig>) {
    setScaleConfig((c) => ({ ...c, [id]: { ...configOf(id), ...patch } }));
  }

  useEffect(() => {
    void (async () => {
      const res = await api.get<{ versions: AvailableVersion[] }>("/api/admin/scale-versions");
      if (res.ok) setVersions(res.data.versions);
    })();
  }, []);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function moveSelected(id: string, dir: -1 | 1) {
    setSelected((s) => {
      const idx = s.indexOf(id);
      if (idx < 0) return s;
      const target = idx + dir;
      if (target < 0 || target >= s.length) return s;
      const next = [...s];
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.length === 0) {
      setError("최소 하나의 척도를 선택하세요.");
      return;
    }
    setLoading(true);
    const res = await api.post<{ survey: { id: string } }>("/api/admin/surveys", {
      title: form.title,
      description: form.description || undefined,
      instructions: form.instructions || undefined,
      requireLogin: form.requireLogin,
      allowDuplicate: form.allowDuplicate,
      showResult: form.showResult,
      questionOrderMode: form.questionOrderMode,
      scaleOrderMode: form.scaleOrderMode,
      targetResponseCount: form.targetResponseCount ? Number(form.targetResponseCount) : undefined,
      scales: selected.map((id, idx) => {
        const cfg = configOf(id);
        return {
          scaleVersionId: id,
          displayOrder: idx + 1,
          isRequired: true,
          shuffleQuestions: cfg.shuffleQuestions,
          includeInGlobalShuffle: cfg.includeInGlobalShuffle,
          pinPosition: cfg.pinPosition,
          displayMode: cfg.displayMode,
          displayLabel:
            cfg.displayMode === "CUSTOM" ? cfg.displayLabel || undefined : undefined,
        };
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.push(`/admin/surveys/${res.data.survey.id}`);
  }

  const versionById = new Map(versions.map((v) => [v.id, v]));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-slate-900">새 설문</h1>
      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Field label="설문 제목" htmlFor="title" required>
            <Input id="title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </Field>
          <Field label="설명" htmlFor="description">
            <Textarea id="description" rows={2} value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="안내문" htmlFor="instructions">
            <Textarea id="instructions" rows={3} value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} />
          </Field>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">포함할 척도 (게시/잠금된 버전)</p>
            {versions.length === 0 ? (
              <Alert variant="warning">연결 가능한 게시된 척도 버전이 없습니다. 먼저 척도를 게시하세요.</Alert>
            ) : (
              <ul className="space-y-2">
                {versions.map((v) => {
                  const order = selected.indexOf(v.id);
                  return (
                    <li key={v.id}>
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                        <input type="checkbox" checked={order >= 0} onChange={() => toggle(v.id)} />
                        <span className="flex-1">
                          {v.scale.name}{" "}
                          <span className="text-slate-400">
                            v{v.versionNumber} · 문항 {v._count.questions}개
                          </span>
                        </span>
                        {order >= 0 && (
                          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                            선택됨
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selected.length > 0 && (
            <fieldset className="space-y-3 rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-xs font-medium text-slate-500">척도 제시 방식</legend>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">척도 순서</p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-0.5"
                    name="scaleOrderMode"
                    checked={form.scaleOrderMode === "FIXED"}
                    onChange={() => setForm((f) => ({ ...f, scaleOrderMode: "FIXED" }))}
                  />
                  <span>
                    순서 고정 (내가 정한 순서)
                    <span className="block text-xs text-slate-400">
                      아래 목록의 위→아래 순서대로 척도가 제시됩니다.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-0.5"
                    name="scaleOrderMode"
                    checked={form.scaleOrderMode === "SHUFFLE"}
                    onChange={() => setForm((f) => ({ ...f, scaleOrderMode: "SHUFFLE" }))}
                  />
                  <span>
                    척도 순서 무작위 셔플
                    <span className="block text-xs text-slate-400">
                      &quot;고정 없음&quot; 척도만 응답마다 순서가 바뀝니다. 처음/마지막 고정은 유지됩니다.
                    </span>
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">선택된 척도 순서 · 위치 고정</p>
                <ul className="space-y-2">
                  {selected.map((id, idx) => {
                    const v = versionById.get(id);
                    if (!v) return null;
                    const cfg = configOf(id);
                    return (
                      <li key={id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                            {idx + 1}
                          </span>
                          <span className="flex-1 font-medium text-slate-800">{v.scale.name}</span>
                          <button
                            type="button"
                            className="px-1 text-slate-400 hover:text-slate-700"
                            aria-label="위로"
                            onClick={() => moveSelected(id, -1)}
                            disabled={idx === 0}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="px-1 text-slate-400 hover:text-slate-700"
                            aria-label="아래로"
                            onClick={() => moveSelected(id, 1)}
                            disabled={idx === selected.length - 1}
                          >
                            ↓
                          </button>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <Field label="위치 고정">
                            <Select
                              value={cfg.pinPosition}
                              onChange={(e) =>
                                updateConfig(id, { pinPosition: e.target.value as ScalePinPosition })
                              }
                            >
                              <option value="NONE">고정 없음</option>
                              <option value="FIRST">처음 고정</option>
                              <option value="LAST">마지막 고정</option>
                            </Select>
                          </Field>
                          <Field label="표시 이름">
                            <Select
                              value={cfg.displayMode}
                              onChange={(e) =>
                                updateConfig(id, { displayMode: e.target.value as ScaleDisplayMode })
                              }
                            >
                              <option value="NAME">척도 제목 그대로</option>
                              <option value="DESCRIPTION">척도 설명으로 표시</option>
                              <option value="CUSTOM">직접 입력 (블라인드)</option>
                            </Select>
                          </Field>
                        </div>
                        {cfg.displayMode === "CUSTOM" && (
                          <Input
                            className="mt-2"
                            placeholder="응답자에게 보일 이름 (예: 파트 A)"
                            value={cfg.displayLabel}
                            onChange={(e) => updateConfig(id, { displayLabel: e.target.value })}
                          />
                        )}
                        <div className="mt-2">
                          {form.questionOrderMode === "SCALE_GROUPED" ? (
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={cfg.shuffleQuestions}
                                onChange={(e) =>
                                  updateConfig(id, { shuffleQuestions: e.target.checked })
                                }
                              />
                              이 척도 안에서 문항 순서 무작위
                            </label>
                          ) : (
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={cfg.includeInGlobalShuffle}
                                onChange={(e) =>
                                  updateConfig(id, { includeInGlobalShuffle: e.target.checked })
                                }
                              />
                              전체 섞기에 이 척도 포함
                            </label>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <p className="text-sm font-medium text-slate-700">문항 섞기 (하위 옵션)</p>
                {form.scaleOrderMode === "SHUFFLE" && form.questionOrderMode === "SHUFFLE_ALL" && (
                  <Alert variant="warning">
                    전체 문항 섞기를 쓰면 &quot;전체 섞기 포함&quot;된 척도는 하나의 묶음으로 합쳐져
                    척도 순서 셔플 효과가 제한됩니다.
                  </Alert>
                )}
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-0.5"
                    name="questionOrderMode"
                    checked={form.questionOrderMode === "SCALE_GROUPED"}
                    onChange={() => setForm((f) => ({ ...f, questionOrderMode: "SCALE_GROUPED" }))}
                  />
                  <span>
                    척도별로 묶어서 제시
                    <span className="block text-xs text-slate-400">
                      같은 척도 문항끼리 모아서. 척도별 &quot;척도 내 무작위&quot;를 켤 수 있습니다.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-0.5"
                    name="questionOrderMode"
                    checked={form.questionOrderMode === "SHUFFLE_ALL"}
                    onChange={() => setForm((f) => ({ ...f, questionOrderMode: "SHUFFLE_ALL" }))}
                  />
                  <span>
                    전체 문항 섞기
                    <span className="block text-xs text-slate-400">
                      &quot;전체 섞기에 포함&quot;된 척도 문항을 하나로 합쳐 무작위 제시합니다.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="목표 응답 수" htmlFor="target">
              <Input id="target" type="number" value={form.targetResponseCount}
                onChange={(e) => setForm((f) => ({ ...f, targetResponseCount: e.target.value }))} />
            </Field>
          </div>

          <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-medium text-slate-500">옵션</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!form.requireLogin}
                onChange={(e) => setForm((f) => ({ ...f, requireLogin: !e.target.checked }))} />
              비회원 응답 허용 (로그인 없이 참여 가능)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.requireLogin}
                onChange={(e) => setForm((f) => ({ ...f, requireLogin: e.target.checked }))} />
              회원 전용 (로그인 필수)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.allowDuplicate}
                onChange={(e) => setForm((f) => ({ ...f, allowDuplicate: e.target.checked }))} /> 중복 응답 허용
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.showResult}
                onChange={(e) => setForm((f) => ({ ...f, showResult: e.target.checked }))} /> 응답자에게 결과 공개
            </label>
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>취소</Button>
            <Button type="submit" disabled={loading}>{loading ? "생성 중..." : "생성"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
