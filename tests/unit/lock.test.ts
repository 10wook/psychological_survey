import { describe, it, expect } from "vitest";
import { evaluateScaleVersionLock } from "@/lib/lock";

describe("evaluateScaleVersionLock", () => {
  it("활성 설문이 없으면 잠금하지 않음 (종료·초안·미연결)", () => {
    expect(
      evaluateScaleVersionLock({
        usedInActiveSurvey: false,
        hasCompletedResults: true,
        hasStartedResponsesOnActiveSurvey: true,
      }),
    ).toBe(false);
  });

  it("활성 설문에 연결됐지만 응답이 없으면 잠금하지 않음 (설문 미시작)", () => {
    expect(
      evaluateScaleVersionLock({
        usedInActiveSurvey: true,
        hasCompletedResults: false,
        hasStartedResponsesOnActiveSurvey: false,
      }),
    ).toBe(false);
  });

  it("활성 설문 + 완료 응답이 있으면 잠금", () => {
    expect(
      evaluateScaleVersionLock({
        usedInActiveSurvey: true,
        hasCompletedResults: true,
        hasStartedResponsesOnActiveSurvey: false,
      }),
    ).toBe(true);
  });

  it("활성 설문 + 진행 중 응답이 있으면 잠금", () => {
    expect(
      evaluateScaleVersionLock({
        usedInActiveSurvey: true,
        hasCompletedResults: false,
        hasStartedResponsesOnActiveSurvey: true,
      }),
    ).toBe(true);
  });
});
