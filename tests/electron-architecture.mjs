import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
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
    (await readFile(
      new URL("./fixtures/indexed-placement/azure/main.tf", import.meta.url),
      "utf8",
    )) +
    "\n" +
    '# preserve this comment\nresource "aws_vpc" "main" { cidr_block="10.0.0.0/16" }\nresource "custom_resource" "special" { value="retained-configuration" }\nresource "aws_subnet" "app" {\n vpc_id=aws_vpc.main.id\n cidr_block="10.0.1.0/24"\n}\n';
await writeFile(file, content);
const gcpFile = path.join(temp, "gcp.tf");
const gcpContent = await readFile(
  new URL("./fixtures/indexed-placement/gcp/main.tf", import.meta.url),
  "utf8",
);
await writeFile(gcpFile, gcpContent);
const app = await electron.launch({
  args: process.env.XDOCS_EXECUTABLE ? [] : ["."],
  ...(process.env.XDOCS_EXECUTABLE
    ? { executablePath: process.env.XDOCS_EXECUTABLE }
    : {}),
  env: { ...process.env, XDOCS_TEST_DATA: data },
});
try {
  await app.evaluate(
    ({ dialog }, paths) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: paths,
      });
    },
    [file, gcpFile],
  );
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
  await page.locator(".infra-preview").getByRole("checkbox").check();
  await page.getByRole("button", { name: "다이어그램으로 가져오기" }).click();
  await expect(
    page.getByRole("button", { name: "컴포넌트 custom_resource.special" }),
  ).toBeVisible();
  const placement = page.getByRole("region", { name: "Terraform 배치 근거" });
  for (const [name, expected] of [
    [
      "fixed",
      [
        "소속 경계 · google_compute_subnetwork.app",
        "network_interface.subnetwork",
      ],
    ],
    [
      "per_key",
      [
        "참조 선언 · google_compute_subnetwork.per_key",
        "each.key별 인스턴스 소속 미확정",
      ],
    ],
    [
      "multi",
      [
        "소속 미확정",
        "network_interface[0].subnetwork",
        "network_interface[1].subnetwork",
      ],
    ],
  ]) {
    await page
      .getByRole("button", {
        name: "컴포넌트 google_compute_instance." + name,
        exact: true,
      })
      .click();
    for (const text of expected) await expect(placement).toContainText(text);
    await page.getByRole("button", { name: "속성 닫기", exact: true }).click();
  }
  await page
    .getByRole("button", {
      name: "컴포넌트 azurerm_network_interface.per_key",
      exact: true,
    })
    .click();
  await expect(placement).toContainText("참조 선언 · azurerm_subnet.app");
  await expect(placement).toContainText("each.key별 인스턴스 소속 미확정");
  await page.getByRole("button", { name: "속성 닫기", exact: true }).click();
  await page
    .getByRole("button", {
      name: "컴포넌트 azurerm_linux_virtual_machine.app",
      exact: true,
    })
    .click();
  await expect(placement).toContainText(
    "NIC를 통한 소속 경계 · azurerm_subnet.fixed",
  );
  await placement
    .getByRole("button", {
      name: "연결된 NIC · azurerm_network_interface.fixed",
    })
    .click();
  await expect(placement).toContainText(
    "ip_configuration.subnet_id = azurerm_subnet.fixed.id",
  );
  await page.getByRole("button", { name: "속성 닫기", exact: true }).click();
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
  assert.equal(strFromU8(zip["terraform/gcp.tf"]), gcpContent);
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
  const project = fileURLToPath(
    new URL("./fixtures/terraform-graph/", import.meta.url),
  );
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folder],
    });
  }, project);
  const button = (name) => page.getByRole("button", { name, exact: true });
  await button("IaCD 아키텍처").click();
  await button("로컬 모듈 포함 폴더 가져오기").click();
  await expect(page.locator(".infra-preview")).toContainText("module/main.tf");
  await page.locator(".infra-preview").getByRole("checkbox").check();
  await button("다이어그램으로 가져오기").click();
  const search = page.getByRole("combobox", { name: "리소스 찾기" });
  await search.fill("aws_instance.via_module");
  await search.press("Enter");
  await placement
    .getByText("module.network.subnet_id · output 선언", { exact: true })
    .click();
  await placement.getByText("출력 선언 원문 보기", { exact: true }).click();
  await expect(placement.locator("pre")).toContainText('output "subnet_id"');
  await placement
    .getByRole("button", { name: "aws_subnet.app", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "컴포넌트 표시 이름" }),
  ).toHaveValue("aws_subnet.app");
  await button("속성 닫기").click();
  await button("코드 추출").click();
  const projectZip = path.join(temp, "module.zip");
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, projectZip);
  await button("코드 ZIP 내보내기").click();
  await expect(page.getByRole("status")).toContainText("내보냈습니다");
  const archived = unzipSync(await readFile(projectZip));
  for (const file of ["main.tf", "module/main.tf"])
    assert.equal(
      strFromU8(archived["terraform/" + file]),
      await readFile(path.join(project, file), "utf8"),
    );
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
