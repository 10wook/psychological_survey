import { describe, it, expect } from "vitest";
import { buildWideTable, buildXlsxSheets, buildStatsTable, buildQuestionsTable, type ExportData } from "@/lib/export";
import { exportOptionsSchema } from "@/lib/validation";

// 이슈 #12: Wide 표 3행 헤더 (Profile/척도명 → 하위요인 → ID·Age·Gender·문항코드)

const data: ExportData = {
  surveyTitle: "테스트 설문",
  scales: [{ scaleVersionId: "sv1", name: "자기자비", maxScore: 5 }],
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
      subfactorId: "sf1",
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
      subfactorId: "sf1",
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
      subfactorId: "sf2",
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
      scaleRawTotals: { sv1: 9 },
      subfactorTotals: { sf1: 7, sf2: 4 },
      subfactorRawTotals: { sf1: 7, sf2: 2 },
    },
    {
      respondentId: "P0002",
      email: "b@b.c",
      age: 30,
      gender: "남",
      status: "COMPLETED",
      raw: { q1: 5, q2: 5, q3: 1 },
      converted: { q1: 5, q2: 5, q3: 5 },
      presentedOrder: { q1: 1, q2: 2, q3: 3 },
      scaleTotals: { sv1: 15 },
      scaleRawTotals: { sv1: 11 },
      subfactorTotals: { sf1: 10, sf2: 5 },
      subfactorRawTotals: { sf1: 10, sf2: 1 },
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
    expect(table[3]?.slice(-3)).toEqual([9, 7, 2]); // 원점수만이면 원점수 총점
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

describe("XLSX 시트 분할 (이슈 #18)", () => {
  const withRaw = exportOptionsSchema.parse({ format: "xlsx", includeRaw: true });
  const withoutRaw = exportOptionsSchema.parse({ format: "xlsx", includeRaw: false });

  it("기본 3시트: 설문 결과 · 기술통계량 · 문항", () => {
    const sheets = buildXlsxSheets(data, withoutRaw);
    expect(sheets.map((s) => s.name)).toEqual(["설문 결과", "기술통계량", "문항"]);
  });

  it("원점수 체크 시에만 4번째 시트 생성", () => {
    const sheets = buildXlsxSheets(data, withRaw);
    expect(sheets.map((s) => s.name)).toEqual(["설문 결과", "기술통계량", "문항", "원점수"]);
  });

  it("설문 결과 시트는 변환점수만 담고 _conv 접미사를 쓰지 않는다", () => {
    const result = buildXlsxSheets(data, withRaw).find((s) => s.name === "설문 결과")!;
    expect(result.table[2]).toEqual([
      "ID",
      "Age",
      "Gender",
      "SCS1",
      "SCS2",
      "SCS3",
      "total_자기자비",
      "sub_자기친절",
      "sub_보편성",
    ]);
    expect(result.table[2]?.some((c) => String(c).endsWith("_conv"))).toBe(false);
    expect(result.table[3]).toEqual(["P0001", 24, "여", 3, 4, 4, 11, 7, 4]);
  });

  it("원점수 시트는 역채점 전 점수와 원점수 총점을 담는다", () => {
    const raw = buildXlsxSheets(data, withRaw).find((s) => s.name === "원점수")!;
    expect(raw.table[3]).toEqual(["P0001", 24, "여", 3, 4, 2, 9, 7, 2]);
  });

  it("기술통계량 시트: 척도·하위요인 행과 N·리커트·평균 등 열", () => {
    const table = buildStatsTable(data);
    expect(table[0]).toEqual([
      "척도",
      "하위요인",
      "N",
      "리커트 척도",
      "평균",
      "표준편차",
      "분산",
      "중앙값",
      "최빈값",
      "왜도",
      "첨도",
    ]);
    // 척도 행: N=2, 5점 척도, 평균 (11+15)/2 = 13
    expect(table[1]?.slice(0, 5)).toEqual(["자기자비", "", 2, 5, 13]);
    expect(table[2]?.[0]).toBe("자기자비");
    expect(table[2]?.[1]).toBe("자기친절");
    expect(table[2]?.[2]).toBe(2);
    expect(table[2]?.[4]).toBe(8.5); // (7+10)/2
    expect(table[3]?.[1]).toBe("보편성");
    expect(table[3]?.[4]).toBe(4.5); // (4+5)/2
  });

  it("문항 시트: 척도명·하위요인·문항코드·문항", () => {
    const table = buildQuestionsTable(data);
    expect(table[0]).toEqual(["척도명", "하위요인", "문항코드", "문항"]);
    expect(table[1]).toEqual(["자기자비", "자기친절", "SCS1", "문항 1"]);
    expect(table[2]).toEqual(["자기자비", "자기친절", "SCS2", "문항 2"]);
    expect(table[3]).toEqual(["자기자비", "보편성", "SCS3", "문항 3"]);
  });
});
