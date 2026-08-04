import { describe, it, expect } from "vitest";
import { buildWideTable, type ExportData } from "@/lib/export";
import { exportOptionsSchema } from "@/lib/validation";

// 이슈 #12: Wide 표 3행 헤더 (Profile/척도명 → 하위요인 → ID·Age·Gender·문항코드)

const data: ExportData = {
  surveyTitle: "테스트 설문",
  scales: [{ scaleVersionId: "sv1", name: "자기자비" }],
  subfactors: [
    { id: "sf1", name: "자기친절", scaleName: "자기자비" },
    { id: "sf2", name: "보편성", scaleName: "자기자비" },
  ],
  questions: [
    {
      id: "q1",
      code: "SCS1",
      content: "문항 1",
      isReverse: false,
      subfactorName: "자기친절",
      scaleVersionId: "sv1",
      scaleName: "자기자비",
      min: 1,
      max: 5,
    },
    {
      id: "q2",
      code: "SCS2",
      content: "문항 2",
      isReverse: false,
      subfactorName: "자기친절",
      scaleVersionId: "sv1",
      scaleName: "자기자비",
      min: 1,
      max: 5,
    },
    {
      id: "q3",
      code: "SCS3",
      content: "문항 3",
      isReverse: true,
      subfactorName: "보편성",
      scaleVersionId: "sv1",
      scaleName: "자기자비",
      min: 1,
      max: 5,
    },
  ],
  rows: [
    {
      respondentId: "P0001",
      email: "a@b.c",
      age: 24,
      gender: "여",
      status: "COMPLETED",
      raw: { q1: 3, q2: 4, q3: 2 },
      converted: { q1: 3, q2: 4, q3: 4 },
      presentedOrder: { q1: 1, q2: 2, q3: 3 },
      scaleTotals: { sv1: 11 },
      subfactorTotals: { sf1: 7, sf2: 4 },
    },
  ],
};

describe("buildWideTable (이슈 #12 3행 헤더)", () => {
  const opts = exportOptionsSchema.parse({
    includeConverted: false,
    includeScaleTotals: false,
    includeSubfactorScores: false,
  });

  it("1행: Profile 라벨 + 척도명 (그룹 첫 열에만 표기)", () => {
    const { table } = buildWideTable(data, opts);
    expect(table[0]).toEqual(["Profile", "", "", "자기자비", "", ""]);
  });

  it("2행: Profile 빈칸 + 하위요인", () => {
    const { table } = buildWideTable(data, opts);
    expect(table[1]).toEqual(["", "", "", "자기친절", "", "보편성"]);
  });

  it("3행: ID·Age·Gender + 문항 코드", () => {
    const { table } = buildWideTable(data, opts);
    expect(table[2]).toEqual(["ID", "Age", "Gender", "SCS1", "SCS2", "SCS3"]);
  });

  it("4행부터 응답 데이터", () => {
    const { table } = buildWideTable(data, opts);
    expect(table[3]).toEqual(["P0001", 24, "여", 3, 4, 2]);
  });

  it("헤더 병합 범위: 척도명(1행)과 하위요인(2행)", () => {
    const { merges } = buildWideTable(data, opts);
    expect(merges).toContainEqual({ row: 1, start: 1, end: 3 }); // Profile
    expect(merges).toContainEqual({ row: 1, start: 4, end: 6 }); // 자기자비
    expect(merges).toContainEqual({ row: 2, start: 4, end: 5 }); // 자기친절
  });

  it("총점·하위요인 점수 열은 그룹 헤더 아래에 배치", () => {
    const full = exportOptionsSchema.parse({ includeConverted: false });
    const { table } = buildWideTable(data, full);
    expect(table[0]).toContain("척도 총점");
    expect(table[0]).toContain("하위요인 점수");
    expect(table[2]).toContain("total_자기자비");
    expect(table[2]).toContain("sub_자기친절");
    expect(table[3]?.slice(-3)).toEqual([11, 7, 4]);
  });

  it("PII 포함 시 Email 열 추가, 미완료 포함 시 Status 열 추가", () => {
    const piiOpts = exportOptionsSchema.parse({
      includePii: true,
      onlyCompleted: false,
      includeConverted: false,
      includeScaleTotals: false,
      includeSubfactorScores: false,
    });
    const { table } = buildWideTable(data, piiOpts);
    expect(table[2]?.slice(0, 5)).toEqual(["ID", "Age", "Gender", "Email", "Status"]);
    expect(table[3]?.slice(0, 5)).toEqual(["P0001", 24, "여", "a@b.c", "COMPLETED"]);
  });
});
