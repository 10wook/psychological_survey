import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation";
import { createSession } from "@/lib/auth";
import { handler, ok, unauthorized } from "@/lib/http";

export const POST = handler(async (req: NextRequest) => {
  const body = await req.json();
  const input = loginSchema.parse(body);

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // 이메일 존재 여부를 노출하지 않기 위해 동일 메시지 사용.
  if (!user || user.status !== "ACTIVE") {
    throw unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(user.id);

  return ok({ id: user.id, email: user.email, role: user.role });
});
