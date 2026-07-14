import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/validation";
import { createSession } from "@/lib/auth";
import { badRequest, conflict, handler, ok } from "@/lib/http";
import { getClientIp } from "@/lib/audit";
import { formatAnonymousCode } from "@/lib/ids";
import type { ConsentType } from "@prisma/client";

export const POST = handler(async (req: NextRequest) => {
  const body = await req.json();
  const input = registerSchema.parse(body);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("이미 사용 중인 이메일입니다.");

  const passwordHash = await hashPassword(input.password);
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent");

  // 필수/선택 동의 구성
  const consents: Array<{ type: ConsentType; agreed: boolean }> = [
    { type: "PRIVACY_COLLECTION", agreed: input.consentPrivacy },
    { type: "RESEARCH_PARTICIPATION", agreed: input.consentResearch },
    { type: "EMAIL_RESULT", agreed: input.consentResultDelivery },
    { type: "PERSONAL_IDENTIFICATION", agreed: input.consentPersonalIdentification },
    { type: "MARKETING", agreed: input.consentMarketing },
  ];

  const user = await prisma.$transaction(async (tx) => {
    // 익명 코드 순번 = 기존 참가자 수 + 1
    const participantCount = await tx.participant.count();
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: "RESPONDENT",
        status: "ACTIVE",
        profile: {
          create: {
            name: input.name,
            birthYear: input.birthYear,
            birthMonth: input.birthMonth,
            birthDay: input.birthDay,
            gender: input.gender,
            phone: input.phone,
          },
        },
        consentRecords: {
          create: consents.map((c) => ({
            consentType: c.type,
            documentVersion: input.documentVersion,
            agreed: c.agreed,
            ipAddress: ip,
            userAgent,
          })),
        },
        participant: {
          create: { anonymousCode: formatAnonymousCode(participantCount + 1) },
        },
      },
    });
    return created;
  });

  await createSession(user.id);
  return ok({ id: user.id, email: user.email, role: user.role }, 201);
});

export const GET = handler(async () => {
  throw badRequest("지원하지 않는 메서드입니다.");
});
