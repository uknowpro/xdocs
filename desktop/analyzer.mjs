import { helmOrigins, traceSources } from "./analyzer-source.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const devTools = fileURLToPath(new URL("../.cache/analyzers/"+process.platform+"-"+process.arch+"/", import.meta.url));
const execute = promisify(execFile);
async function runBundled(directory, tool, args) {
  const binary = path.join(directory,tool + (process.platform === "win32" ? ".exe" : ""));
  try {
    const { stdout } = await execute(binary, args, {
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  } catch (err) {
    if (
      tool === "kubewiser" &&
      args[0] === "scan" &&
      err.code === 1 &&
      err.stdout?.trim()
    )
      return err.stdout;
    if (err.code === "ENOENT")
      throw Error(
        tool + " 내장 엔진 파일을 찾을 수 없습니다. xdocs 설치 파일을 확인하세요.",
      );
    throw Error(
      tool + " 분석 실패 · " + (err.stderr || err.message).slice(0, 1000),
    );
  }
}
export async function analyzeDirectory(
  directory,
  { mode, from, to, namespace, release },
  valuesFile,
  toolsDirectory = devTools,
) {
  const run = (tool,args) => runBundled(toolsDirectory,tool,args);
  if (
    ![
      "network",
      "helm-network",
      "manifest",
      "helm",
      "helm-upgrade",
      "upgrade",
    ].includes(mode)
  )
    throw Error("지원하지 않는 분석입니다.");
  if (mode !== "network" && !/^1\.\d{1,2}$/.test(to))
    throw Error("목표 버전은 1.30 형식으로 입력하세요.");
  if (
    mode.endsWith("upgrade") &&
    (!/^1\.\d{1,2}$/.test(from) ||
      Number(from.split(".")[1]) >= Number(to.split(".")[1]))
  )
    throw Error("목표 버전은 시작 버전보다 높아야 합니다.");
  if (
    mode.startsWith("helm") &&
    ![namespace, release].every(
      (x) =>
        typeof x === "string" &&
        /^[a-z0-9](?:[-a-z0-9]{0,51}[a-z0-9])?$/.test(x),
    )
  )
    throw Error("릴리스와 네임스페이스 이름을 확인하세요.");
  const values = valuesFile ? ["--values", valuesFile] : [];
  if (mode === "helm-network") {
    const dir = await mkdtemp(path.join(tmpdir(), "xdocs-chart-"));
    try {
      const yaml = await run("helm", [
        "template",
        release,
        directory,
        "--namespace",
        namespace,
        "--kube-version",
        to,
        ...values,
      ]);
      await writeFile(path.join(dir, "rendered.yaml"), yaml, { mode: 0o600 });
      return traceSources(JSON.parse(await run("netspector", ["scan", dir, "--format", "json"])), directory, helmOrigins(yaml));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  if (mode === "network")
    return traceSources(JSON.parse(await run("netspector", ["scan", directory, "--format", "json"])), directory);
  if (mode === "helm-upgrade") {
    const scan = async (version) =>
      JSON.parse(
        await run("kubewiser", [
          "scan",
          "helm",
          "--target-version",
          version,
          "--format",
          "json",
          "--namespace",
          namespace,
          "--release",
          release,
          ...values,
          directory,
        ]),
      );
    return {
      kind: "helm-upgrade",
      from,
      to,
      before: (await scan(from)).report,
      report: (await scan(to)).report,
    };
  }
  const args =
    mode === "upgrade"
      ? [
          "plan",
          "upgrade",
          "--source",
          directory,
          "--from",
          from,
          "--to",
          to,
          "--format",
          "json",
        ]
      : [
          "scan",
          mode === "helm" ? "helm" : "files",
          "--target-version",
          to,
          "--format",
          "json",
          ...(mode === "helm"
            ? ["--namespace", namespace, "--release", release, ...values]
            : []),
          directory,
        ];
  const result = JSON.parse(await run("kubewiser", args));
  return (mode === "manifest" || mode === "upgrade") ? traceSources(result, directory) : result;
}
