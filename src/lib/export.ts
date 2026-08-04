import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import type { ExportOptions } from "@/lib/validation";
import { presentedIndexMap } from "@/lib/questionOrder";

// ===========================================================================
// 데이터 내보내기 (문서 6.16 / 11장). Wide/Long, CSV/XLSX, 코드북.
// ===========================================================================

interface ExportQuestion {
  id: string;
  code: string;
  content: string;
  isReverse: boolean;
  subfactorName: string | null;
  scaleVersionId: string;
  scaleName: string;
  min: number;
  max: number;
}

interface ExportSubfactor {
  id: string;
  name: string;
  scaleName: string;
}

interface ExportScale {
  scaleVersionId: string;
  name: string;
}

interface ExportRow {
  respondentId: string;
  email: string | null;
  age: number | null;
  gender: string | null;
  status: string;
  raw: Record<string, number | null>;
  converted: Record<string, number | null>;
  presentedOrder: Record<string, number | null>;
  scaleTotals: Record<string, number | null>;
  subfactorTotals: Record<string, number | null>;
}

export interface ExportData {
  surveyTitle: string;
  questions: ExportQuestion[];
  subfactors: ExportSubfactor[];
  scales: ExportScale[];
  rows: ExportRow[];
}

async function gatherData(surveyId: string, opts: ExportOptions): Promise<ExportData> {
  const survey = await prisma.survey.findUniqueOrThrow({
    where: { id: surveyId },
    include: {
      surveyScales: {
        orderBy: { displayOrder: "asc" },
        include: {
          scaleVersion: {
            include: { scale: true, subfactors: true, questions: true },
          },
        },
      },
    },
  });

  const questions: ExportQuestion[] = [];
  const subfactors: ExportSubfactor[] = [];
  const scales: ExportScale[] = [];

  for (const ss of survey.surveyScales) {
    const v = ss.scaleVersion;
    scales.push({ scaleVersionId: v.id, name: v.scale.name });
    const orderedSubfactors = [...v.subfactors].sort((a, b) => a.displayOrder - b.displayOrder);
    for (const s of orderedSubfactors) {
      subfactors.push({ id: s.id, name: s.name, scaleName: v.scale.name });
    }
    // 척도명·하위요인 헤더 그룹핑을 위해 하위요인 → 문항 순으로 정렬 (이슈 #12)
    const activeQuestions = v.questions
      .filter((q) => q.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const pushQuestion = (q: (typeof activeQuestions)[number], subfactorName: string | null) => {
      questions.push({
        id: q.id,
        code: q.code,
        content: q.content,
        isReverse: q.isReverse,
        subfactorName,
        scaleVersionId: v.id,
        scaleName: v.scale.name,
        min: q.minScore ?? v.minScore,
        max: q.maxScore ?? v.maxScore,
      });
    };
    for (const s of orderedSubfactors) {
      for (const q of activeQuestions) {
        if (q.subfactorId === s.id) pushQuestion(q, s.name);
      }
    }
    for (const q of activeQuestions) {
      if (!q.subfactorId || !orderedSubfactors.some((s) => s.id === q.subfactorId)) {
        pushQuestion(q, null);
      }
    }
  }

  const responses = await prisma.surveyResponse.findMany({
    where: {
      surveyId,
      ...(opts.onlyCompleted ? { status: "COMPLETED" } : {}),
    },
    orderBy: { startedAt: "asc" },
    include: {
      participant: { include: { user: { include: { profile: true } } } },
      answers: true,
      scaleResults: true,
      subfactorResults: true,
    },
  });

  const rows: ExportRow[] = responses.map((r) => {
    const answerMap = new Map(r.answers.map((a) => [a.questionId, a]));
    const presentedIndex = presentedIndexMap(r.questionOrderJson);

    const raw: Record<string, number | null> = {};
    const converted: Record<string, number | null> = {};
    const presentedOrder: Record<string, number | null> = {};
    for (const q of questions) {
      const a = answerMap.get(q.id);
      raw[q.id] = a?.rawScore ?? null;
      converted[q.id] = a?.convertedScore ?? null;
      presentedOrder[q.id] = presentedIndex.get(q.id) ?? null;
    }

    const scaleTotals: Record<string, number | null> = {};
    for (const sc of scales) {
      const sr = r.scaleResults.find((x) => x.scaleVersionId === sc.scaleVersionId);
      scaleTotals[sc.scaleVersionId] = sr?.convertedTotal ?? null;
    }
    const subfactorTotals: Record<string, number | null> = {};
    for (const sf of subfactors) {
      const sfr = r.subfactorResults.find((x) => x.subfactorId === sf.id);
      subfactorTotals[sf.id] = sfr?.totalScore ?? null;
    }

    // 회원은 프로필, 비회원은 게스트 필드에서 인적 정보를 가져온다.
    const p = r.participant;
    const profile = p.user?.profile ?? null;
    const birthYear = profile?.birthYear ?? p.guestBirthYear ?? null;
    const birthMonth = profile?.birthMonth ?? p.guestBirthMonth ?? null;
    const birthDay = profile?.birthDay ?? p.guestBirthDay ?? null;
    const gender = profile?.gender ?? p.guestGender ?? null;

    return {
      respondentId: p.anonymousCode,
      email: p.user?.email ?? p.guestEmail ?? null,
      age: computeAge(birthYear, birthMonth, birthDay),
      gender: gender ? GENDER_LABEL[gender] ?? gender : null,
      status: r.status,
      raw,
      converted,
      presentedOrder,
      scaleTotals,
      subfactorTotals,
    };
  });

  return { surveyTitle: survey.title, questions, subfactors, scales, rows };
}

function colName(q: ExportQuestion, opts: ExportOptions): string {
  return opts.useQuestionContent ? `${q.code}_${q.content.slice(0, 20)}` : q.code;
}

const GENDER_LABEL: Record<string, string> = {
  MALE: "남",
  FEMALE: "여",
  OTHER: "기타",
  UNDISCLOSED: "무응답",
};

function computeAge(
  year: number | null,
  month: number | null,
  day: number | null,
): number | null {
  if (!year) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  const m = month ?? 1;
  const d = day ?? 1;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

// --- Wide 표: 한 행이 한 응답자 -------------------------------------------
// 3행 헤더 (이슈 #12):
//  1행: Profile | 척도명(문항 열 병합) | 척도 총점 | 하위요인 점수
//  2행: (빈칸)  | 하위요인            | 척도명    | 척도명
//  3행: ID, Age, Gender | 문항 코드   | total_…   | sub_…

/** wide 열 정의. topKey/midKey 가 같은 연속 열은 헤더 1·2행에서 병합된다. */
interface WideColumn {
  top: string;
  mid: string;
  bottom: string;
  topKey: string;
  midKey: string;
  value: (r: ExportRow) => string | number;
}

export interface HeaderMerge {
  row: number; // 1-based
  start: number; // 1-based column
  end: number;
}

function buildWideColumns(data: ExportData, opts: ExportOptions): WideColumn[] {
  const cols: WideColumn[] = [];
  const profile = (bottom: string, value: (r: ExportRow) => string | number) =>
    cols.push({ top: "Profile", mid: "", bottom, topKey: "profile", midKey: "profile", value });

  profile("ID", (r) => r.respondentId);
  profile("Age", (r) => r.age ?? "");
  profile("Gender", (r) => r.gender ?? "");
  if (opts.includePii) profile("Email", (r) => r.email ?? "");
  if (!opts.onlyCompleted) profile("Status", (r) => r.status);

  for (const q of data.questions) {
    const topKey = `scale:${q.scaleVersionId}`;
    const midKey = `${topKey}:sf:${q.subfactorName ?? ""}`;
    const base = colName(q, opts);
    const push = (bottom: string, value: (r: ExportRow) => string | number) =>
      cols.push({ top: q.scaleName, mid: q.subfactorName ?? "", bottom, topKey, midKey, value });
    if (opts.includeRaw) push(base, (r) => r.raw[q.id] ?? "");
    if (opts.includeConverted) push(`${base}_conv`, (r) => r.converted[q.id] ?? "");
    if (opts.includePresentedOrder) push(`${base}_order`, (r) => r.presentedOrder[q.id] ?? "");
  }

  if (opts.includeScaleTotals) {
    for (const s of data.scales) {
      cols.push({
        top: "척도 총점",
        mid: s.name,
        bottom: `total_${s.name}`,
        topKey: "totals",
        midKey: `totals:${s.scaleVersionId}`,
        value: (r) => r.scaleTotals[s.scaleVersionId] ?? "",
      });
    }
  }
  if (opts.includeSubfactorScores) {
    for (const sf of data.subfactors) {
      cols.push({
        top: "하위요인 점수",
        mid: sf.scaleName,
        bottom: `sub_${sf.name}`,
        topKey: "subtotals",
        midKey: `subtotals:${sf.scaleName}`,
        value: (r) => r.subfactorTotals[sf.id] ?? "",
      });
    }
  }
  return cols;
}

export function buildWideTable(
  data: ExportData,
  opts: ExportOptions,
): { table: (string | number)[][]; merges: HeaderMerge[] } {
  const cols = buildWideColumns(data, opts);

  // 그룹의 첫 열에만 라벨을 쓰고 나머지는 빈칸 (CSV에서도 병합처럼 보이게)
  const groupRow = (key: "topKey" | "midKey", label: "top" | "mid") =>
    cols.map((c, i) => (i > 0 && cols[i - 1][key] === c[key] ? "" : c[label]));

  const table: (string | number)[][] = [
    groupRow("topKey", "top"),
    groupRow("midKey", "mid"),
    cols.map((c) => c.bottom),
  ];
  for (const r of data.rows) {
    table.push(cols.map((c) => c.value(r)));
  }

  const merges: HeaderMerge[] = [];
  const collectMerges = (key: "topKey" | "midKey", label: "top" | "mid", row: number) => {
    let start = 0;
    for (let i = 1; i <= cols.length; i++) {
      if (i === cols.length || cols[i]![key] !== cols[start]![key]) {
        if (i - start > 1 && cols[start]![label]) {
          merges.push({ row, start: start + 1, end: i });
        }
        start = i;
      }
    }
  };
  collectMerges("topKey", "top", 1);
  collectMerges("midKey", "mid", 2);

  return { table, merges };
}

// --- Long 표: 한 행이 하나의 문항 응답 -------------------------------------
function buildLongTable(data: ExportData, opts: ExportOptions): (string | number)[][] {
  const header = ["respondent_id", "scale", "question", "raw_score", "converted_score"];
  const rows: (string | number)[][] = [header];
  const qMap = new Map(data.questions.map((q) => [q.id, q]));
  for (const r of data.rows) {
    for (const q of data.questions) {
      const raw = r.raw[q.id];
      if (opts.onlyCompleted && raw === null) continue;
      rows.push([
        r.respondentId,
        qMap.get(q.id)!.scaleName,
        colName(q, opts),
        raw ?? "",
        r.converted[q.id] ?? "",
      ]);
    }
  }
  return rows;
}

function buildCodebook(data: ExportData): (string | number)[][] {
  const header = ["variable", "question_code", "question_text", "scale", "subfactor", "reverse", "min", "max"];
  const rows: (string | number)[][] = [header];
  for (const q of data.questions) {
    rows.push([q.code, q.code, q.content, q.scaleName, q.subfactorName ?? "", q.isReverse ? "Y" : "N", q.min, q.max]);
  }
  return rows;
}

function toCsv(table: (string | number)[][], useBom: boolean): Buffer {
  const escape = (val: string | number) => {
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const body = table.map((row) => row.map(escape).join(",")).join("\r\n");
  const prefix = useBom ? "\uFEFF" : "";
  return Buffer.from(prefix + body, "utf-8");
}

async function toXlsx(data: ExportData, opts: ExportOptions): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Psychology Survey Platform";

  const responses = wb.addWorksheet("Responses", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  const wide = buildWideTable(data, opts);
  wide.table.forEach((row) => responses.addRow(row));
  for (const m of wide.merges) {
    responses.mergeCells(m.row, m.start, m.row, m.end);
  }
  for (const rowNo of [1, 2, 3]) {
    const row = responses.getRow(rowNo);
    row.font = { bold: true };
    row.alignment = { horizontal: "center", vertical: "middle" };
  }

  const answers = wb.addWorksheet("Answers");
  buildLongTable(data, opts).forEach((row) => answers.addRow(row));

  if (opts.includeScaleTotals) {
    const sr = wb.addWorksheet("Scale Results");
    sr.addRow(["respondent_id", ...data.scales.map((s) => s.name)]);
    for (const r of data.rows) {
      sr.addRow([r.respondentId, ...data.scales.map((s) => r.scaleTotals[s.scaleVersionId] ?? "")]);
    }
  }
  if (opts.includeSubfactorScores) {
    const sf = wb.addWorksheet("Subfactor Results");
    sf.addRow(["respondent_id", ...data.subfactors.map((s) => s.name)]);
    for (const r of data.rows) {
      sf.addRow([r.respondentId, ...data.subfactors.map((s) => r.subfactorTotals[s.id] ?? "")]);
    }
  }

  const codebook = wb.addWorksheet("Codebook");
  buildCodebook(data).forEach((row) => codebook.addRow(row));

  // 헤더 굵게 (Responses 시트는 위에서 3행 헤더 처리)
  for (const ws of wb.worksheets) {
    if (ws.name === "Responses") continue;
    ws.getRow(1).font = { bold: true };
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export async function exportSurvey(
  surveyId: string,
  opts: ExportOptions,
): Promise<ExportResult> {
  const data = await gatherData(surveyId, opts);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

  if (opts.format === "xlsx") {
    return {
      buffer: await toXlsx(data, opts),
      filename: `survey_${surveyId}_${stamp}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  const table =
    opts.layout === "long" ? buildLongTable(data, opts) : buildWideTable(data, opts).table;
  return {
    buffer: toCsv(table, opts.useBom),
    filename: `survey_${surveyId}_${stamp}.csv`,
    contentType: "text/csv; charset=utf-8",
  };
}
