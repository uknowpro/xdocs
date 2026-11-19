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
  await expect(page.locator(".note-list")).toContainText(
    "GitHub Actions 캔버스",
  );
  await page
    .locator(".note-list")
    .getByRole("button", { name: "주간 아이디어", exact: true })
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
  await page
    .locator(".note-list")
    .getByRole("button", { name: "주간 아이디어", exact: true })
    .click();
  await expect(preview).toContainText("카드 7");
  await page.reload();
  await page
    .locator(".note-list")
    .getByRole("button", { name: "주간 아이디어", exact: true })
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
    .locator(".note-list")
    .getByRole("button", { name: "주간 아이디어", exact: true })
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

test("a canvas and nested note share a persistent page tree", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");
  const tree = page.getByRole("navigation", { name: "보관함 페이지" });
  await tree
    .getByRole("button", {
      name: "주간 아이디어 하위 페이지 추가",
      exact: true,
    })
    .click();
  await tree.getByLabel("하위 페이지 유형").selectOption("actions");
  await tree
    .getByRole("button", {
      name: "GitHub Actions 캔버스 하위 페이지 추가",
      exact: true,
    })
    .click();
  await tree.getByLabel("하위 페이지 유형").selectOption("note");
  await page.getByRole("button",{name:"Markdown 원문",exact:true}).click();
  await page
    .getByLabel("노트 본문")
    .fill("# 배포 검토\n\n워크플로 변경 이력을 기록합니다.");
  await expect(page.locator(".save-state")).toContainText("저장됨");
  await page.reload();
  await tree
    .getByRole("button", { name: "주간 아이디어 접기", exact: true })
    .click();
  await expect(
    tree.getByRole("button", { name: "배포 검토", exact: true }),
  ).toHaveCount(0);
  await tree
    .getByRole("button", { name: "주간 아이디어 펼치기", exact: true })
    .click();
  await tree
    .getByRole("button", { name: "GitHub Actions 캔버스 접기", exact: true })
    .click();
  await expect(
    tree.getByRole("button", { name: "배포 검토", exact: true }),
  ).toHaveCount(0);
  await tree
    .getByRole("button", { name: "GitHub Actions 캔버스 펼치기", exact: true })
    .click();
  await tree.getByRole("button", { name: "배포 검토", exact: true }).click();
  await expect(page.locator(".markdown h1")).toHaveText("배포 검토");
  await page
    .getByLabel("캔버스 미리보기 삽입")
    .selectOption({ label: "GitHub Actions 캔버스" });
  await expect(page.locator(".canvas-embed svg")).toBeVisible();
  await expect(page.locator(".save-state")).toContainText("저장됨");
  await page.screenshot({ path: "test-results/canvas-embed.png" });
});
test("move a linked subtree, reorder siblings and undo without changing file paths", async ({
  page,
}) => {
  await page.goto("/");
  const tree = page.getByRole("navigation", { name: "보관함 페이지" });
  const btn = (s: string) => tree.getByRole("button", { name: s, exact: true });
  const title = "주간 아이디어",
    parent = "UI 디자인 원칙";
  const originalPath = await btn(title).getAttribute("title");
  await btn(title + " 하위 페이지 추가").click();
  await tree.getByLabel("하위 페이지 유형").selectOption("actions");
  await expect(
    page.getByRole("heading", { name: "GitHub Actions 캔버스" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await btn(title).dragTo(btn(parent));
  await expect(btn(parent + " 접기")).toBeVisible();
  await btn(parent + " 접기").click();
  await expect(btn(title)).toHaveCount(0);
  await expect(btn("GitHub Actions 캔버스")).toHaveCount(0);
  await btn(parent + " 펼치기").click();
  await btn(title + " 페이지 메뉴").click();
  await expect(
    tree
      .getByLabel("이동할 상위 페이지")
      .locator("option")
      .filter({ hasText: "GitHub Actions 캔버스" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await btn("페이지 이동 실행 취소").click();
  await expect(btn(parent + " 접기")).toHaveCount(0);
  const titles = () => tree.locator(".note-item").allTextContents();
  const order = await titles();
  await btn(title + " 페이지 메뉴").click();
  await tree.getByRole("button", { name: "위로", exact: true }).click();
  await expect
    .poll(async () => (await titles()).indexOf(title))
    .toBeLessThan(order.indexOf(title));
  await page.reload();
  await expect
    .poll(async () => (await titles()).indexOf(title))
    .toBeLessThan(order.indexOf(title));
  await expect(btn(title)).toHaveAttribute("title", originalPath!);
  await btn("GitHub Actions 캔버스").click();
  await expect(
    page.getByRole("heading", { name: "GitHub Actions 캔버스" }),
  ).toBeVisible();
});

test("named folders persist with child folders and pages", async ({ page }) => {
  await page.goto("/");
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  await button("개인 보관함 새 폴더").click();
  await page.getByLabel("폴더 이름", { exact: true }).fill("업무");
  await button("저장").click();
  await button("업무 페이지 메뉴").click();
  await button("하위 페이지 추가").click();
  await page.getByLabel("하위 페이지 유형").selectOption("folder");
  await page.getByLabel("폴더 이름", { exact: true }).fill("설계");
  await button("저장").click();
  await button("설계 페이지 메뉴").click();
  await button("하위 페이지 추가").click();
  await page.getByLabel("하위 페이지 유형").selectOption("sheet");
  await page.getByLabel("페이지 이름").fill("비용표");
  await button("저장").click();
  await button("설계 페이지 메뉴").click();
  await button("폴더 이름 변경").click();
  await page.getByLabel("폴더 이름 변경", { exact: true }).fill("구성도");
  await button("저장").click();
  await expect(button("구성도")).toBeVisible();
  await page.reload();
  await expect(button("비용표")).toBeVisible();
  await button("업무 접기").click();
  await expect(button("구성도")).toHaveCount(0);
  await expect(button("비용표")).toHaveCount(0);
});
