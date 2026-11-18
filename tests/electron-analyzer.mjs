import { _electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

const root = await mkdtemp(path.join(tmpdir(), "xdocs-analyzer-"));
const dir = (name) => path.join(root, name);
const chart = dir("chart");
let app;
try {
  for (const name of [
    "vault",
    "data",
    "manifest",
    "project",
    "chart/templates",
  ])
    await mkdir(dir(name), { recursive: true });
  await writeFile(
    dir("data/workspace.json"),
    JSON.stringify({ root: dir("vault") }),
  );
  await writeFile(
    dir("project/Orders.java"),
    'import org.springframework.web.bind.annotation.GetMapping;\nimport org.springframework.web.bind.annotation.RestController;\n@RestController\npublic class Orders {\n@GetMapping("/orders")\npublic String orders() { return "ok"; }\n}\n',
  );
  await writeFile(
    dir("manifest/cron.yaml"),
    'apiVersion: batch/v1beta1\nkind: CronJob\nmetadata: {name: legacy}\nspec:\n  schedule: "0 * * * *"\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          restartPolicy: Never\n          containers: [{name: task, image: "demo:1"}]\n',
  );
  await writeFile(
    dir("chart/Chart.yaml"),
    "apiVersion: v2\nname: sample\nversion: 0.1.0\n",
  );
  await writeFile(
    dir("chart/templates/service.yaml"),
    'apiVersion: v1\nkind: Service\nmetadata: {name: "{{ .Release.Name }}-api"}\nspec:\n  selector: {app: api}\n  ports: [{port: 80, targetPort: 8080}]\n',
  );
  const exe = process.env.XDOCS_EXECUTABLE;
  app = await _electron.launch({
    args: exe ? [] : ["."],
    ...(exe ? { executablePath: path.resolve(exe) } : {}),
    env: { ...process.env, XDOCS_TEST_DATA: dir("data") },
  });
  await app.evaluate(() => {
    process.env.PATH = "";
  });
  const page = await app.firstWindow();
  await page.getByRole("button", { name: "Analyzer 만들기" }).click();
  for (const [mode, folder, heading] of [
    ["network", dir("project"), "네트워크 분석"],
    ["manifest", dir("manifest"), "Kubernetes 호환성 1.25"],
    ["helm-network", chart, "네트워크 분석"],
    ["helm", chart, "Kubernetes 호환성 1.25"],
    ["helm-upgrade", chart, "Helm 업그레이드 1.24 → 1.25"],
    ["upgrade", dir("manifest"), "Kubernetes 업그레이드 1.24 → 1.25"],
  ]) {
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder],
      });
    }, folder);
    await page.getByLabel("분석 종류").selectOption(mode);
    await page.getByRole("button", { name: "폴더 선택 및 분석" }).click();
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible({ timeout: 60000 });
    if (mode === "network")
      await expect(page.locator(".analyzer")).toContainText("/orders");
    if (mode === "manifest" || mode === "upgrade")
      await expect(page.locator(".analyzer")).toContainText("KW-API-REMOVED");
    console.log("PASS bundled engine:", mode);
  }
} finally {
  if (app) await app.evaluate(({ app }) => app.exit(0));
  await rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
