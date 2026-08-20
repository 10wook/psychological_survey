import { describe, it, expect } from "vitest";
import {
  mean,
  sampleVariance,
  sampleStandardDeviation,
  median,
  mode,
  skewness,
  kurtosis,
  describe as describeStats,
} from "@/lib/statistics";

describe("mean", () => {
  it("평균 계산", () => {
    expect(mean([2, 4, 6])).toBe(4);
  });
  it("빈 배열은 null", () => {
    expect(mean([])).toBeNull();
  });
});

describe("sampleVariance / sampleStandardDeviation (ddof=1)", () => {
  it("표본 분산 계산", () => {
    // 값 [2,4,4,4,5,5,7,9], mean=5, ss=32, n-1=7 → 32/7
    const v = sampleVariance([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(v).toBeCloseTo(32 / 7);
  });
  it("표본 표준편차", () => {
    const sd = sampleStandardDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(sd).toBeCloseTo(Math.sqrt(32 / 7));
  });
  it("값 1개 이하이면 분산·표준편차 null", () => {
    expect(sampleVariance([5])).toBeNull();
    expect(sampleVariance([])).toBeNull();
    expect(sampleStandardDeviation([5])).toBeNull();
  });
});

describe("median", () => {
  it("홀수 개", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("짝수 개", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("빈 배열 null", () => {
    expect(median([])).toBeNull();
  });
});

describe("describe (결측 처리 포함)", () => {
  it("null/undefined/NaN 제외 후 계산", () => {
    const stats = describeStats([1, null, 2, undefined, 3, NaN]);
    expect(stats.count).toBe(3);
    expect(stats.mean).toBe(2);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(3);
    expect(stats.median).toBe(2);
    expect(stats.variance).toBeCloseTo(1); // [1,2,3] var = 1
    expect(stats.mode).toBe(1); // 모두 빈도 1 → 최소값
  });

  it("응답자 1명이면 분산/표준편차 null, 나머지는 값", () => {
    const stats = describeStats([7]);
    expect(stats.count).toBe(1);
    expect(stats.mean).toBe(7);
    expect(stats.median).toBe(7);
    expect(stats.mode).toBe(7);
    expect(stats.variance).toBeNull();
    expect(stats.standardDeviation).toBeNull();
    expect(stats.skewness).toBeNull();
    expect(stats.kurtosis).toBeNull();
  });
});

describe("mode", () => {
  it("최빈값", () => {
    expect(mode([1, 2, 2, 3, 3, 3])).toBe(3);
  });
  it("동률이면 더 작은 값", () => {
    expect(mode([2, 2, 1, 1])).toBe(1);
  });
  it("빈 배열 null", () => {
    expect(mode([])).toBeNull();
  });
});

describe("skewness / kurtosis (Excel SKEW / KURT)", () => {
  it("대칭 수열 1..5 의 왜도는 0, 초과 첨도는 -1.2", () => {
    const values = [1, 2, 3, 4, 5];
    expect(skewness(values)).toBeCloseTo(0);
    expect(kurtosis(values)).toBeCloseTo(-1.2);
  });
  it("n<3 이면 왜도 null, n<4 이면 첨도 null", () => {
    expect(skewness([1, 2])).toBeNull();
    expect(kurtosis([1, 2, 3])).toBeNull();
  });
});
