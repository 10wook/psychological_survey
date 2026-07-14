import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// 문서 5.16 / 9.1: 관리자 액션 및 개인정보 내보내기 감사 로그.
export interface AuditParams {
  actorUserId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}

export async function writeAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId ?? null,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        action: params.action,
        beforeJson: (params.before ?? undefined) as Prisma.InputJsonValue | undefined,
        afterJson: (params.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (error) {
    // 감사 로그 실패가 본 작업을 막지 않도록 삼킨다 (단 콘솔 기록).
    console.error("[AUDIT_ERROR]", error);
  }
}

export function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}
