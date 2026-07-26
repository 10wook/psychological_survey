import type { ScaleDisplayMode } from "@prisma/client";

export type ScaleDisplayArgs = {
  name: string;
  description?: string | null;
  displayLabel?: string | null;
};

const MODE_ORDER: ScaleDisplayMode[] = ["NAME", "DESCRIPTION", "CUSTOM"];

/** displayModes 배열을 정규화한다. 비어 있으면 NAME 으로 폴백. */
export function normalizeDisplayModes(
  modes: ScaleDisplayMode[] | null | undefined,
): ScaleDisplayMode[] {
  const unique = MODE_ORDER.filter((m) => (modes ?? []).includes(m));
  return unique.length > 0 ? unique : ["NAME"];
}

/**
 * 응답자에게 노출할 척도 소개 파트들을 계산한다.
 * - NAME: 척도 제목
 * - DESCRIPTION: 척도 설명(없으면 생략)
 * - CUSTOM: 직접 입력 라벨(없으면 생략)
 */
export function scaleDisplayParts(
  modes: ScaleDisplayMode[] | null | undefined,
  args: ScaleDisplayArgs,
): { mode: ScaleDisplayMode; text: string }[] {
  const parts: { mode: ScaleDisplayMode; text: string }[] = [];
  for (const mode of normalizeDisplayModes(modes)) {
    if (mode === "NAME") {
      parts.push({ mode, text: args.name });
    } else if (mode === "DESCRIPTION") {
      const text = args.description?.trim();
      if (text) parts.push({ mode, text });
    } else if (mode === "CUSTOM") {
      const text = args.displayLabel?.trim();
      if (text) parts.push({ mode, text });
    }
  }
  if (parts.length === 0) parts.push({ mode: "NAME", text: args.name });
  return parts;
}

/**
 * 응답자에게 노출할 척도 라벨 문자열.
 * 복수 모드면 " · " 로 이어 붙인다.
 */
export function scaleDisplayLabel(
  modes: ScaleDisplayMode[] | ScaleDisplayMode | null | undefined,
  args: ScaleDisplayArgs,
): string {
  const list = Array.isArray(modes) ? modes : modes ? [modes] : [];
  return scaleDisplayParts(list, args)
    .map((p) => p.text)
    .join(" · ");
}
