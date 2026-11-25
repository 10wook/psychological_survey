import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { formatApaCitation } from "@/lib/apaCitation";
import { ArchiveImportButton } from "./ArchiveImportButton";

export const dynamic = "force-dynamic";

export default async function ArchiveScalePage({
  params,
}: {
  params: Promise<{ scaleId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/archive");
  const { scaleId } = await params;

  const scale = await prisma.scale.findUnique({
    where: { id: scaleId },
    include: {
      createdBy: {
        select: { email: true, profile: { select: { name: true } } },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: {
          subfactors: { orderBy: { displayOrder: "asc" } },
          questions: {
            where: { isActive: true },
            orderBy: { displayOrder: "asc" },
            include: { options: { orderBy: { displayOrder: "asc" } } },
          },
        },
      },
    },
  });

  if (!scale) notFound();
  if (!scale.isShared) {
    if (scale.createdById === user.id || user.role === "ADMIN") {
      redirect(`/admin/scales/${scale.id}`);
    }
    notFound();
  }

  const version = scale.versions[0];
  const owner =
    scale.createdBy?.profile?.name || scale.createdBy?.email || "알 수 없음";
  const apa = formatApaCitation(scale);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/archive" className="text-xs text-slate-500 hover:text-slate-800">
            ← 아카이브
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">{scale.name}</h1>
          {scale.description && (
            <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{scale.description}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            공유자 {owner}
            {version && (
              <>
                {" "}
                · v{version.versionNumber} <Badge value={version.status} /> ·{" "}
                {version.questions.length}문항
              </>
            )}
          </p>
        </div>
        <ArchiveImportButton scaleId={scale.id} />
      </div>

      {(scale.instructions || !apa.empty) && (
        <Card className="space-y-3 p-4">
          {scale.instructions && (
            <div>
              <h2 className="text-sm font-semibold text-slate-800">안내문</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                {scale.instructions}
              </p>
            </div>
          )}
          {!apa.empty && (
            <div>
              <h2 className="text-sm font-semibold text-slate-800">출처</h2>
              <p
                className="mt-1 text-sm text-slate-600"
                dangerouslySetInnerHTML={{ __html: apa.html }}
              />
            </div>
          )}
        </Card>
      )}

      {version && version.subfactors.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-800">하위요인</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {version.subfactors.map((sf) => (
              <li key={sf.id}>
                {sf.name}
                {sf.description ? ` — ${sf.description}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {version && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">문항 (읽기 전용)</h2>
          <ol className="space-y-3">
            {version.questions.map((q, i) => (
              <li key={q.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{i + 1}.</span>
                  {q.code && <span className="font-mono">{q.code}</span>}
                  <Badge value={q.type} />
                  {q.isReverse && <span className="text-amber-700">역문항</span>}
                </div>
                <p className="mt-1 text-sm text-slate-800">{q.content}</p>
                {q.options.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                    {q.options.map((o) => (
                      <li key={o.id}>
                        {o.value}: {o.label}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="flex justify-end">
        <ArchiveImportButton scaleId={scale.id} />
      </div>
    </div>
  );
}
