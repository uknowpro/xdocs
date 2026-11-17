import { test, expect } from "@playwright/test";
test("themes persist, notes save, search and graph navigate", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".markdown h1")).toHaveText("생각이 연결되는 공간");
  await page.getByRole("button", { name: "환경 설정" }).click();
  await page.getByRole("button", { name: "다크", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "새 노트", exact: true }).click();
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .fill("# 테스트 노트\n\n한글 저장 확인 [[UI 디자인 원칙]]");
  await expect(page.locator(".save-state")).toContainText("브라우저에 저장됨");
  await page.reload();
  await page.getByRole("button", { name: "빠른 검색" }).click();
  await page.getByRole("textbox", { name: "빠른 검색" }).fill("한글 저장 확인");
  await page.locator(".search-results button").click();
  await expect(page.locator(".markdown h1")).toHaveText("테스트 노트");
  await page.getByRole("button", { name: "지식 그래프" }).click();
  await page
    .locator(".graph:not(.compact)")
    .getByRole("button", { name: "UI 디자인 원칙", exact: true })
    .click();
  await page.getByRole("button", { name: "노트 열기" }).click();
  await expect(page.locator(".markdown h1")).toHaveText("UI 디자인 원칙");
});
test("untrusted Markdown cannot execute scripts or navigate away", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "편집하기" }).click();
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .fill(
      '# 보안 확인\n\n<img src=x onerror="window.pwned=true"><script>window.pwned=true</script>\n\n[실행](javascript:alert(1))',
    );
  await page.getByRole("button", { name: "읽기 모드" }).click();
  await expect(page.locator(".markdown script,.markdown img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).pwned)).toBeUndefined();
});
test("desktop sized light, gray and dark screens have no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  for (const [label, value] of [
    ["화이트", "light"],
    ["그레이", "gray"],
    ["다크", "dark"],
  ]) {
    await page.getByRole("button", { name: "환경 설정" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: label, exact: true })
      .click();
    await page.getByRole("button", { name: "설정 닫기" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", value);
    await page.screenshot({
      path: `test-results/${value}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
