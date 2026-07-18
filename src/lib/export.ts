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
  birthYear: number | null;
  gender: string | null;
  status: string;
  raw: Record<string, number | null>;
  converted: Record<string, number | null>;
  presentedOrder: Record<string, number | null>;
  scaleTotals: Record<string, number | null>;
  subfactorTotals: Record<string, number | null>;
}

interface ExportData {
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
    const subMap = new Map(v.subfactors.map((s) => [s.id, s.name]));
    for (const s of v.subfactors) {
      subfactors.push({ id: s.id, name: s.name, scaleName: v.scale.name });
    }
    for (const q of v.questions) {
      if (!q.isActive) continue;
      questions.push({
        id: q.id,
        code: q.code,
        content: q.content,
        isReverse: q.isReverse,
        subfactorName: q.subfactorId ? subMap.get(q.subfactorId) ?? null : null,
        scaleName: v.scale.name,
        min: q.minScore ?? v.minScore,
        max: q.maxScore ?? v.maxScore,
      });
    }
  }
  questions.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

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

    return {
      respondentId: r.participant.anonymousCode,
      email: r.participant.user?.email ?? null,
      birthYear: r.participant.user?.profile?.birthYear ?? null,
      gender: r.participant.user?.profile?.gender ?? null,
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

// --- Wide 표: 한 행이 한 응답자 -------------------------------------------
function buildWideTable(data: ExportData, opts: ExportOptions): (string | number)[][] {
  const header: string[] = ["respondent_id"];
  if (opts.includePii) header.push("email", "birth_year", "gender");
  header.push("status");

  for (const q of data.questions) {
    const base = colName(q, opts);
    if (opts.includeRaw) header.push(`${base}`);
    if (opts.includeConverted) header.push(`${base}_conv`);
    if (opts.includePresentedOrder) header.push(`${base}_order`);
  }
  if (opts.includeScaleTotals) for (const s of data.scales) header.push(`total_${s.name}`);
  if (opts.includeSubfactorScores) for (const sf of data.subfactors) header.push(`sub_${sf.name}`);

  const rows: (string | number)[][] = [header];
  for (const r of data.rows) {
    const row: (string | number)[] = [r.respondentId];
    if (opts.includePii) row.push(r.email ?? "", r.birthYear ?? "", r.gender ?? "");
    row.push(r.status);
    for (const q of data.questions) {
      if (opts.includeRaw) row.push(r.raw[q.id] ?? "");
      if (opts.includeConverted) row.push(r.converted[q.id] ?? "");
      if (opts.includePresentedOrder) row.push(r.presentedOrder[q.id] ?? "");
    }
    if (opts.includeScaleTotals) for (const s of data.scales) row.push(r.scaleTotals[s.scaleVersionId] ?? "");
    if (opts.includeSubfactorScores) for (const sf of data.subfactors) row.push(r.subfactorTotals[sf.id] ?? "");
    rows.push(row);
  }
  return rows;
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

  const responses = wb.addWorksheet("Responses");
  buildWideTable(data, opts).forEach((row) => responses.addRow(row));

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

  // 헤더 굵게
  for (const ws of wb.worksheets) {
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

  const table = opts.layout === "long" ? buildLongTable(data, opts) : buildWideTable(data, opts);
  return {
    buffer: toCsv(table, opts.useBom),
    filename: `survey_${surveyId}_${stamp}.csv`,
    contentType: "text/csv; charset=utf-8",
  };
}
