import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
const temp = await mkdtemp(path.join(os.tmpdir(), "xdocs-iacd-")),
  data = path.join(temp, "app"),
  vault = path.join(temp, "vault");
await mkdir(data);
await mkdir(vault);
await writeFile(
  path.join(data, "workspace.json"),
  JSON.stringify({ root: vault }),
);
const file = path.join(temp, "main.tf"),
  content =
    '# preserve this comment\nresource "aws_vpc" "main" { cidr_block="10.0.0.0/16" }\nresource "custom_resource" "special" { value="retained-configuration" }\nresource "aws_subnet" "app" {\n vpc_id=aws_vpc.main.id\n cidr_block="10.0.1.0/24"\n}\n';
await writeFile(file, content);
const app = await electron.launch({
  args: process.env.XDOCS_EXECUTABLE ? [] : ["."],
  ...(process.env.XDOCS_EXECUTABLE
    ? { executablePath: process.env.XDOCS_EXECUTABLE }
    : {}),
  env: { ...process.env, XDOCS_TEST_DATA: data },
});
try {
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, file);
  const page = await app.firstWindow();
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Terraform 가져오기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "다이어그램으로 가져오기" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "다이어그램으로 가져오기" }).click();
  await expect(
    page.getByRole("button", { name: "컴포넌트 custom_resource.special" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "컴포넌트 aws_subnet.app", exact: true })
    .click();
  const evidence = page.getByRole("region", { name: "Terraform 배치 근거" });
  await expect(evidence).toContainText("vpc_id = aws_vpc.main.id");
  await expect(evidence).toContainText("main.tf");
  await page.getByText("참조하는 대상", { exact: true }).click();
  await page
    .locator(".arch-properties")
    .getByRole("button", { name: "aws_vpc.main", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "CIDR", exact: true })
    .fill("10.8.0.0/16");
  await expect(page.locator(".save-state")).toContainText("로컬에 저장됨");
  await page.getByRole("button", { name: "코드 추출", exact: true }).click();
  const zipFile = path.join(temp, "architecture.zip");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, zipFile);
  await page.getByRole("button", { name: "코드 ZIP 내보내기" }).click();
  await expect(page.getByRole("status")).toContainText("내보냈습니다");
  const zip = unzipSync(await readFile(zipFile));
  assert.equal(strFromU8(zip["terraform/main.tf"]), content);
  assert.equal(
    JSON.parse(strFromU8(zip["terraform/zz_xdocs_override.tf.json"])).resource
      .aws_vpc.main.cidr_block,
    "10.8.0.0/16",
  );
  assert.equal(await readFile(file, "utf8"), content);
  const ws = await page.evaluate(() => window.xdocs.refresh());
  const saved = await page.evaluate(
    (id) => window.xdocs.readNote(id),
    ws.notes[0].id,
  );
  assert.match(saved.body, /xdocs-architecture/);
  assert.match(saved.body, /retained-configuration/);
  console.log(
    "PASS IaCD desktop: HCL worker import, explicit source retention, unknown resource, scalar override, native ZIP export, original source unchanged",
  );
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  await rm(temp, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
