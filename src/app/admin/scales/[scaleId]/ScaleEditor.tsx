"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import type { ScaleDTO, ScaleVersionDTO, QuestionType, ScaleType } from "@/lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
} from "@/components/ui";

const SCALE_TYPE_LABEL: Record<ScaleType, string> = {
  LIKERT: "리커트",
  SINGLE: "객관식 (단일 선택)",
  MULTIPLE: "다중선택",
  TEXT: "주관식 (줄글)",
  MIXED: "혼합",
};

function usesLikertRange(t: ScaleType) {
  return t === "LIKERT" || t === "MIXED";
}

function asLabelArray(raw: unknown, count: number): string[] {
  const src = Array.isArray(raw) ? raw.map((v) => (typeof v === "string" ? v : "")) : [];
  return Array.from({ length: count }, (_, i) => src[i] ?? "");
}

function defaultQuestionType(scaleType: ScaleType): QuestionType {
  if (scaleType === "MIXED" || scaleType === "LIKERT") return "LIKERT";
  return scaleType;
}

export function ScaleEditor({ scaleId }: { scaleId: string }) {
  const router = useRouter();
  const [scale, setScale] = useState<ScaleDTO | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ scale: ScaleDTO }>(`/api/admin/scales/${scaleId}`);
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setScale(res.data.scale);
    setVersionId((prev) => prev ?? res.data.scale.versions[0]?.id ?? null);
  }, [scaleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const version = scale?.versions.find((v) => v.id === versionId) ?? null;

  const refreshLock = useCallback(async () => {
    if (!versionId) return;
    const res = await api.get<{ locked: boolean }>(
      `/api/admin/scale-versions/${versionId}`,
    );
    if (res.ok) setLocked(res.data.locked);
  }, [versionId]);

  useEffect(() => {
    void refreshLock();
  }, [refreshLock]);

  const editable = version?.status === "DRAFT" && !locked;

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }

  async function handle<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>) {
    setError(null);
    const res = await p;
    if (!res.ok) {
      setError(res.error.message);
      return null;
    }
    await load();
    await refreshLock();
    return res.data;
  }

  async function publishVersion() {
    if (!versionId) return;
    const data = await handle(api.post(`/api/admin/scale-versions/${versionId}/publish`));
    if (data) flash("척도 버전을 게시했습니다.");
  }

  async function lockVersion() {
    if (!versionId) return;
    const data = await handle(api.post(`/api/admin/scale-versions/${versionId}/lock`));
    if (data) flash("척도 버전을 잠갔습니다.");
  }

  async function unlockVersion() {
    if (!versionId) return;
    const data = await handle(api.post(`/api/admin/scale-versions/${versionId}/unlock`));
    if (data) flash("척도 버전 잠금을 해제했습니다.");
  }

  async function createVersion() {
    const data = await handle<{ version: { id: string } }>(
      api.post(`/api/admin/scales/${scaleId}/versions`),
    );
    if (data) {
      setVersionId(data.version.id);
      flash("새 버전을 생성했습니다.");
    }
  }

  async function cloneScale() {
    const res = await api.post<{ scale: { id: string } }>(
      `/api/admin/scales/${scaleId}/clone`,
    );
    if (res.ok) router.push(`/admin/scales/${res.data.scale.id}`);
    else setError(res.error.message);
  }

  if (loading && !scale) return <p className="text-sm text-slate-500">불러오는 중...</p>;
  if (!scale) return <Alert variant="error">{error ?? "척도를 찾을 수 없습니다."}</Alert>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{scale.name}</h1>
          <p className="text-xs text-slate-500">{scale.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={cloneScale}>
            척도 복제
          </Button>
          <Button variant="secondary" size="sm" onClick={createVersion}>
            새 버전
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {/* 버전 선택 */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-700">버전:</span>
          {scale.versions.map((v) => (
            <button
              key={v.id}
              onClick={() => setVersionId(v.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                v.id === versionId
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              v{v.versionNumber} <Badge value={v.status} />
            </button>
          ))}
        </div>
      </Card>

      {version && (
        <>
          {locked && version.status !== "DRAFT" && (
            <Alert variant="warning">
              이 버전은 응답이 시작되었거나 게시된 설문에 사용 중이라 수정할 수 없습니다.
              수정하려면 “새 버전”을 생성하세요. 응답이 있거나 설문에 쓰인 버전은 잠금 해제할 수 없습니다.
            </Alert>
          )}
          {!locked && version.status === "LOCKED" && (
            <Alert variant="info">
              이 버전은 잠겨 있지만 아직 설문/응답에 쓰이지 않아 잠금 해제할 수 있습니다.
              설문은 특정 척도 버전을 고정하므로, 개시된 설문에는 이후 DRAFT 수정이 반영되지 않습니다.
            </Alert>
          )}
          {version.status === "DRAFT" && (
            <p className="text-xs text-slate-500">
              설문은 특정 척도 버전을 고정합니다. 잠긴 버전을 고치려면 새 버전을 만든 뒤 새 설문에 연결하세요.
            </p>
          )}

          <VersionSettings version={version} editable={!!editable} onSaved={load} setError={setError} />

          <SubfactorManager
            version={version}
            editable={!!editable}
            onChanged={load}
            setError={setError}
          />

          <QuestionManager
            version={version}
            editable={!!editable}
            onChanged={load}
            setError={setError}
          />

          {/* 게시/잠금 */}
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-slate-600">
              상태: <Badge value={version.status} /> · 활성 문항{" "}
              {version.questions.filter((q) => q.isActive).length}개
            </p>
            <div className="flex gap-2">
              {version.status === "DRAFT" && (
                <Button size="sm" onClick={publishVersion}>
                  버전 게시
                </Button>
              )}
              {version.status === "PUBLISHED" && (
                <Button size="sm" variant="secondary" onClick={lockVersion}>
                  버전 잠금
                </Button>
              )}
              {version.status === "LOCKED" && !locked && (
                <Button size="sm" variant="secondary" onClick={unlockVersion}>
                  잠금 해제
                </Button>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// --- 버전 설정 (min/max, 필수, 셔플) ---------------------------------------
function VersionSettings({
  version,
  editable,
  onSaved,
  setError,
}: {
  version: ScaleVersionDTO;
  editable: boolean;
  onSaved: () => Promise<void>;
  setError: (m: string | null) => void;
}) {
  const [scaleType, setScaleType] = useState<ScaleType>(version.scaleType ?? "LIKERT");
  const [minScore, setMin] = useState(String(version.minScore));
  const [maxScore, setMax] = useState(String(version.maxScore));
  const [labels, setLabels] = useState<string[]>(() =>
    asLabelArray(version.likertLabels, version.maxScore - version.minScore + 1),
  );
  const [requiredByDefault, setRequired] = useState(version.requiredByDefault);
  const [shuffleQuestions, setShuffle] = useState(version.shuffleQuestions);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScaleType(version.scaleType ?? "LIKERT");
    setMin(String(version.minScore));
    setMax(String(version.maxScore));
    setLabels(asLabelArray(version.likertLabels, version.maxScore - version.minScore + 1));
    setRequired(version.requiredByDefault);
    setShuffle(version.shuffleQuestions);
  }, [version]);

  const min = Number(minScore) || 1;
  const max = Number(maxScore) || 5;
  const pointCount = Math.max(0, max - min + 1);
  const showLikert = usesLikertRange(scaleType);

  function resizeLabels(nextMin: number, nextMax: number) {
    const count = Math.max(0, nextMax - nextMin + 1);
    setLabels((prev) => {
      const arr = [...prev];
      while (arr.length < count) arr.push("");
      return arr.slice(0, count);
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    if (showLikert && min >= max) {
      setError("리커트 최댓값은 최솟값보다 커야 합니다.");
      setSaving(false);
      return;
    }
    const hasAnyLabel = labels.some((l) => l.trim());
    const res = await api.patch(`/api/admin/scale-versions/${version.id}`, {
      scaleType,
      minScore: showLikert ? min : version.minScore,
      maxScore: showLikert ? max : version.maxScore,
      likertLabels: showLikert ? (hasAnyLabel ? labels.slice(0, pointCount) : null) : null,
      requiredByDefault,
      shuffleQuestions,
    });
    setSaving(false);
    if (!res.ok) setError(res.error.message);
    else await onSaved();
  }

  return (
    <Card className="space-y-4 p-4">
      <h2 className="text-sm font-semibold text-slate-900">버전 설정</h2>
      <Field label="척도 유형" htmlFor="scaleType"
        hint="문항 추가 시 기본 유형입니다. 문항별로 변경할 수 있습니다.">
        <Select
          id="scaleType"
          value={scaleType}
          disabled={!editable}
          onChange={(e) => setScaleType(e.target.value as ScaleType)}
        >
          {(Object.keys(SCALE_TYPE_LABEL) as ScaleType[]).map((k) => (
            <option key={k} value={k}>{SCALE_TYPE_LABEL[k]}</option>
          ))}
        </Select>
      </Field>

      {showLikert && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            리커트 최솟값/최댓값은 참여자에게 몇 점 척도로 보일지 정합니다.
            점수별 라벨을 입력하면 새로 추가하는 리커트 문항부터 적용됩니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="리커트 최솟값" htmlFor="min">
              <Input id="min" type="number" value={minScore} disabled={!editable}
                onChange={(e) => {
                  setMin(e.target.value);
                  resizeLabels(Number(e.target.value) || 1, max);
                }} />
            </Field>
            <Field label="리커트 최댓값" htmlFor="max">
              <Input id="max" type="number" value={maxScore} disabled={!editable}
                onChange={(e) => {
                  setMax(e.target.value);
                  resizeLabels(min, Number(e.target.value) || 5);
                }} />
            </Field>
          </div>
          {pointCount > 0 && pointCount <= 20 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">점수별 라벨</p>
              {Array.from({ length: pointCount }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-center text-xs font-mono text-slate-400">
                    {min + i}
                  </span>
                  <Input
                    placeholder={`점수 ${min + i} 라벨`}
                    value={labels[i] ?? ""}
                    disabled={!editable}
                    onChange={(e) => {
                      const next = [...labels];
                      next[i] = e.target.value;
                      setLabels(next);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requiredByDefault} disabled={!editable}
            onChange={(e) => setRequired(e.target.checked)} />
          전체 문항 필수 응답
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={shuffleQuestions} disabled={!editable}
            onChange={(e) => setShuffle(e.target.checked)} />
          문항 무작위 제시
        </label>
      </div>
      {editable && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "저장 중..." : "설정 저장"}
          </Button>
        </div>
      )}
    </Card>
  );
}

// --- 하위요인 관리 ---------------------------------------------------------
function SubfactorManager({
  version,
  editable,
  onChanged,
  setError,
}: {
  version: ScaleVersionDTO;
  editable: boolean;
  onChanged: () => Promise<void>;
  setError: (m: string | null) => void;
}) {
  const [name, setName] = useState("");

  async function add() {
    if (!name.trim()) return;
    setError(null);
    const res = await api.post(`/api/admin/scale-versions/${version.id}/subfactors`, {
      name: name.trim(),
    });
    if (!res.ok) setError(res.error.message);
    else {
      setName("");
      await onChanged();
    }
  }

  async function remove(id: string) {
    const res = await api.del(`/api/admin/subfactors/${id}`);
    if (!res.ok) setError(res.error.message);
    else await onChanged();
  }

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-semibold text-slate-900">하위요인</h2>
      {version.subfactors.length === 0 ? (
        <p className="text-sm text-slate-500">하위요인이 없습니다.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {version.subfactors.map((sf) => (
            <li key={sf.id} className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm">
              {sf.name}
              {editable && (
                <button onClick={() => remove(sf.id)} className="text-slate-400 hover:text-red-600" aria-label="삭제">
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="flex gap-2">
          <Input placeholder="하위요인 이름" value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" variant="secondary" onClick={add}>
            추가
          </Button>
        </div>
      )}
    </Card>
  );
}

// --- 문항 관리 (구글폼식 유형 선택) -----------------------------------------
const QUESTION_TYPE_LABEL: Record<string, string> = {
  LIKERT: "리커트 척도",
  SINGLE: "단일 선택 (라디오)",
  MULTIPLE: "다중 선택 (체크박스)",
  TEXT: "줄글",
};

type QuestionDraft = {
  code: string;
  content: string;
  type: QuestionType;
  subfactorId: string;
  isReverse: boolean;
  isRequired: boolean;
  minSelect: string;
  maxSelect: string;
  options: Array<{ value: number; label: string }>;
};

function QuestionManager({
  version,
  editable,
  onChanged,
  setError,
}: {
  version: ScaleVersionDTO;
  editable: boolean;
  onChanged: () => Promise<void>;
  setError: (m: string | null) => void;
}) {
  function emptyDraft(): QuestionDraft {
    return {
      code: "",
      content: "",
      type: defaultQuestionType(version.scaleType ?? "LIKERT"),
      subfactorId: "",
      isReverse: false,
      isRequired: true,
      minSelect: "",
      maxSelect: "",
      options: [{ value: 1, label: "옵션 1" }, { value: 2, label: "옵션 2" }],
    };
  }

  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditingId(null);
    setDraft(emptyDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when version changes
  }, [version.id, version.scaleType]);

  function startEdit(q: (typeof version.questions)[number]) {
    if (!editable) return;
    setEditingId(q.id);
    setDraft({
      code: q.code,
      content: q.content,
      type: q.type,
      subfactorId: q.subfactorId ?? "",
      isReverse: q.isReverse,
      isRequired: q.isRequired,
      minSelect: q.minSelect != null ? String(q.minSelect) : "",
      maxSelect: q.maxSelect != null ? String(q.maxSelect) : "",
      options:
        q.options.length > 0
          ? q.options.map((o) => ({ value: o.value, label: o.label }))
          : [{ value: 1, label: "옵션 1" }, { value: 2, label: "옵션 2" }],
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft());
    setError(null);
  }

  function payload() {
    return {
      code: draft.code.trim(),
      content: draft.content.trim(),
      type: draft.type,
      subfactorId: draft.subfactorId || null,
      isReverse: draft.type === "LIKERT" ? draft.isReverse : false,
      isRequired: draft.isRequired,
      minSelect: draft.type === "MULTIPLE" && draft.minSelect ? Number(draft.minSelect) : null,
      maxSelect: draft.type === "MULTIPLE" && draft.maxSelect ? Number(draft.maxSelect) : null,
      // 보기(옵션)는 단일/다중 선택 문항에서만 직접 입력. 리커트는 서버/기존 옵션 유지.
      options:
        draft.type === "SINGLE" || draft.type === "MULTIPLE"
          ? draft.options
          : undefined,
    };
  }

  async function add() {
    if (!draft.code.trim() || !draft.content.trim()) {
      setError("문항 코드와 내용을 입력하세요.");
      return;
    }
    setError(null);
    setSaving(true);
    const res = await api.post(`/api/admin/scale-versions/${version.id}/questions`, payload());
    setSaving(false);
    if (!res.ok) setError(res.error.message);
    else {
      cancelEdit();
      await onChanged();
    }
  }

  async function saveEdit() {
    if (!editingId) return;
    if (!draft.code.trim() || !draft.content.trim()) {
      setError("문항 코드와 내용을 입력하세요.");
      return;
    }
    setError(null);
    setSaving(true);
    const res = await api.patch(`/api/admin/questions/${editingId}`, payload());
    setSaving(false);
    if (!res.ok) setError(res.error.message);
    else {
      cancelEdit();
      await onChanged();
    }
  }

  async function toggle(id: string, patch: Record<string, unknown>) {
    const res = await api.patch(`/api/admin/questions/${id}`, patch);
    if (!res.ok) setError(res.error.message);
    else await onChanged();
  }

  async function remove(id: string) {
    if (editingId === id) cancelEdit();
    const res = await api.del(`/api/admin/questions/${id}`);
    if (!res.ok) setError(res.error.message);
    else await onChanged();
  }

  async function move(index: number, dir: -1 | 1) {
    const ids = version.questions.map((q) => q.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    const res = await api.post(
      `/api/admin/scale-versions/${version.id}/questions/reorder`,
      { orderedIds: ids },
    );
    if (!res.ok) setError(res.error.message);
    else await onChanged();
  }

  const subMap = new Map(version.subfactors.map((s) => [s.id, s.name]));
  const isEditing = Boolean(editingId);

  return (
    <Card className="space-y-4 p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        문항 ({version.questions.length})
      </h2>
      {editable && (
        <p className="text-xs text-slate-500">문항을 클릭하거나 「수정」을 누르면 아래에서 편집할 수 있습니다.</p>
      )}

      {version.questions.length === 0 ? (
        <EmptyState title="문항이 없습니다." description="아래에서 문항을 추가하세요." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {version.questions.map((q, i) => (
            <li
              key={q.id}
              className={`flex flex-wrap items-center gap-2 py-2 text-sm ${
                editingId === q.id ? "bg-brand-50/60" : ""
              } ${editable ? "cursor-pointer hover:bg-slate-50" : ""}`}
              onClick={() => {
                if (editable) startEdit(q);
              }}
            >
              <span className="w-12 shrink-0 font-mono text-xs text-slate-400">{q.code}</span>
              <span className={`flex-1 ${q.isActive ? "text-slate-800" : "text-slate-400 line-through"}`}>
                {q.content}
              </span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                {QUESTION_TYPE_LABEL[q.type] ?? q.type}
              </span>
              {q.subfactorId && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                  {subMap.get(q.subfactorId)}
                </span>
              )}
              {q.isReverse && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">역문항</span>
              )}
              {!q.isRequired && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">선택</span>
              )}
              {editable && (
                <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => startEdit(q)}
                    className="px-1 text-xs text-brand-600 hover:text-brand-700">수정</button>
                  <button type="button" onClick={() => move(i, -1)} className="px-1 text-slate-400 hover:text-slate-700" aria-label="위로">↑</button>
                  <button type="button" onClick={() => move(i, 1)} className="px-1 text-slate-400 hover:text-slate-700" aria-label="아래로">↓</button>
                  <button type="button" onClick={() => toggle(q.id, { isReverse: !q.isReverse })}
                    className="px-1 text-xs text-slate-500 hover:text-amber-600">역문항</button>
                  <button type="button" onClick={() => toggle(q.id, { isActive: !q.isActive })}
                    className="px-1 text-xs text-slate-500 hover:text-slate-800">
                    {q.isActive ? "비활성" : "활성"}
                  </button>
                  <button type="button" onClick={() => remove(q.id)} className="px-1 text-xs text-red-500 hover:text-red-700">삭제</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-500">
            {isEditing ? "문항 수정" : "새 문항 추가"}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="코드 (예: Q1)" value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} />
            <Select value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as QuestionType }))}>
              {Object.entries(QUESTION_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          <Input placeholder="문항 내용" value={draft.content}
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))} />
          <div className="flex flex-wrap gap-3">
            <Select value={draft.subfactorId}
              onChange={(e) => setDraft((d) => ({ ...d, subfactorId: e.target.value }))}>
              <option value="">하위요인 없음</option>
              {version.subfactors.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={draft.isRequired}
                onChange={(e) => setDraft((d) => ({ ...d, isRequired: e.target.checked }))} />
              필수 응답
            </label>
            {draft.type === "LIKERT" && (
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={draft.isReverse}
                  onChange={(e) => setDraft((d) => ({ ...d, isReverse: e.target.checked }))} />
                역문항
              </label>
            )}
          </div>
          {draft.type === "MULTIPLE" && (
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min={0} placeholder="최소 선택 개수"
                value={draft.minSelect}
                onChange={(e) => setDraft((d) => ({ ...d, minSelect: e.target.value }))} />
              <Input type="number" min={1} placeholder="최대 선택 개수"
                value={draft.maxSelect}
                onChange={(e) => setDraft((d) => ({ ...d, maxSelect: e.target.value }))} />
            </div>
          )}
          {(draft.type === "SINGLE" || draft.type === "MULTIPLE") && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">보기 선택지</p>
              {draft.options.map((o, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input placeholder={`옵션 ${idx + 1}`} value={o.label}
                    onChange={(e) => {
                      const opts = [...draft.options];
                      opts[idx] = { value: idx + 1, label: e.target.value };
                      setDraft((d) => ({ ...d, options: opts }));
                    }} />
                  <Button size="sm" variant="secondary" type="button"
                    onClick={() => setDraft((d) => ({ ...d, options: d.options.filter((_, i) => i !== idx) }))}>
                    ×
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="secondary" type="button"
                onClick={() => setDraft((d) => ({
                  ...d,
                  options: [...d.options, { value: d.options.length + 1, label: `옵션 ${d.options.length + 1}` }],
                }))}>
                + 보기 추가
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button size="sm" onClick={saveEdit} disabled={saving}>
                  {saving ? "저장 중..." : "수정 저장"}
                </Button>
                <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={saving}>
                  취소
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={add} disabled={saving}>
                {saving ? "추가 중..." : "문항 추가"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
