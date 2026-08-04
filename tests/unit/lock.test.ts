import { describe, it, expect } from "vitest";
import { evaluateScaleVersionLock } from "@/lib/lock";

describe("evaluateScaleVersionLock", () => {
  it("활성 설문이 없으면 잠금하지 않음 (종료·초안·미연결)", () => {
    expect(evaluateScaleVersionLock({ usedInActiveSurvey: false })).toBe(false);
  });

  it("게시·잠금 설문에 연결되어 있으면 응답이 없어도 잠금 (이슈 #10)", () => {
    expect(evaluateScaleVersionLock({ usedInActiveSurvey: true })).toBe(true);
  });
});
