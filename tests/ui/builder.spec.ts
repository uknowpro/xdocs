import { test, expect } from "@playwright/test";
test("Builder uses the selected sheet and saves a linked evidence note", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "새 시트 테이블", exact: true })
    .click();
  await page.getByLabel("시트 1 A1", { exact: true }).fill("예산");
  await page.getByLabel("시트 1 A2", { exact: true }).fill("1200");
  await page.getByRole("button", { name: "Builder 만들기" }).click();
  await page
    .getByLabel("시트 페이지", { exact: true })
    .selectOption({ label: "새 시트" });
  await page.getByLabel("초과 기준").fill("1000");
  await expect(page.locator(".builder-panel pre").first()).toContainText(
    "시트 1!A2",
  );
  await page.setViewportSize({ width: 1440, height: 1600 });
  await page
    .locator(".builder-panel")
    .screenshot({ path: "test-results/builder.png" });
  await page.getByRole("button", { name: "결과를 하위 노트로 저장" }).click();
  await expect(page.locator(".markdown")).toContainText("1200");
  await page.reload();
  await page.getByRole("button", { name: "새 Builder", exact: true }).click();
  await expect(page.getByLabel("초과 기준")).toHaveValue("1000");
});
test("catalog creates an Azure AVM canvas and exposes the selected module", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
    .click();
  await page.getByLabel("공급자", { exact: true }).selectOption("Azure");
  await page.getByRole("button", { name: "컴포넌트 편집", exact: true }).click();
  await expect(page.getByRole("group", {name:"설계 템플릿"}).getByRole("button")).toHaveCount(3);
  await page.getByLabel("템플릿 검색").fill("no-matching-template");
  await expect(page.getByRole("button", { name: "템플릿으로 시작" })).toBeDisabled();
  await page.getByRole("button", { name: "검색 조건 초기화" }).click();
  await expect(page.getByRole("group", {name:"설계 템플릿"}).getByRole("button")).toHaveCount(30);
  await page.getByRole("button",{name:"AVM 프라이빗 스토리지",exact:true}).click();
  await page.getByRole("button", { name: "템플릿으로 시작" }).click();
  await page.getByRole("button", { name: "Terraform 선언 보기" }).click();
  await expect(page.getByLabel("선택한 Terraform 선언")).toBeFocused();
  await page.getByRole("button", { name: "캔버스에서 보기" }).click();
  await expect(page.getByLabel("컴포넌트 표시 이름")).toBeFocused();
  await expect(page.getByLabel("선택한 Terraform 선언")).toContainText(
    "Azure/avm",
  );
  const list = page.getByLabel("Terraform 선언", { exact: true });
  await list.selectOption({ index: 2 });
  await expect(page.getByLabel("선택한 Terraform 선언")).toContainText(
    "virtualnetwork",
  );
});
test("packaged AWS template opens without network access", async ({ page }) => {
  await page.goto("/");
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
    .click();
  await page.getByRole("button", { name: "Terraform 원본", exact: true }).click();
  await page.getByLabel("템플릿 검색").fill("DynamoDB");
  await expect.poll(() => page.locator(".template-thumbnail img").evaluateAll(
    images => images.filter(i => (i as HTMLImageElement).naturalWidth > 0).length
  )).toBe(3);
  await page.setViewportSize({width:1440,height:1100});
  await page
    .getByRole("dialog")
    .screenshot({ path: "test-results/architecture-catalog.png" });
  await page.getByRole("button",{name:"DynamoDB REST API",exact:true}).click();
  await page.getByRole("button", { name: "템플릿으로 시작" }).click();
  await expect(page.getByLabel("아키텍처 제목")).toHaveValue(
    "AWS · DynamoDB REST API",
  );
  await page.getByLabel("Terraform 파일").selectOption("terraform/main.tf");
  await expect(page.getByLabel("Terraform 코드")).toContainText(
    "aws_dynamodb_table",
  );
});
test("a named harness copy keeps its rules and clears the original note input", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Builder 만들기" }).click();
  await page.getByLabel("하네스 템플릿").selectOption("meeting");
  await page
    .getByLabel("입력 노트", { exact: true })
    .selectOption({ label: "생각이 연결되는 공간" });
  await expect(page.locator(".builder-panel pre").first()).toContainText("L");
  await page.getByText("하네스 공유와 복제", { exact: true }).click();
  await page.getByLabel("사본 이름").fill("운영팀 회의 v1");
  await page.getByRole("button", { name: "워크스페이스에 사본 저장" }).click();
  await expect(page.getByLabel("입력 노트", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("찾을 문구")).toHaveValue("- [ ]");
  await page.getByText("하네스 공유와 복제", { exact: true }).click();
  await expect(page.getByText(/원본 페이지 .* · 버전/)).toBeVisible();
});
test("workspace harness library applies a versioned snapshot", async ({
  page,
}) => {
  await page.goto("/");
  const create = page.getByRole("button", { name: "Builder 만들기" });
  await create.click();
  await page
    .getByLabel("프롬프트", { exact: true })
    .fill("회계팀 검토 기준 v1");
  await page.getByText("하네스 공유와 복제", { exact: true }).click();
  await page.getByLabel("사본 이름").fill("회계팀 검토");
  await page
    .getByRole("button", { name: "워크스페이스 템플릿으로 게시" })
    .click();
  await expect(
    page.getByLabel("워크스페이스 템플릿", { exact: true }),
  ).toBeVisible();
  await create.click();
  await page
    .getByLabel("워크스페이스 템플릿", { exact: true })
    .selectOption({ label: "회계팀 검토" });
  await expect(page.getByLabel("프롬프트", { exact: true })).toHaveValue(
    "회계팀 검토 기준 v1",
  );
});

test("nested network gallery previews match the AWS subnet canvas", async ({ page }) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto("/");
  await page.getByRole("button", {name:"IaCD 아키텍처", exact:true}).click();
  const compute = page.getByRole("button",{name:"서브넷 내 EC2",exact:true});
  await expect(compute.getByAltText("영역형 구성도")).toBeVisible();
  await page.getByLabel("템플릿 검색").fill("Fargate 서비스 검색");
  await expect(page.getByAltText("영역형 구성도")).toBeVisible();
  await page.getByLabel("템플릿 검색").fill("서브넷 내 EC2");
  await compute.click();
  await page.getByRole("button",{name:"템플릿으로 시작"}).click();
  await expect(page.getByLabel("아키텍처 제목")).toHaveValue("AWS · 서브넷 내 EC2");
  const diagram = page.locator(".network-sheet");
  await expect(diagram.locator("[data-scope]")).toHaveCount(3);
  await diagram.screenshot({path:"test-results/aws-subnet-template.png"});
});
