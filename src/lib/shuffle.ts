// ===========================================================================
// 문항 무작위화 (문서 6.8).
// 순서는 설문 시작 시 "한 번만" 생성되어 SurveyResponse 에 저장된다.
// 재현/테스트를 위해 시드 기반 셔플을 제공한다.
// ===========================================================================

/** mulberry32: 결정적 PRNG (시드 동일 → 결과 동일) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher-Yates. seed 를 주면 결정적, 없으면 Math.random 사용 */
export function shuffle<T>(items: T[], seed?: string): T[] {
  const arr = [...items];
  const rand = seed !== undefined ? mulberry32(hashSeed(seed)) : Math.random;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface OrderableQuestion {
  id: string;
  displayOrder: number;
  isActive: boolean;
}

/**
 * 한 척도의 활성 문항 제시 순서를 생성.
 * shuffleEnabled=false 이면 displayOrder 순, true 이면 셔플.
 */
export function buildQuestionOrder(
  questions: OrderableQuestion[],
  shuffleEnabled: boolean,
  seed?: string,
): string[] {
  const active = questions
    .filter((q) => q.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const ordered = shuffleEnabled ? shuffle(active, seed) : active;
  return ordered.map((q) => q.id);
}
