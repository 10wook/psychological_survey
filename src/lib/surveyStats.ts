import { prisma } from "@/lib/db";
import { describe, type DescriptiveStats } from "@/lib/statistics";

// 설문 응답 모니터링 지표 (문서 6.13).
export interface MonitoringStats {
  started: number;
  inProgress: number;
  completed: number;
  abandoned: number;
  completionRate: number | null;
  averageDurationSeconds: number | null;
  targetResponseCount: number | null;
  achievementRate: number | null;
}

export async function getMonitoringStats(surveyId: string): Promise<MonitoringStats> {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { targetResponseCount: true },
  });

  const responses = await prisma.surveyResponse.findMany({
    where: { surveyId },
    select: { status: true, durationSeconds: true },
  });

  const started = responses.length;
  const inProgress = responses.filter((r) => r.status === "IN_PROGRESS").length;
  const completed = responses.filter((r) => r.status === "COMPLETED").length;
  const abandoned = responses.filter((r) => r.status === "ABANDONED").length;

  const durations = responses
    .filter((r) => r.status === "COMPLETED" && r.durationSeconds !== null)
    .map((r) => r.durationSeconds!) as number[];
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  const target = survey?.targetResponseCount ?? null;

  return {
    started,
    inProgress,
    completed,
    abandoned,
    completionRate: started > 0 ? Number(((completed / started) * 100).toFixed(1)) : null,
    averageDurationSeconds: avgDuration,
    targetResponseCount: target,
    achievementRate: target ? Number(((completed / target) * 100).toFixed(1)) : null,
  };
}

export interface StatRow {
  key: string;
  label: string;
  stats: DescriptiveStats;
}

export interface QuestionStatRow extends StatRow {
  code: string;
  isReverse: boolean;
  distribution: Record<number, number>;
}

/** 자유 문항(SINGLE/MULTIPLE/TEXT) 응답 분포 */
export interface FreeQuestionStat {
  questionId: string;
  code: string;
  content: string;
  type: "SINGLE" | "MULTIPLE" | "TEXT";
  responseCount: number;
  /** SINGLE/MULTIPLE: 선택지별 응답 수 */
  optionDistribution?: Array<{ label: string; value: number; count: number }>;
  /** TEXT: 응답 목록 */
  textResponses?: string[];
}

export interface SurveyStatistics {
  scaleStats: StatRow[];
  subfactorStats: StatRow[];
  questionStats: QuestionStatRow[];
  freeQuestionStats: FreeQuestionStat[];
}

export async function getSurveyStatistics(surveyId: string): Promise<SurveyStatistics> {
  const completedResponses = await prisma.surveyResponse.findMany({
    where: { surveyId, status: "COMPLETED" },
    include: {
      scaleResults: { include: { scaleVersion: { include: { scale: true } } } },
      subfactorResults: { include: { subfactor: true } },
      answers: {
        include: {
          question: { include: { options: { orderBy: { displayOrder: "asc" } } } },
        },
      },
    },
  });

  const scaleValues = new Map<string, { label: string; values: number[] }>();
  const subfactorValues = new Map<string, { label: string; values: number[] }>();
  const questionValues = new Map<
    string,
    { code: string; label: string; isReverse: boolean; values: number[]; dist: Record<number, number> }
  >();
  const freeQuestions = new Map<
    string,
    {
      code: string;
      content: string;
      type: "SINGLE" | "MULTIPLE" | "TEXT";
      options: Array<{ label: string; value: number }>;
      singleDist: Record<number, number>;
      multiDist: Record<number, number>;
      texts: string[];
    }
  >();

  for (const resp of completedResponses) {
    for (const sr of resp.scaleResults) {
      const key = sr.scaleVersionId;
      const entry = scaleValues.get(key) ?? {
        label: `${sr.scaleVersion.scale.name} v${sr.scaleVersion.versionNumber}`,
        values: [],
      };
      entry.values.push(sr.convertedTotal);
      scaleValues.set(key, entry);
    }
    for (const sf of resp.subfactorResults) {
      const key = sf.subfactorId;
      const entry = subfactorValues.get(key) ?? { label: sf.subfactor.name, values: [] };
      entry.values.push(sf.totalScore);
      subfactorValues.set(key, entry);
    }
    for (const a of resp.answers) {
      const q = a.question;
      if (q.type === "LIKERT") {
        if (a.convertedScore === null) continue;
        const key = a.questionId;
        const entry =
          questionValues.get(key) ?? {
            code: q.code,
            label: q.content,
            isReverse: q.isReverse,
            values: [],
            dist: {},
          };
        entry.values.push(a.convertedScore);
        if (a.rawScore !== null) {
          entry.dist[a.rawScore] = (entry.dist[a.rawScore] ?? 0) + 1;
        }
        questionValues.set(key, entry);
      } else if (q.type === "SINGLE" || q.type === "MULTIPLE" || q.type === "TEXT") {
        const key = a.questionId;
        const entry = freeQuestions.get(key) ?? {
          code: q.code,
          content: q.content,
          type: q.type as "SINGLE" | "MULTIPLE" | "TEXT",
          options: q.options.map((o) => ({ label: o.label, value: o.value })),
          singleDist: {} as Record<number, number>,
          multiDist: {} as Record<number, number>,
          texts: [] as string[],
        };
        if (q.type === "SINGLE" && a.rawScore !== null) {
          entry.singleDist[a.rawScore] = (entry.singleDist[a.rawScore] ?? 0) + 1;
        }
        if (q.type === "MULTIPLE") {
          for (const v of a.selectedValues) {
            entry.multiDist[v] = (entry.multiDist[v] ?? 0) + 1;
          }
        }
        if (q.type === "TEXT" && a.textValue) {
          entry.texts.push(a.textValue);
        }
        freeQuestions.set(key, entry);
      }
    }
  }

  const scaleStats: StatRow[] = [...scaleValues.entries()].map(([key, v]) => ({
    key,
    label: v.label,
    stats: describe(v.values),
  }));

  const subfactorStats: StatRow[] = [...subfactorValues.entries()].map(([key, v]) => ({
    key,
    label: v.label,
    stats: describe(v.values),
  }));

  const questionStats: QuestionStatRow[] = [...questionValues.entries()].map(([key, v]) => ({
    key,
    code: v.code,
    label: v.label,
    isReverse: v.isReverse,
    stats: describe(v.values),
    distribution: v.dist,
  }));
  questionStats.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const freeQuestionStats: FreeQuestionStat[] = [...freeQuestions.entries()].map(
    ([questionId, v]) => {
      if (v.type === "TEXT") {
        return {
          questionId,
          code: v.code,
          content: v.content,
          type: v.type,
          responseCount: v.texts.length,
          textResponses: v.texts,
        };
      }
      const dist = v.type === "SINGLE" ? v.singleDist : v.multiDist;
      const optionDistribution = v.options.map((o) => ({
        label: o.label,
        value: o.value,
        count: dist[o.value] ?? 0,
      }));
      const responseCount =
        v.type === "SINGLE"
          ? Object.values(v.singleDist).reduce((s, n) => s + n, 0)
          : completedResponses.filter((r) =>
              r.answers.some((a) => a.questionId === questionId && a.selectedValues.length > 0),
            ).length;
      return {
        questionId,
        code: v.code,
        content: v.content,
        type: v.type,
        responseCount,
        optionDistribution,
      };
    },
  );
  freeQuestionStats.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return { scaleStats, subfactorStats, questionStats, freeQuestionStats };
}
