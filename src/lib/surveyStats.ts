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

// 기술통계 (문서 6.14). 완료 응답만 대상.
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

export interface SurveyStatistics {
  scaleStats: StatRow[];
  subfactorStats: StatRow[];
  questionStats: QuestionStatRow[];
}

export async function getSurveyStatistics(surveyId: string): Promise<SurveyStatistics> {
  // 완료 응답만
  const completedResponses = await prisma.surveyResponse.findMany({
    where: { surveyId, status: "COMPLETED" },
    include: {
      scaleResults: { include: { scaleVersion: { include: { scale: true } } } },
      subfactorResults: { include: { subfactor: true } },
      answers: { include: { question: true } },
    },
  });

  // 척도별: convertedTotal 모음
  const scaleValues = new Map<string, { label: string; values: number[] }>();
  const subfactorValues = new Map<string, { label: string; values: number[] }>();
  const questionValues = new Map<
    string,
    { code: string; label: string; isReverse: boolean; values: number[]; dist: Record<number, number> }
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
      if (a.convertedScore === null) continue;
      const key = a.questionId;
      const entry =
        questionValues.get(key) ?? {
          code: a.question.code,
          label: a.question.content,
          isReverse: a.question.isReverse,
          values: [],
          dist: {},
        };
      entry.values.push(a.convertedScore);
      if (a.rawScore !== null) {
        entry.dist[a.rawScore] = (entry.dist[a.rawScore] ?? 0) + 1;
      }
      questionValues.set(key, entry);
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

  return { scaleStats, subfactorStats, questionStats };
}
