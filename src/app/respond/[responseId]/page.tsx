import { RespondForm } from "./RespondForm";

export default async function RespondPage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const { responseId } = await params;
  return <RespondForm responseId={responseId} />;
}
