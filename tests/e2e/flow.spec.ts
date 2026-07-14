import { test, expect } from "@playwright/test";

// 핵심 시나리오 (문서 12.3 / 15장):
// 응답자 회원가입 → 설문 응답 → 제출 → 결과 확인.
// 전제: seed 로 샘플 설문이 게시되어 있어야 한다. (npm run db:seed)

test("응답자가 회원가입 후 설문에 응답하고 결과를 확인한다", async ({ page }) => {
  const email = `e2e_${Date.now()}@example.com`;

  // 회원가입
  await page.goto("/register");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Test1234!");
  await page.locator("#passwordConfirm").fill("Test1234!");
  // 필수 동의 체크
  await page.getByText("[필수] 개인정보 수집·이용에 동의합니다.").click();
  await page.getByText("[필수] 연구 참여에 동의합니다.").click();
  await page.getByRole("button", { name: "회원가입" }).click();

  // 내 설문 페이지 도달
  await expect(page).toHaveURL(/\/surveys/);

  // 참여 가능한 설문 시작
  await page.getByRole("link", { name: "참여하기" }).first().click();
  await expect(page.getByRole("button", { name: "설문 시작" })).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "설문 시작" }).click();

  // 응답 화면 진입 대기 + 하이드레이션 여유(컨트롤드 라디오 대비)
  await page.waitForURL(/\/respond\//);
  await expect(page.locator('[role="radiogroup"]').first()).toBeVisible();
  await page.waitForTimeout(1500);

  async function answerVisibleQuestions() {
    const groups = page.locator('[role="radiogroup"]');
    const count = await groups.count();
    for (let i = 0; i < count; i++) {
      await groups.nth(i).getByRole("radio").nth(2).check();
    }
    // React 상태 + debounce 자동저장 반영 확인
    await expect(page.getByText("임시 저장됨")).toBeVisible({ timeout: 5000 });
  }

  // 여러 척도가 있을 수 있으므로 다음 버튼이 있으면 계속 진행
  // (샘플은 척도 1개이므로 바로 제출)
  await answerVisibleQuestions();
  const submitBtn = page.getByRole("button", { name: "제출하기" });
  const nextBtn = page.getByRole("button", { name: "다음" });
  while (await nextBtn.isVisible().catch(() => false)) {
    await nextBtn.click();
    await answerVisibleQuestions();
  }
  await submitBtn.click();

  // 완료 화면
  await expect(page.getByText("설문이 완료되었습니다")).toBeVisible();

  // 결과 확인
  await page.getByRole("link", { name: "결과 보기" }).click();
  await expect(page.getByRole("heading", { name: /결과/ })).toBeVisible();
  await expect(page.getByText("총점").first()).toBeVisible();
});
