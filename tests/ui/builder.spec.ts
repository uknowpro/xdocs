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
  await expect(page.getByRole("group", {name:"설계 템플릿"}).getByRole("button")).toHaveCount(1);
  await page.getByLabel("템플릿 검색").fill("no-matching-template");
  await expect(page.getByRole("button", { name: "템플릿으로 시작" })).toBeDisabled();
  await page.getByRole("button", { name: "검색 조건 초기화" }).click();
  await expect(page.getByRole("group", {name:"설계 템플릿"}).getByRole("button")).toHaveCount(30);
  await page.getByRole("button",{name:"AVM · 사업부별 사설 데이터 구역",exact:true}).click();
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
test("packaged multi-cloud VPN case opens without network access", async ({ page }) => {
  await page.goto("/");
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
    .click();
  await page.getByRole("button", { name: "Terraform 원본", exact: true }).click();
  await page.getByLabel("공급자",{exact:true}).selectOption("멀티클라우드");
  await expect.poll(() => page.locator(".template-thumbnail img").evaluateAll(
    images => images.filter(i => (i as HTMLImageElement).naturalWidth > 0).length
  )).toBe(2);
  await page.setViewportSize({width:1440,height:1100});
  await page
    .getByRole("dialog")
    .screenshot({ path: "test-results/architecture-catalog.png" });
  await page.getByRole("button",{name:"AWS ↔ GCP · HA VPN과 BGP",exact:true}).click();
  await page.getByRole("button", { name: "템플릿으로 시작" }).click();
  await expect(page.getByLabel("아키텍처 제목")).toHaveValue(
    "멀티클라우드 · AWS ↔ GCP · HA VPN과 BGP",
  );
  await page.getByLabel("Terraform 파일").selectOption("terraform/aws_vpn.tf");
  await expect(page.getByLabel("Terraform 코드")).toContainText(
    "aws_vpn_connection",
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
  const compute = page.getByRole("button",{name:"결제 서비스 · 격리 복구 리허설",exact:true});
  await expect(compute.getByAltText("영역형 구성도")).toBeVisible();
  await page.getByLabel("템플릿 검색").fill("Fargate 서비스 검색");
  await expect(page.getByAltText("영역형 구성도")).toBeVisible();
  await page.getByLabel("템플릿 검색").fill("결제 서비스 · 격리 복구 리허설");
  await compute.click();
  await page.getByRole("button",{name:"템플릿으로 시작"}).click();
  await expect(page.getByLabel("아키텍처 제목")).toHaveValue("AWS · 결제 서비스 · 격리 복구 리허설");
  const diagram = page.locator(".network-sheet");
  await expect(diagram.locator("[data-scope]")).toHaveCount(11);
  await diagram.screenshot({path:"test-results/aws-subnet-template.png"});
});

test("Analyzer findings become a saved Builder source with both network directions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button",{name:"Analyzer 만들기"}).click();
  await page.getByLabel("기존 분석 JSON 열기").setInputFiles({name:"scan.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({
    project:{},connections:[],findings:["inbound","outbound"].map(direction=>({direction,kind:"route",target:"/orders",file:"Orders.java",line:9,status:"candidate"}))
  }))});
  await expect(page.locator(".analyzer-path")).toHaveCount(2);
  await page.getByRole("button",{name:"보고서를 하위 노트로 저장"}).click();
  await expect(page.locator(".markdown")).toContainText("Orders.java:9");
  await page.getByRole("button",{name:"Builder 만들기"}).click();
  await page.getByLabel("하네스 템플릿").selectOption("network");
  await page.getByLabel("입력 노트",{exact:true}).selectOption({label:"네트워크 분석"});
  await expect(page.locator(".builder-panel pre").first()).toContainText("outbound");
  await expect(page.locator(".builder-panel pre").first()).toContainText("inbound");
});

test("Builder copies a customized step from another page independently", async ({page})=>{
  await page.goto("/");
  const create=page.getByRole("button",{name:"Builder 만들기"});
  await create.click();
  await page.getByLabel("단계 이름").fill("운영 예산");
  await page.getByLabel("초과 기준").fill("2300");
  await page.getByText("하네스 공유와 복제",{exact:true}).click();
  await page.getByLabel("사본 이름").fill("원본 하네스");
  await page.getByRole("button",{name:"워크스페이스에 사본 저장"}).click();
  await create.click();
  await page.getByText("다른 Builder에서 단계 가져오기",{exact:true}).click();
  await page.getByLabel("원본 Builder").selectOption({label:"원본 하네스"});
  await page.getByLabel("추가할 단계").selectOption("0");
  await expect(page.getByLabel("초과 기준").nth(1)).toHaveValue("2300");
  await page.getByRole("button",{name:"아래로",exact:true}).first().click();
  await expect(page.getByLabel("단계 이름").first()).toHaveValue("운영 예산");
});
