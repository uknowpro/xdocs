import { expect, test, type Page } from "@playwright/test";

async function fitsWidth(page: Page, selector: string) {
  const overflowing = await page
    .locator(selector)
    .evaluateAll((elements) =>
      elements
        .filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1)
        .map((e) => e.className),
    );
  expect(overflowing).toEqual([]);
}

test("laptop sidebar stays reachable, remembers its width state and gives the tree one scroll area", async ({
  page,
}) => {
  await page.setViewportSize({ width: 780, height: 600 });
  await page.goto("/");
  const menu = page.locator(".sidebar-switch");
  const main = page.locator("main");
  const tree = page.locator(".page-tree");
  await expect(
    tree.getByRole("button", { name: "주간 아이디어", exact: true }),
  ).toBeVisible();
  expect(await tree.evaluate((e) => e.clientHeight)).toBeGreaterThan(100);
  expect(
    await tree.evaluate((e) => e.scrollHeight - e.clientHeight),
  ).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "새 시트 테이블" }).click();
  expect(
    await page.locator(".sheet-scroll").evaluate((e) => e.clientHeight),
  ).toBeGreaterThan(300);
  await main.evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  await expect(menu).toBeInViewport();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  expect(await main.evaluate((e) => e.clientWidth)).toBe(780);
  await page.reload();
  await expect(menu).toHaveAccessibleName("왼쪽 메뉴 펼치기");
  await menu.click();
  await expect(tree).toBeVisible();
});

test("narrow screens can navigate, read code and reach dialog controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto("/");
  const open = page.getByRole("button", { name: "왼쪽 메뉴 펼치기" });
  await open.click();
  await page.getByRole("button", { name: "환경 설정" }).click();
  await fitsWidth(page, ".dialog");
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await open.click();
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
    .click();
  await fitsWidth(page, ".dialog");
  await page.getByRole("button", { name: "멀티클라우드 예제" }).click();
  await expect(page.locator(".network-sheet")).toBeVisible();
  for (const name of ["AWS 드로잉", "코드 추출", "WAF 검토", "설계"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await fitsWidth(
      page,
      ".main, .arch-toolbar, .arch-editor, .arch-export, .arch-review",
    );
  }
  await open.click();
  await page.keyboard.press("Escape");
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".network-sheet")).toBeVisible();
});
