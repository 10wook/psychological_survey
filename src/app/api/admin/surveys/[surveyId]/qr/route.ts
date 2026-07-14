import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";

type Params = { params: Promise<{ surveyId: string }> };

// QR 코드 생성 (문서 6.7). 설문 공개 URL 을 담은 PNG data URL 반환.
export const GET = handler(async (req: NextRequest, { params }: Params) => {
  await requireStaff();
  const { surveyId } = await params;

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { publicId: true, status: true },
  });
  if (!survey) throw notFound("설문을 찾을 수 없습니다.");

  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const url = `${base}/s/${survey.publicId}`;
  const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });

  return ok({ url, dataUrl });
});
