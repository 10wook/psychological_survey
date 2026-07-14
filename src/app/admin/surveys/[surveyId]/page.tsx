import { SurveyManager } from "./SurveyManager";

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ surveyId: string }>;
}) {
  const { surveyId } = await params;
  return <SurveyManager surveyId={surveyId} />;
}
