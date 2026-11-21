import { test, expect } from "@playwright/test";

test("local plan marks the canvas, masks both values, and keeps unmatched resources", async ({
  page,
}) => {
  await page.goto("/");
  const btn = (name: string) => page.getByRole("button", { name, exact: true });
  await btn("새로 만들기").click();
  await btn("xinfra 아키텍처 캔버스").click();
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
  await btn("xinfra 아키텍처 캔버스").click();
  await btn("멀티클라우드 예제").click();
  await btn("컴포넌트 VPC").click();
  const old = await btn("컴포넌트 VPC").getAttribute("data-scope");
  await page.getByText("워크스페이스 설계 템플릿", { exact: true }).click();
  await page.getByLabel("템플릿 이름", { exact: true }).fill("네트워크 설계");
  await page.getByRole("button", { name: /선택 영역 저장/ }).click();
  await expect(page.getByText("워크스페이스에 저장했습니다.")).toBeVisible();
  await btn("새로 만들기").click();
  await btn("xinfra 아키텍처 캔버스").click();
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

test("subnet preview validates edits, cancels without mutation and undoes insertion once", async ({
  page,
}) => {
  await page.goto("/");
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  await button("새로 만들기").click();
  await button("xinfra 아키텍처 캔버스").click();
  await button("멀티클라우드 예제").click();
  const subnet = button("컴포넌트 Subnet");
  const id = await button("컴포넌트 VPC").getAttribute("data-scope");
  await subnet.click();
  await page.getByText("워크스페이스 설계 템플릿", { exact: true }).click();
  const panel = page
    .locator("details")
    .filter({
      has: page.getByText("워크스페이스 설계 템플릿", { exact: true }),
    })
    .first();
  await panel.getByLabel("템플릿 이름").fill("서브넷 조각");
  await panel.getByRole("button", { name: /선택 영역 저장/ }).click();
  const choose = () =>
    panel.getByLabel("저장된 설계").selectOption({ label: "서브넷 조각" });
  await choose();
  await button("삽입 취소").click();
  await expect(subnet).toHaveCount(1);
  await choose();
  await panel.getByLabel("Subnet · VPC").selectOption(id!);
  await expect(panel.getByText(/CIDR 충돌/)).toBeVisible();
  await expect(button("설계에 삽입")).toBeDisabled();
  await panel.getByText("Subnet · 삽입 속성", { exact: true }).click();
  const props = panel
    .locator("details[open]")
    .filter({ has: page.getByLabel("배포 이름", { exact: true }) })
    .first();
  await props.getByLabel("표시 이름", { exact: true }).fill("새 서브넷");
  await props.getByLabel("배포 이름", { exact: true }).fill("alternate");
  await props.getByLabel("CIDR", { exact: true }).fill("10.0.2.0/24");
  await panel.getByText("Application EC2 · 삽입 속성", { exact: true }).click();
  const compute = panel
    .locator("details")
    .filter({
      has: page.getByText("Application EC2 · 삽입 속성", { exact: true }),
    })
    .last();
  await compute.getByLabel("배포 이름", { exact: true }).fill("app-alternate");
  await button("설계에 삽입").click();
  await expect(button("컴포넌트 새 서브넷")).toBeVisible();
  await button("아키텍처 실행 취소").click();
  await expect(button("컴포넌트 새 서브넷")).toHaveCount(0);
});

test("filter ten plan instances and save only the replacement to a linked block note", async ({
  page,
}) => {
  await page.goto("/");
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  await button("새로 만들기").click();
  await button("xinfra 아키텍처 캔버스").click();
  await button("멀티클라우드 예제").click();
  await page.getByText("Terraform plan 검토", { exact: true }).click();
  const changes = Array.from({ length: 10 }, (_, i) => ({
    address: "module.app.aws_instance.web[" + i + "]",
    change:
      i === 3
        ? {
            actions: ["delete", "create"],
            replace_paths: [["size"]],
            before: { size: 1, token: "old-secret" },
            after: { size: 2, token: "new-secret" },
            after_sensitive: { token: true },
          }
        : { actions: ["no-op"] },
  }));
  await page
    .getByLabel("로컬 plan JSON")
    .setInputFiles({
      name: "plan.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ format_version: "1.2", resource_changes: changes }),
      ),
    });
  await expect(page.getByLabel("작업 건수")).toContainText("교체 1");
  await page
    .getByLabel("모듈 경로", { exact: true })
    .selectOption("module.app");
  await page.getByLabel("작업 필터").selectOption("교체");
  await page.getByLabel("인스턴스 주소 검색").fill("web[3]");
  await page
    .getByText("교체 · module.app.aws_instance.web[3]", { exact: true })
    .click();
  await expect(page.getByText("교체 유발 · size")).toBeVisible();
  await page.getByRole("checkbox", { name: /검토에 포함/ }).check();
  await page.getByLabel("확인할 사항").fill("점검 창 승인");
  await button("검토 노트 저장 (1)").click();
  const blocks = page.getByRole("textbox", { name: "블록 편집기" });
  await expect(blocks).toContainText("web[3]");
  await expect(blocks).toContainText("민감 값");
  await expect(blocks).not.toContainText("secret");
  await expect(blocks).not.toContainText("web[2]");
  await expect(blocks).toContainText("점검 창 승인");
  await button("읽기 모드").click();
  await page.locator(".markdown .wiki").first().click();
  await expect(button("컴포넌트 VPC")).toBeVisible();
});
