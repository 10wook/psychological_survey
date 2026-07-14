import { SiteHeader } from "@/components/SiteHeader";
import { SurveyIntro } from "./SurveyIntro";

export default async function SurveyIntroPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <SurveyIntro publicId={publicId} />
      </main>
    </div>
  );
}
