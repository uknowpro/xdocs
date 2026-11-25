import { test, expect } from "@playwright/test";

test("environment settings group workspace, organization, and app information", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto("/");
  await page.getByRole("button", { name: "환경 설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "환경 설정" });
  const category = dialog.getByRole("navigation", { name: "환경 설정 항목" });
  await expect(dialog.getByRole("heading", { name: "화면 테마" })).toBeVisible();
  await category.getByRole("button", { name: "워크스페이스", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "워크스페이스" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "폴더 변경" })).toBeVisible();
  await category.getByRole("button", { name: "앱 정보", exact: true }).click();
  await dialog.getByRole("button", { name: "라이선스 정보", exact: true }).click();
  const license = page.getByRole("dialog").filter({ hasText: "PolyForm" });
  await expect(license).toBeVisible();
  await license.getByRole("button", { name: "환경 설정", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "라이선스 정보", exact: true })).toBeFocused();
  await category.getByRole("button", { name: "조직 연결", exact: true }).click();
  await dialog.getByRole("button", { name: "연결 관리" }).click();
  const organization = page.getByRole("dialog", { name: "조직 연결", exact: true });
  await expect(organization.getByRole("list", { name: "조직 연결 단계" }).locator('[aria-current="step"]')).toHaveText("서버");
  await expect(organization.getByRole("button", { name: "브라우저에서 SSO 로그인" })).toBeVisible();
});

test("xcode keeps an edit draft separate from the saved session and cancels it", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto("/");
  const button = (name: string) => page.getByRole("button", { name, exact: true });
  await button("새로 만들기").click();
  await button("xcode 세션 만들기").click();
  await button("세션 설정 펼치기").click();
  const model = page.getByLabel("모델명", { exact: true });
  const original = await model.inputValue();
  await model.fill("edited-only");
  await expect(page.locator(".chat-header")).toContainText(original);
  await expect(page.locator(".chat-header")).not.toContainText("edited-only");
  await expect(page.getByText("저장하지 않은 변경", { exact: true })).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "세션 설정 항목" });
  await tabs.getByRole("button", { name: "자동 요청", exact: true }).click();
  await expect(page.getByLabel("재요청 간격(초)")).toBeHidden();
  const retry = page.getByRole("checkbox", { name: "자동 재요청 켜기" });
  const verticalOffset = await retry.evaluate((input: HTMLInputElement) => {
    const checkbox = input.getBoundingClientRect();
    const label = input.labels![0].getBoundingClientRect();
    return Math.abs(checkbox.top + checkbox.height / 2 - label.top - label.height / 2);
  });
  expect(verticalOffset).toBeLessThan(2);
  await retry.check();
  await expect(page.getByLabel("재요청 간격(초)")).toBeVisible();
  await button("설정 취소").click();
  await button("세션 설정 펼치기").click();
  await expect(model).toHaveValue(original);
  await tabs.getByRole("button", { name: "자동 요청", exact: true }).click();
  await expect(page.getByLabel("자동 재요청 켜기")).not.toBeChecked();
  await tabs.getByRole("button", { name: "연결", exact: true }).click();
  await model.fill("saved-after-click");
  await button("설정 저장").click();
  await expect(page.locator(".chat-header")).toContainText("saved-after-click");
  await expect(page.getByLabel("xcode 메시지")).toBeFocused();
});

test("Analyzer reports the source and versions from the analysis result", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "Analyzer 만들기" }).click();
  await page.getByLabel("분석 대상").selectOption("helm-network");
  await expect(page.getByLabel("목표 Kubernetes 버전")).toBeHidden();
  await expect(page.getByText(/Helm 렌더링 옵션/)).toBeVisible();
  await page.getByLabel("기존 분석 JSON 열기").setInputFiles({
    name: "fixture-upgrade.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ kind: "upgrade", from: "1.29", to: "1.31", report: { target_version: "1.31", findings: [] } })),
  });
  const summary = page.locator('[aria-label="실행 당시 분석 설정"]');
  await expect(summary).toContainText("fixture-upgrade.json");
  await expect(summary).toContainText("1.29 → 1.31");
});
