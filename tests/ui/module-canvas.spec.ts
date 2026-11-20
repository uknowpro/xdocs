import { test, expect, type Page } from "@playwright/test";
import { parseTerraformFiles } from "../../desktop/architecture-reader.mjs";
import { encodeArchitecture } from "../../shared/architecture.mjs";
async function openCanvas(
  page: Page,
  sources: { name: string; content: string }[],
) {
  const body = encodeArchitecture(await parseTerraformFiles(sources));
  await page.addInitScript((body: string) => {
    const note = {
      id: "canvas",
      path: "설계.md",
      title: "설계",
      revision: "1",
      body,
    };
    localStorage.setItem(
      "xdocs.preview.v1",
      JSON.stringify({ name: "workspace", root: "preview", notes: [note] }),
    );
  }, body);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "보관함 페이지" })
    .getByRole("button", { name: "설계", exact: true })
    .click();
}

test("indexed plan row opens its module and the child declaration", async ({
  page,
}) => {
  await openCanvas(page, [
    {
      name: "main.tf",
      content:
        'module "net" {\n source="./modules/net"\n for_each=toset(["prod"])\n}',
    },
    { name: "modules/net/main.tf", content: 'resource "aws_subnet" "app" {}' },
  ]);
  await page.getByText("Terraform plan 검토", { exact: true }).click();
  const address = 'module.net["prod"].aws_subnet.app[0]';
  await page
    .getByLabel("로컬 plan JSON")
    .setInputFiles({
      name: "plan.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format_version: "1.0",
          resource_changes: [{ address, change: { actions: ["update"] } }],
        }),
      ),
    });
  const action = page.getByRole("button", {
    name: /선언 열기 · aws_subnet.app/,
  });
  await expect(
    page.getByText("수정 · " + address, { exact: true }),
  ).toBeVisible();
  await expect(action).toBeVisible();
  await action.click();
  await expect(page.getByLabel("컴포넌트 표시 이름")).toHaveValue("module.net");
  await expect(page.getByLabel("Terraform 파일")).toHaveValue(
    "terraform/modules/net/main.tf",
  );
  await expect(page.getByLabel("모듈 리소스 선언")).toContainText(
    'resource "aws_subnet" "app"',
  );
});

test("both conflicting subnets can be opened from issues and an edit clears the warning", async ({
  page,
}) => {
  const content =
    'resource "aws_vpc" "main" { cidr_block="10.0.0.0/16" }\n' +
    ["a", "b"]
      .map(
        (name) =>
          'resource "aws_subnet" "' +
          name +
          '" {\n vpc_id=aws_vpc.main.id\n cidr_block="10.0.1.0/24"\n}',
      )
      .join("\n");
  await openCanvas(page, [{ name: "main.tf", content }]);
  await page.getByText("설계 이슈 (2)", { exact: true }).click();
  for (const name of ["a", "b"]) {
    await page
      .getByRole("button", {
        name: new RegExp("^aws_subnet\\." + name + " · .*CIDR 충돌"),
      })
      .click();
    await expect(page.getByLabel("컴포넌트 표시 이름")).toHaveValue(
      "aws_subnet." + name,
    );
  }
  await page
    .getByRole("textbox", { name: "CIDR", exact: true })
    .fill("10.0.2.0/24");
  await expect(page.getByText("설계 이슈 (0)", { exact: true })).toBeVisible();
});
