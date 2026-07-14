// ===========================================================================
// 기술통계 (순수 함수). 표본 기준(ddof=1) 분산/표준편차.
// 문서 6.14 / 10.5 규칙:
//  - 응답자(값) 1개 이하이면 표본 분산·표준편차는 null(계산 불가).
// ===========================================================================

export interface DescriptiveStats {
  count: number;
  mean: number | null;
  variance: number | null; // 표본 분산 (ddof = 1)
  standardDeviation: number | null; // 표본 표준편차
  median: number | null;
  min: number | null;
  max: number | null;
}

function cleanValues(values: Array<number | null | undefined>): number[] {
  return values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** 표본 분산 (ddof = 1). n <= 1 이면 null */
export function sampleVariance(values: number[]): number | null {
  const n = values.length;
  if (n <= 1) return null;
  const m = mean(values)!;
  const ss = values.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return ss / (n - 1);
}

export function sampleStandardDeviation(values: number[]): number | null {
  const v = sampleVariance(values);
  return v === null ? null : Math.sqrt(v);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function minValue(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.min(...values);
}

export function maxValue(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.max(...values);
}

/** 결측(null/undefined/NaN)은 제외하고 완료 값만으로 계산 */
export function describe(
  rawValues: Array<number | null | undefined>,
): DescriptiveStats {
  const values = cleanValues(rawValues);
  return {
    count: values.length,
    mean: mean(values),
    variance: sampleVariance(values),
    standardDeviation: sampleStandardDeviation(values),
    median: median(values),
    min: minValue(values),
    max: maxValue(values),
  };
}
