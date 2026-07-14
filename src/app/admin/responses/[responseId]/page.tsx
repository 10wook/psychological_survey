import { ResponseDetail } from "./ResponseDetail";

export default async function AdminResponseDetailPage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const { responseId } = await params;
  return <ResponseDetail responseId={responseId} />;
}
