import { test, expect } from "@playwright/test";

test("local plan marks the canvas, masks both values, and keeps unmatched resources", async ({
  page,
}) => {
  await page.goto("/");
  const btn = (name: string) => page.getByRole("button", { name, exact: true });
  await btn("새로 만들기").click();
  await btn("IaCD 아키텍처").click();
  await btn("멀티클라우드 예제").click();
  const id = await btn("컴포넌트 Application EC2").getAttribute("data-scope");
  await page.getByText("Terraform plan 검토", { exact: true }).click();
  const address = "aws_instance." + id;
  await page.getByLabel("로컬 plan JSON").setInputFiles({
    name: "plan.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format_version: "1.2",
        resource_changes: [
          {
            address,
            change: {
              actions: ["delete", "create"],
              before: { token: "old-secret" },
              after: { token: "new-secret" },
              after_sensitive: { token: true },
            },
          },
          {
            address: "module.extra.aws_instance.other",
            change: { actions: ["delete"] },
          },
        ],
      }),
    ),
  });
  await expect(btn("컴포넌트 Application EC2")).toContainText("교체");
  await page.getByText("교체 · " + address, { exact: true }).click();
  await expect(page.getByText("민감 값 → 민감 값")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("new-secret");
  await page
    .getByText("삭제 · module.extra.aws_instance.other", { exact: true })
    .click();
  await expect(page.getByText("대응하는 도면 리소스 없음")).toBeVisible();
  await btn("계획 닫기").click();
  await expect(btn("컴포넌트 Application EC2")).not.toContainText("교체");
});

test("a workspace fragment can be reused in a new canvas, with fresh internal references", async ({
  page,
}) => {
  await page.goto("/");
  const btn = (name: string) => page.getByRole("button", { name, exact: true });
  await btn("새로 만들기").click();
  await btn("IaCD 아키텍처").click();
  await btn("멀티클라우드 예제").click();
  await btn("컴포넌트 VPC").click();
  const old = await btn("컴포넌트 VPC").getAttribute("data-scope");
  await page.getByText("워크스페이스 설계 템플릿", { exact: true }).click();
  await page.getByLabel("템플릿 이름", { exact: true }).fill("네트워크 설계");
  await page.getByRole("button", { name: /선택 영역 저장/ }).click();
  await expect(page.getByText("워크스페이스에 저장했습니다.")).toBeVisible();
  await btn("새로 만들기").click();
  await btn("IaCD 아키텍처").click();
  await page
    .getByRole("button", { name: /빈 캔버스/ })
    .first()
    .click();
  await page.getByText("워크스페이스 설계 템플릿", { exact: true }).click();
  await page.getByLabel("저장된 설계").selectOption({ label: "네트워크 설계" });
  await btn("설계에 삽입").click();
  await expect(btn("컴포넌트 Application EC2")).toBeVisible();
  expect(await btn("컴포넌트 VPC").getAttribute("data-scope")).not.toBe(old);
  await btn("컴포넌트 Subnet").click();
  await expect(
    page.getByRole("combobox", { name: "VPC", exact: true }),
  ).toHaveValue((await btn("컴포넌트 VPC").getAttribute("data-scope"))!);
});
