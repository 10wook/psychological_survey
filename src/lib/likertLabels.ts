/**
 * 리커트 점수별 라벨 유틸.
 * ScaleVersion.likertLabels 는 string[] JSON 으로 저장되며,
 * 길이는 maxScore - minScore + 1 이어야 한다.
 */

export function usesLikertRange(scaleType: string): boolean {
  return scaleType === "LIKERT" || scaleType === "MIXED";
}

/** JSON 값을 string[] 로 정규화. 아니면 null. */
export function parseLikertLabels(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const labels = raw.map((v) => (typeof v === "string" ? v : String(v ?? "")));
  return labels;
}

/**
 * min~max 길이에 맞춰 라벨 배열을 정리한다.
 * - 비어 있는 항목은 숫자 문자열로 폴백
 * - 길이가 부족하면 숫자로 채움, 길면 자름
 * - 전부 비어 있거나 사용 안 하는 유형이면 null
 */
export function normalizeLikertLabels(
  scaleType: string,
  min: number,
  max: number,
  labels?: string[] | null,
): string[] | null {
  if (!usesLikertRange(scaleType)) return null;
  const count = max - min + 1;
  if (count <= 0) return null;
  if (!labels || labels.length === 0) return null;

  const next: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = labels[i]?.trim() ?? "";
    next.push(raw || String(min + i));
  }
  // 전부 숫자 폴백만이면 저장하지 않음(미설정과 동일)
  const allNumeric = next.every((l, i) => l === String(min + i));
  return allNumeric ? null : next;
}

/** LIKERT 옵션 생성 시 사용할 라벨. 없으면 숫자. */
export function labelForLikertValue(
  value: number,
  min: number,
  labels: string[] | null | undefined,
): string {
  if (!labels || labels.length === 0) return String(value);
  const idx = value - min;
  const label = labels[idx]?.trim();
  return label || String(value);
}
