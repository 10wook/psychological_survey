import { ResponsesView } from "./ResponsesView";

export default async function ResponsesPage({
  params,
}: {
  params: Promise<{ surveyId: string }>;
}) {
  const { surveyId } = await params;
  return <ResponsesView surveyId={surveyId} />;
}
