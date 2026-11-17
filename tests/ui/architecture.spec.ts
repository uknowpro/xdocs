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
    .getByLabel("보관함 목록")
    .getByRole("button", { name: /캔버스/ })
    .click();
  await page
    .getByRole("button", { name: "멀티클라우드 · 웹 서비스", exact: true })
    .click();
  await page.getByRole("button", { name: "WAF 검토", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "신뢰성 검토 기록" }),
  ).toHaveValue("RTO 1시간 · 복구 훈련 예정");
  await page.getByRole("button", { name: "설계", exact: true }).click();
  await page.getByRole("button", { name: "컴포넌트 VPC", exact: true }).click();
  await page.getByRole("button", { name: "정렬", exact: true }).click();
  await page.getByRole("button", { name: "맞춤", exact: true }).click();
  await expect(page.locator(".save-state")).toContainText("브라우저에 저장됨");
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
