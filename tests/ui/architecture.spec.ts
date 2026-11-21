import { test, expect } from "@playwright/test";
test("IaCD canvas edits, moves, connects, undoes and preserves WAF notes with code preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page
    .getByRole("button", { name: "xinfra 캔버스", exact: true })
    .click();
  await page
    .getByRole("button", { name: "멀티클라우드 예제", exact: true })
    .click();
  await expect(page.getByLabel("아키텍처 제목")).toHaveValue(
    "멀티클라우드 · 웹 서비스",
  );
  await expect(page.getByLabel("클라우드 경계 도면")).toContainText(
    "Application EC2",
  );
  await page.getByRole("button", { name: "자유 배치·참조선" }).click();
  const vpc = page.getByRole("button", { name: "컴포넌트 VPC", exact: true });
  const before = await vpc.boundingBox();
  await vpc.hover();
  await page.mouse.down();
  await page.mouse.move(before!.x + 140, before!.y + 90, { steps: 5 });
  await page.mouse.up();
  await expect(vpc).not.toHaveCSS("left", "60px");
  await page
    .getByRole("button", { name: "아키텍처 실행 취소", exact: true })
    .click();
  await expect(vpc).toHaveCSS("left", "60px");
  await page
    .getByRole("combobox", { name: "컴포넌트 공급자" })
    .selectOption("AWS");
  await page
    .locator(".arch-palette")
    .getByRole("button", { name: "EC2 AWS" })
    .click();
  await page
    .getByRole("textbox", { name: "AMI ID", exact: true })
    .fill("ami-0123456789abcdef0");
  await page
    .getByRole("button", { name: "대상 클릭으로 연결", exact: true })
    .click();
  await page
    .getByRole("button", { name: "컴포넌트 Subnet", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Subnet", exact: true }),
  ).not.toHaveValue("");
  await page.getByRole("button", { name: "코드 추출", exact: true }).click();
  await expect(page.getByLabel("생성 코드")).toContainText("aws_instance");
  await expect(
    page.getByRole("button", { name: "코드 ZIP 내보내기" }),
  ).toBeEnabled();
  await page
    .getByRole("combobox", { name: "아키텍처 추출 형식" })
    .selectOption("cloudformation");
  await page
    .getByRole("button", { name: "cloudformation/template.json", exact: true })
    .click();
  await expect(page.getByLabel("생성 코드")).toContainText(
    "AWS::EC2::Instance",
  );
  await page
    .getByRole("combobox", { name: "아키텍처 추출 형식" })
    .selectOption("helm");
  await page
    .getByRole("button", { name: "chart/values.yaml", exact: true })
    .click();
  await expect(page.getByLabel("생성 코드")).toContainText("Deployment");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "코드 ZIP 내보내기" }).click();
  expect((await download).suggestedFilename()).toBe("xdocs-architecture.zip");
  await page.getByRole("button", { name: "WAF 검토", exact: true }).click();
  await page
    .getByRole("textbox", { name: "신뢰성 검토 기록" })
    .fill("RTO 1시간 · 복구 훈련 예정");
  await expect(page.locator(".save-state")).toContainText("브라우저에 저장됨");
  await page.reload();
  await page
    .getByRole("button", { name: "멀티클라우드 · 웹 서비스", exact: true })
    .click();
  await page.getByRole("button", { name: "WAF 검토", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "신뢰성 검토 기록" }),
  ).toHaveValue("RTO 1시간 · 복구 훈련 예정");
  await page.getByRole("button", { name: "설계", exact: true }).click();
  await page.getByRole("button", { name: "컴포넌트 VPC", exact: true }).click();
  await page.getByRole("button", { name: "자유 배치·참조선" }).click();
  await page.getByRole("button", { name: "정렬", exact: true }).click();
  await page.getByRole("button", { name: "경계 도면", exact: true }).click();
  await expect(page.locator(".save-state")).toContainText("브라우저에 저장됨");
  await page.getByLabel("선택 리소스 참조선").check();
  for (const theme of ["light", "gray", "dark"]) {
    await page.evaluate(
      (t) => (document.documentElement.dataset.theme = t),
      theme,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/iacd-" + theme + ".png",
      fullPage: true,
    });
  }
});
test("Invalid architecture blocks export until required connection is supplied", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page
    .getByRole("button", { name: "xinfra 캔버스", exact: true })
    .click();
  await page.getByRole("button", { name: "빈 캔버스", exact: true }).click();
  await page
    .getByRole("combobox", { name: "컴포넌트 공급자" })
    .selectOption("Kubernetes");
  await page
    .locator(".arch-palette")
    .getByRole("button", { name: "Service Kubernetes", exact: true })
    .click();
  await page.getByRole("button", { name: "코드 추출", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "코드 ZIP 내보내기" }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("Deployment");
});
test("dropping a compute instance into another subnet changes membership", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page
    .getByRole("button", { name: "xinfra 캔버스", exact: true })
    .click();
  await page.getByRole("button", { name: "멀티클라우드 예제" }).click();
  await page.getByLabel("컴포넌트 공급자").selectOption("AWS");
  await page
    .locator(".arch-palette")
    .getByRole("button", { name: "Subnet AWS", exact: true })
    .click();
  const title = page.locator(".arch-properties input").first();
  await title.fill("Second subnet");
  const ec2 = page.getByRole("button", {
      name: "컴포넌트 Application EC2",
      exact: true,
    }),
    second = page.getByRole("button", {
      name: "컴포넌트 Second subnet",
      exact: true,
    });
  await expect(second).toBeVisible();
  const expected = await second.getAttribute("data-scope");
  await ec2.dragTo(second);
  await expect(
    page.getByRole("combobox", { name: "Subnet", exact: true }),
  ).toHaveValue(expected!);
  await page
    .getByRole("button", { name: "아키텍처 실행 취소", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Subnet", exact: true }),
  ).not.toHaveValue(expected!);
});
test("selected references and generated IaC reflect the same subnet move", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 1080 });
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page
    .getByRole("button", { name: "xinfra 캔버스", exact: true })
    .click();
  await page.getByRole("button", { name: "멀티클라우드 예제" }).click();
  await page.getByLabel("컴포넌트 공급자").selectOption("AWS");
  await page
    .locator(".arch-palette")
    .getByRole("button", { name: "Subnet AWS", exact: true })
    .click();
  await page
    .locator(".arch-properties input")
    .first()
    .fill("Destination subnet");
  await page
    .getByRole("textbox", { name: "이름", exact: true })
    .fill("destination");
  const vpc = await page
    .getByRole("button", { name: "컴포넌트 VPC", exact: true })
    .getAttribute("data-scope");
  await page
    .getByRole("combobox", { name: "VPC", exact: true })
    .selectOption(vpc!);
  await page
    .getByRole("textbox", { name: "CIDR", exact: true })
    .fill("10.0.2.0/24");
  const code = page.getByRole("button", { name: "코드 추출", exact: true });
  await code.click();
  await page
    .getByRole("button", { name: "IaC 변경 비교", exact: true })
    .click();
  await page.getByRole("button", { name: "현재 설계를 기준으로 지정" }).click();
  await expect(page.getByText("생성된 IaC에 변경이 없습니다.")).toBeVisible();
  await page.getByRole("button", { name: "설계", exact: true }).click();
  const ec2 = page.getByRole("button", {
      name: "컴포넌트 Application EC2",
      exact: true,
    }),
    sub = page.getByRole("button", {
      name: "컴포넌트 Destination subnet",
      exact: true,
    });
  await ec2.dragTo(sub);
  const move = page.getByLabel("배치 변경과 Terraform 차이");
  await expect(move.locator("ins")).toHaveText("Destination subnet");
  await expect(move.locator("pre")).toContainText("subnet_id");
  const impact = page.locator(".impact-body");
  await expect(impact).toContainText("참조 변경");
  await expect(impact).toContainText("연결 · Application EC2 → Destination subnet");
  await impact.getByRole("button",{name:"terraform/main.tf.json",exact:true}).click();
  await expect(page.locator(".terraform-live .live-added").filter({hasText:"subnet_id"})).toHaveCount(1);
  await page.getByRole("button",{name:"아키텍처 실행 취소"}).click();
  await expect(impact).not.toContainText("연결 · Application EC2 → Destination subnet");
  await expect(move).toHaveCount(0);
  await ec2.dragTo(sub);
  await page.getByLabel("선택 리소스 참조선").check();
  await expect(page.locator("[data-reference]")).toHaveCount(1);
  await expect(
    page.getByLabel("선택 리소스 참조", { exact: true }),
  ).toContainText("Application EC2 → Destination subnet");
  await code.click();
  await page.getByLabel("변경 파일").selectOption("terraform/main.tf.json");
  await expect(page.getByLabel("IaC 변경 내용")).toContainText("subnet_id");
  await page
    .getByLabel("변경 파일")
    .selectOption("cloudformation/template.json");
  await expect(page.getByLabel("IaC 변경 내용")).toContainText("SubnetId");
  await page.getByLabel("IaC 변경 내용").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/iac-changes.png" });
});

