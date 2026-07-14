import { ScaleEditor } from "./ScaleEditor";

export default async function ScaleDetailPage({
  params,
}: {
  params: Promise<{ scaleId: string }>;
}) {
  const { scaleId } = await params;
  return <ScaleEditor scaleId={scaleId} />;
}
