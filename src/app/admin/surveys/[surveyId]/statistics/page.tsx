import { StatisticsView } from "./StatisticsView";

export default async function StatisticsPage({
  params,
}: {
  params: Promise<{ surveyId: string }>;
}) {
  const { surveyId } = await params;
  return <StatisticsView surveyId={surveyId} />;
}
