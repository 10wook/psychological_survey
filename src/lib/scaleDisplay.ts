import type { ScaleDisplayMode } from "@prisma/client";

/**
 * 응답자에게 노출할 척도 라벨을 계산한다.
 * - NAME: 척도 제목
 * - DESCRIPTION: 척도 설명(없으면 제목으로 폴백)
 * - CUSTOM: 직접 입력한 라벨(없으면 제목으로 폴백)
 * 블라인드 설문 등에서 실제 척도명이 노출되지 않도록 하기 위함.
 */
export function scaleDisplayLabel(
  mode: ScaleDisplayMode,
  args: { name: string; description?: string | null; displayLabel?: string | null },
): string {
  if (mode === "DESCRIPTION") {
    return args.description?.trim() || args.name;
  }
  if (mode === "CUSTOM") {
    return args.displayLabel?.trim() || args.name;
  }
  return args.name;
}
