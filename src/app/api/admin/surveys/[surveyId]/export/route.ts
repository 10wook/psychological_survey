import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { canViewPii, requireStaff } from "@/lib/auth";
import { forbidden, notFound } from "@/lib/http";
import { exportOptionsSchema } from "@/lib/validation";
import { exportSurvey } from "@/lib/export";
import { writeAudit, getClientIp } from "@/lib/audit";

type Params = { params: Promise<{ surveyId: string }> };

// 내보내기 (문서 6.16 / 11장). 파일 스트림 반환. 개인정보 포함 시 감사 로그.
export async function POST(req: NextRequest, ctx: Params) {
  try {
    const user = await requireStaff();
    const { surveyId } = await ctx.params;

    const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw notFound("설문을 찾을 수 없습니다.");

    const opts = exportOptionsSchema.parse(await req.json());

    // 개인정보 포함은 권한 있는 관리자만 (문서 11.2)
    if (opts.includePii && !canViewPii(user)) {
      throw forbidden("개인정보 포함 내보내기 권한이 없습니다.");
    }

    const result = await exportSurvey(surveyId, opts);

    // 개인정보 포함 내보내기 감사 로그 (문서 9.1 / 11.2)
    await writeAudit({
      actorUserId: user.id,
      entityType: "Survey",
      entityId: surveyId,
      action: opts.includePii ? "EXPORT_WITH_PII" : "EXPORT",
      after: { format: opts.format, layout: opts.layout, includePii: opts.includePii },
      ipAddress: getClientIp(req),
    });

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    const { fail } = await import("@/lib/http");
    return fail(error);
  }
}
