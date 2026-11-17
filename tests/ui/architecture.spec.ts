import { test, expect } from "@playwright/test";
test("IaCD canvas edits, moves, connects, undoes and preserves WAF notes with code preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
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
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
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
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
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
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
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
