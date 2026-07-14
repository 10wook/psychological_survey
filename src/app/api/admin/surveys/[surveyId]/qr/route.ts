import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { handler, notFound, ok } from "@/lib/http";

type Params = { params: Promise<{ surveyId: string }> };

// 공개 URL 기준 도메인 결정.
// 환경변수가 실제 운영 도메인(비 localhost)이면 우선 사용하고,
// 그렇지 않으면 관리자가 실제 접속 중인 도메인(요청 헤더)을 사용한다.
// -> 배포 시 NEXT_PUBLIC_APP_URL 이 localhost 로 남아 있어도 링크/QR 이 올바른 주소를 가리킨다.
function resolveBaseUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl && !/localhost|127\.0\.0\.1/.test(envUrl)) {
    return envUrl.replace(/\/+$/, "");
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

// QR 코드 생성 (문서 6.7). 설문 공개 URL 을 담은 PNG data URL 반환.
export const GET = handler(async (req: NextRequest, { params }: Params) => {
  await requireStaff();
  const { surveyId } = await params;

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { publicId: true, status: true },
  });
  if (!survey) throw notFound("설문을 찾을 수 없습니다.");

  const base = resolveBaseUrl(req);
  const url = `${base}/s/${survey.publicId}`;
  const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1 });

  return ok({ url, dataUrl });
});
