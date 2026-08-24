import { describe, expect, it } from "vitest";
import { surveyScaleInputSchema } from "@/lib/validation";

describe("surveyScaleInputSchema displayLabel (이슈 #21)", () => {
  it("줄바꿈이 있는 직접 입력을 허용한다", () => {
    const parsed = surveyScaleInputSchema.parse({
      scaleVersionId: "sv1",
      displayModes: ["CUSTOM"],
      displayLabel: "파트 A\n다음 문항에 답하세요.",
    });
    expect(parsed.displayLabel).toBe("파트 A\n다음 문항에 답하세요.");
  });

  it("200자를 넘는 안내도 허용한다", () => {
    const label = "안내 ".repeat(80); // 400자
    const parsed = surveyScaleInputSchema.parse({
      scaleVersionId: "sv1",
      displayModes: ["CUSTOM", "NAME"],
      displayLabel: label,
    });
    expect(parsed.displayLabel).toBe(label);
  });

  it("5000자를 초과하면 거부한다", () => {
    expect(() =>
      surveyScaleInputSchema.parse({
        scaleVersionId: "sv1",
        displayModes: ["CUSTOM"],
        displayLabel: "가".repeat(5001),
      }),
    ).toThrow(/5000자/);
  });
});