test("boundary view edits preserve IaC and collapse nested resources", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page
    .getByRole("button", { name: "xinfra 캔버스", exact: true })
    .click();
  await page.getByRole("button", { name: "멀티클라우드 예제" }).click();
  const resource = (name: string) =>
    page.getByRole("button", { name: "컴포넌트 " + name, exact: true });
  await resource("Application EC2").click();
  await page.getByLabel("선택 리소스 참조선").check();
  const path = page.locator("[data-reference]").first();
  const before = await path.getAttribute("d");
  await page.getByLabel("시작 연결점").first().selectOption("top");
  await expect(path).not.toHaveAttribute("d", before!);
  const bend = page.locator("[data-bend]").first();
  const x = await bend.getAttribute("cx");
  await bend.hover();
  const box = await bend.boundingBox();
  await page.mouse.down();
  await page.mouse.move(box!.x - 15, box!.y + 10, { steps: 4 });
  await page.mouse.up();
  await expect(bend).not.toHaveAttribute("cx", x!);
  await page.getByRole("button", { name: "배치 잠금", exact: true }).click();
  await expect(page.locator("[data-reconnect]")).toHaveCount(0);
  await page.getByRole("textbox", { name: "운영 주석" }).fill("회계 서비스");
  await resource("Subnet").click();
  await page.getByRole("button", { name: "경계 접기" }).click();
  await expect(resource("Application EC2")).toHaveCount(0);
  await page.getByRole("button", { name: "경계 펼치기" }).click();
  await resource("Application EC2").click();
  await expect(page.getByRole("textbox", { name: "운영 주석" })).toHaveValue(
    "회계 서비스",
  );
  await page.getByRole("button", { name: "코드 추출", exact: true }).click();
  await page
    .getByRole("button", { name: "IaC 변경 비교", exact: true })
    .click();
  await expect(page.getByText("생성된 IaC에 변경이 없습니다.")).toBeVisible();
});

