import { SiteHeader } from "@/components/SiteHeader";
import { ResultView } from "./ResultView";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const { responseId } = await params;
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <ResultView responseId={responseId} />
      </main>
    </div>
  );
}
