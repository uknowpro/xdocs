import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

test("keyboard search reveals folded resources and preserves the saved layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 780, height: 600 });
  await page.goto("/");
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  await button("IaCD 아키텍처").click();
  await button("멀티클라우드 예제").click();
  const ec2 = button("컴포넌트 Application EC2");
  const id = await ec2.getAttribute("data-scope");
  await button("컴포넌트 VPC").click();
  await button("경계 접기").click();
  await expect(ec2).toHaveCount(0);
  const find = page.getByRole("combobox", { name: "리소스 찾기", exact: true });
  await button("컴포넌트 VPC").focus();
  await page.keyboard.press("/");
  await expect(find).toBeFocused();
  await find.fill("aws_instance." + id);
  await find.press("Enter");
  const name = page.getByRole("textbox", { name: "컴포넌트 표시 이름" });
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("Application EC2");
  await name.press("Escape");
  await expect(ec2).toBeFocused();
  await page.getByLabel("선택 리소스 참조선").check();
  await ec2.press("Enter");
  await expect(name).toBeFocused();
  await name.press("Escape");
  await button("코드 추출").click();
  await button("IaC 변경 비교").click();
  await expect(page.getByText("생성된 IaC에 변경이 없습니다.")).toBeVisible();
  await expect(page.locator(".save-state")).toContainText("저장됨");
  await page.reload();
  await button("멀티클라우드 · 웹 서비스").click();
  await expect(button("컴포넌트 VPC")).toBeVisible();
  await expect(ec2).toHaveCount(0);
});
test("context insertion assigns the selected subnet and undoes the entire operation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
    .click();
  await page.getByRole("button", { name: "멀티클라우드 예제" }).click();
  const subnet = page.getByRole("button", {
    name: "컴포넌트 Subnet",
    exact: true,
  });
  await subnet.click();
  const add = page.getByRole("combobox", {
    name: "Subnet 안에 추가",
    exact: true,
  });
  await subnet.focus();
  await page.keyboard.press("+");
  await expect(add).toBeFocused();
  const viewer = page.getByLabel("Terraform 코드");
  const before = await viewer.innerText();
  await add.fill("aws_instance");
  await add.press("Enter");
  await expect(
    page.getByRole("combobox", { name: "Subnet", exact: true }),
  ).toHaveValue((await subnet.getAttribute("data-scope"))!);
  const created = page.getByRole("button", {
    name: "컴포넌트 EC2",
    exact: true,
  });
  await expect(created).toHaveCount(1);
  await expect(viewer).not.toHaveText(before);
  await page.getByRole("button", { name: "아키텍처 실행 취소" }).click();
  await expect(created).toHaveCount(0);
  await expect(viewer).toHaveText(before);
});
test("AWS search distinguishes vaults by account and selects the matching SVG element", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
    .click();
  await page.getByRole("button", { name: "AWS 백업 드로잉 예제" }).click();
  const find = page.getByRole("combobox", { name: "AWS 구성요소 찾기" });
  await find.fill("Central vault dest0");
  await find.press("Enter");
  await expect(page.getByLabel("선택한 항목")).toHaveValue("dest0");
  await expect(page.getByLabel("표시 이름")).toHaveValue("Destination vault");
  await expect(
    page.getByLabel("AWS 구성도").locator('[data-id="dest0"]'),
  ).toHaveCount(1);
});
for (const [kind, query, source] of [
  ["actions", "Job build", "runs-on"],
  ["jenkins", "Stage Build", "echo"],
  ["ansible", "Check connectivity", "ansible.builtin.ping"],
  ["cloudformation", "Network", "AWS::EC2::VPC"],
]) {
  test(
    kind + " search opens the source block and protects drafts",
    async ({ page }) => {
      await page.goto("/");
      await page.getByLabel("자동화 캔버스 만들기").selectOption(kind);
      const downloadSource = async () => {
        const ready = page.waitForEvent("download");
        await page.getByRole("button", { name: "파일 내보내기" }).click();
        return readFile((await (await ready).path())!);
      };
      const original = await downloadSource();
      const card = page.locator(".arch-node").first();
      const beforeMove = await card.getAttribute("style");
      await card.dragTo(card.locator(".."), {
        targetPosition: { x: 300, y: 150 },
      });
      await expect(card).not.toHaveAttribute("style", beforeMove!);
      expect(await downloadSource()).toEqual(original);
      const find = page.getByRole("combobox", { name: "블록 찾기" });
      await find.fill(query);
      await find.press("Enter");
      const editor = page.getByLabel("캔버스 코드");
      await expect(editor).toBeFocused();
      const before = await editor.inputValue();
      expect(before).toContain(source);
      await editor.fill(before + " ");
      await expect(find).toBeDisabled();
      await page.getByRole("button", { name: "취소", exact: true }).click();
      await expect(editor).toHaveValue(before);
    },
  );
}