test("WAF compares local module inputs and outputs and clears invalid results", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "xinfra 캔버스", exact: true }).click();
  await page.getByRole("button", { name: "멀티클라우드 예제" }).click();
  await page.getByRole("button", { name: "WAF 검토" }).click();
  await page.getByText("AVM · Terraform 모듈 버전 비교").click();
  const upload = (label: string, doc: unknown) => page.getByLabel(label).setInputFiles({
    name: "module.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(doc)),
  });
  await upload("현재 버전 JSON", {inputs:[{name:"zone", type:"string", required:false}], outputs:[{name:"old_id"}]});
  await upload("후보 버전 JSON", {inputs:[{name:"zone", type:"number", required:true}], outputs:[]});
  await expect(page.getByText("입출력 선언 변경 3건")).toBeVisible();
  await expect(page.getByText("출력 삭제 · old_id")).toBeVisible();
  await upload("후보 버전 JSON", { inputs: [] });
  await expect(page.locator(".module-contract [role=alert]")).toBeVisible();
  await expect(page.locator(".module-contract li")).toHaveCount(0);
});

test("review a live Terraform edit beside the canvas and follow incoming references", async ({ page, context }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const button = (name: string) => page.getByRole("button", { name, exact: true });
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await button("xinfra 캔버스").click();
  const gallery = page.getByRole("group", { name: "설계 템플릿" });
  const total = await gallery.getByRole("button").count();
  await button("구성도 확대 미리보기").click();
  await expect(page.locator(".catalog-large-preview img")).toBeVisible();
  await expect(page.locator(".catalog-large-preview")).toContainText("ap-northeast-2");
  await page.getByRole("slider",{name:/배율/}).press("End");
  expect(await page.locator(".catalog-preview-scroll").evaluate(el=>el.scrollWidth > el.clientWidth)).toBe(true);
  await page.getByLabel("업무 시나리오").selectOption("공유 이그레스");
  const filtered = await gallery.getByRole("button").count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(total);
  await button("멀티클라우드 예제").click();
  await button("컴포넌트 VPC").click();
  await button("연결 집중 보기").click();
  await expect(button("연결 집중 보기")).toHaveAttribute("aria-pressed", "true");
  await page.getByText("이 리소스를 참조하는 항목", { exact:true }).click();
  await page.locator(".arch-properties details[open]").getByRole("button", {name:/Subnet ·/}).first().click();
  await expect(page.getByLabel("컴포넌트 표시 이름")).toHaveValue("Subnet");
  await button("컴포넌트 Application EC2").click();
  const viewer = page.getByLabel("Terraform 코드");
  await page.getByRole("textbox", {name:"AMI ID",exact:true}).fill("ami-0123456789abcdef0");
  await expect(viewer).toContainText("ami-0123456789abcdef0");
  await button("현재 파일 복사").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await viewer.innerText());
  await button("변경 줄 보기").click();
  await expect(page.locator(".live-added")).toContainText("ami-0123456789abcdef0");
  await button("아키텍처 실행 취소").click();
  await expect(page.getByText("페이지를 열었을 때와 같습니다.")).toBeVisible();
});

