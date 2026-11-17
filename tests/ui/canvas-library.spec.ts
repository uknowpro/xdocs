import { test, expect } from "@playwright/test";
test("canvas library, linked preview and source edits share one document", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  await page.getByLabel("자동화 캔버스 만들기").selectOption("actions");
  const source =
    "name: Desktop packages\non: workflow_dispatch\njobs:\n  verify:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n      - name: Unit tests\n        run: npm ci && npm test\n  package:\n    needs: verify\n    runs-on: ubuntu-latest\n    steps:\n      - name: Build installer\n        run: npm run dist\n";
  await page.getByRole("button", { name: "전체 원문" }).click();
  await page.getByLabel("캔버스 코드").fill(source);
  await page.getByRole("button", { name: "수정 적용" }).click();
  await page.locator(".arch-node").filter({ hasText: "package" }).click();
  await expect(page.locator(".save-state")).toContainText("저장됨");
  await page.screenshot({ path: "test-results/workflow.png" });
  const library = page.getByLabel("보관함 목록");
  await library.getByRole("button", { name: /노트/ }).click();
  await expect(page.locator(".note-list")).not.toContainText(
    "GitHub Actions 캔버스",
  );
  await page
    .locator(".note-list")
    .getByRole("button", { name: "주간 아이디어" })
    .click();
  await page
    .getByLabel("캔버스 미리보기 삽입")
    .selectOption({ label: "GitHub Actions 캔버스" });
  const preview = page.locator(".canvas-embed");
  await expect(preview).toContainText("카드 5");
  await expect(preview.locator("svg")).toBeVisible();
  await expect(page.locator(".save-state")).toContainText("저장됨");
  await page.screenshot({ path: "test-results/canvas-embed.png" });
  await preview.click();
  await page.getByRole("button", { name: "블록 추가" }).click();
  await library.getByRole("button", { name: /노트/ }).click();
  await page
    .locator(".note-list")
    .getByRole("button", { name: "주간 아이디어" })
    .click();
  await expect(preview).toContainText("카드 7");
  await page.reload();
  await page
    .locator(".note-list")
    .getByRole("button", { name: "주간 아이디어" })
    .click();
  await expect(preview).toContainText("카드 7");
});

test("AWS account drawings preserve edits and render inside a note", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1520, height: 1180 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
    .click();
  await page.getByRole("button", { name: "AWS 백업 드로잉 예제" }).click();
  const paper = page.getByLabel("AWS 구성도");
  await expect(paper.locator("g[data-id]")).toHaveCount(24);
  await expect(page.locator(".save-state")).toContainText("저장됨");
  await page.screenshot({ path: "test-results/aws-drawing.png" });
  await page.getByLabel("선택한 항목").selectOption("source0");
  await page.getByLabel("리전", { exact: true }).fill("서울");
  await page.getByRole("button", { name: "서비스 추가", exact: true }).click();
  await page.getByLabel("표시 이름").fill("Operations vault");
  await page.getByLabel("연결 대상").selectOption("dest0");
  await page.getByRole("button", { name: "방향선 추가" }).click();
  await page.getByLabel("표시 이름").fill("검토 대기");
  await expect(paper).toContainText("검토 대기");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "드로잉 SVG 저장" }).click();
  expect((await download).suggestedFilename()).toBe("aws-architecture.svg");
  await page
    .getByLabel("보관함 목록")
    .getByRole("button", { name: /노트/ })
    .click();
  await page
    .locator(".note-list")
    .getByRole("button", { name: "주간 아이디어" })
    .click();
  await page
    .getByLabel("캔버스 미리보기 삽입")
    .selectOption({ label: "AWS · 계정 간 백업" });
  await expect(page.locator(".canvas-embed svg")).toContainText(
    "Operations vault",
  );
  await page.locator(".canvas-embed").click();
  await expect(paper).toContainText("서울");
});
