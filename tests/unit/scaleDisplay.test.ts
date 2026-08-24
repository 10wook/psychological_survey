import { describe, expect, it } from "vitest";
import { normalizeDisplayModes, scaleDisplayLabel, scaleDisplayParts } from "@/lib/scaleDisplay";

describe("scaleDisplay", () => {
  it("빈 모드는 NAME 으로 폴백", () => {
    expect(normalizeDisplayModes([])).toEqual(["NAME"]);
    expect(normalizeDisplayModes(null)).toEqual(["NAME"]);
  });

  it("복수 모드를 순서대로 조합", () => {
    const parts = scaleDisplayParts(["DESCRIPTION", "NAME", "CUSTOM"], {
      name: "PHQ-9",
      description: "우울 선별",
      displayLabel: "파트 A",
    });
    expect(parts.map((p) => p.text)).toEqual(["PHQ-9", "우울 선별", "파트 A"]);
    expect(scaleDisplayLabel(["NAME", "DESCRIPTION"], {
      name: "PHQ-9",
      description: "우울 선별",
    })).toBe("PHQ-9 · 우울 선별");
  });

  it("설명/커스텀이 비면 생략", () => {
    const parts = scaleDisplayParts(["NAME", "DESCRIPTION", "CUSTOM"], {
      name: "GAD-7",
      description: "  ",
      displayLabel: null,
    });
    expect(parts).toEqual([{ mode: "NAME", text: "GAD-7" }]);
  });

  it("직접 입력(블라인드) 줄바꿈을 유지한다 (이슈 #21)", () => {
    const parts = scaleDisplayParts(["CUSTOM"], {
      name: "숨김",
      displayLabel: "파트 A\n아래 문항에 답하세요.",
    });
    expect(parts).toEqual([
      { mode: "CUSTOM", text: "파트 A\n아래 문항에 답하세요." },
    ]);
  });
});