test("xinfra palette search and independent panels preserve the active drawing", async ({page}) => {
  await page.setViewportSize({width:1600,height:1000});
  await page.goto("/");
  const button=(name:string)=>page.getByRole("button",{name,exact:true});
  await button("새로 만들기").click();
  await button("xinfra 캔버스").click();
  await button("서울 리전 · 이중 AZ 프라이빗 이그레스").click();
  await button("템플릿으로 시작").click();
  const search=page.getByRole("searchbox",{name:"추가할 리소스 검색"});
  await search.fill("aws_vpc");
  await expect(page.locator(".arch-palette").getByRole("button",{name:"VPC AWS",exact:true})).toBeVisible();
  await button("리소스 팔레트").click();
  await expect(search).toBeHidden();
  await button("Terraform·속성 패널").click();
  await expect(page.locator(".terraform-live")).toBeHidden();
  await expect(page.locator(".case-blueprint")).toContainText("ap-northeast-2a");
  await button("리소스 팔레트").click();
  await expect(search).toHaveValue("aws_vpc");
  await search.fill("");
  await button("Terraform·속성 패널").click();
  await expect(page.getByLabel("Terraform 코드")).toBeVisible();
  await button("코드 크게 보기").click();
  await expect(page.locator(".arch-properties")).toBeHidden();
  await page.locator(".arch-editor").screenshot({path:"test-results/xinfra-workbench.png"});
});

test("provider palette isolates registry resources and adds a generic Azure component", async ({page}) => {
  await page.goto("/");
  const button = (name:string) => page.getByRole("button",{name,exact:true});
  await button("새로 만들기").click();
  await button("xinfra 캔버스").click();
  await button("빈 캔버스").click();
  const provider = page.getByLabel("컴포넌트 공급자");
  const query = page.getByRole("searchbox",{name:"추가할 리소스 검색"});
  await provider.selectOption("AWS");
  await query.fill("azurerm_kubernetes_cluster");
  await expect(page.locator(".arch-palette")).toContainText("검색 결과가 없습니다.");
  await provider.selectOption("Azure");
  await query.fill("azurerm_kubernetes_cluster");
  await page.locator('.arch-palette button[title="Azure · kubernetes cluster"]').click();
  await page.getByLabel("Terraform 속성 (JSON)").fill('{"dns_prefix":"team"}');
  await expect(page.getByLabel("Terraform 코드")).toContainText("team");
});

test("a cloud service outside the snapshot can be drawn under its provider", async ({page}) => {
  await page.goto("/");
  const button = (name:string) => page.getByRole("button",{name,exact:true});
  await button("새로 만들기").click();
  await button("xinfra 캔버스").click();
  await button("빈 캔버스").click();
  await page.getByLabel("컴포넌트 공급자").selectOption("GCP");
  await page.getByLabel("컴포넌트 종류").selectOption("service");
  await page.getByLabel("추가할 리소스 검색").fill("새 클라우드 서비스");
  await button("“새 클라우드 서비스” 서비스 도식 추가").click();
  await expect(page.getByRole("button",{name:"컴포넌트 새 클라우드 서비스",exact:true})).toBeVisible();
});

test("cloud schema fields, subnet reference and minimap work at laptop size", async ({page})=>{
  await page.setViewportSize({width:1366,height:768});
  await page.goto("/");
  const button=(name:string)=>page.getByRole("button",{name,exact:true});
  await button("새로 만들기").click();
  await button("xinfra 캔버스").click();
  await button("빈 캔버스").click();
  await page.getByLabel("컴포넌트 공급자").selectOption("AWS");
  const query=page.getByRole("searchbox",{name:"추가할 리소스 검색"});
  await query.fill("aws_vpc");
  await page.locator('.arch-palette [title="AWS · VPC"]').click();
  await query.fill("aws_security_group");
  await page.locator('.arch-palette [title="AWS · security group"]').click();
  await button("대상 클릭으로 연결").click();
  await button("컴포넌트 VPC").click();
  await button("vpc_id").click();
  await expect(page.getByLabel("Terraform 속성 (JSON)")).toHaveValue(/aws_vpc\.n_.*\.id/);
  await page.getByLabel("선택 속성 추가").selectOption("description");
  await page.getByLabel("description",{exact:true}).fill("application group");
  await expect(page.getByLabel("Terraform 코드")).toContainText("application group");
  await button("미니맵").click();
  await expect(page.getByLabel("리소스 미니맵")).toBeVisible();
  await expect(page.getByLabel("Terraform 코드").locator("[data-declaration]")).toHaveCount(2);
});
