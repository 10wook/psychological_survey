import { describe, it, expect } from "vitest";
import { shuffle, buildQuestionOrder, type OrderableQuestion } from "@/lib/shuffle";

describe("shuffle (시드 기반 재현성)", () => {
  it("동일 시드 → 동일 결과 (무작위 순서 재사용)", () => {
    const items = ["a", "b", "c", "d", "e"];
    const s1 = shuffle(items, "seed-123");
    const s2 = shuffle(items, "seed-123");
    expect(s1).toEqual(s2);
  });

  it("다른 시드 → (거의 항상) 다른 결과", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const s1 = shuffle(items, "seed-1");
    const s2 = shuffle(items, "seed-2");
    expect(s1).not.toEqual(s2);
  });

  it("원본 배열을 변형하지 않고 동일 원소 유지", () => {
    const items = ["a", "b", "c"];
    const s = shuffle(items, "x");
    expect(items).toEqual(["a", "b", "c"]);
    expect([...s].sort()).toEqual(["a", "b", "c"]);
  });
});

function q(id: string, order: number, active = true): OrderableQuestion {
  return { id, displayOrder: order, isActive: active };
}

describe("buildQuestionOrder", () => {
  const questions = [q("q3", 3), q("q1", 1), q("q2", 2), q("qX", 4, false)];

  it("셔플 비활성 시 displayOrder 순, 비활성 문항 제외", () => {
    expect(buildQuestionOrder(questions, false)).toEqual(["q1", "q2", "q3"]);
  });

  it("셔플 활성 시 시드 동일하면 순서 재현", () => {
    const o1 = buildQuestionOrder(questions, true, "resp-1");
    const o2 = buildQuestionOrder(questions, true, "resp-1");
    expect(o1).toEqual(o2);
    expect([...o1].sort()).toEqual(["q1", "q2", "q3"]);
  });
});
