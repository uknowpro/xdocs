import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { generateArchitecture } from "../shared/architecture.mjs";
const run = promisify(execFile);
export async function checkTerraform(model, directory) {
  const { files, errors } = generateArchitecture(model, "terraform");
  if (errors.length) throw Error(errors.join("\n"));
  const configs = Object.entries(files).filter(
    ([key]) => key.startsWith("terraform/") && /\.tf(?:\.json)?$/.test(key),
  );
  if (!configs.length) throw Error("검증할 Terraform 파일이 없습니다.");
  for (const [key, body] of configs) {
    const file = key.slice(10);
    if (
      (await readFile(path.join(directory, file), "utf8").catch(() => null)) !==
      body
    )
      throw Error("현재 도면에서 추출한 파일과 다른 디렉터리입니다: " + file);
  }
  const expected = new Set(configs.map(([name]) => name.slice(10)));
  for (const dir of new Set(
    [...expected].map((file) => path.posix.dirname(file)),
  )) {
    const entries = await readdir(path.join(directory, dir));
    if (
      entries.some(
        (name) =>
          /\.tf(?:\.json)?$/.test(name) &&
          !expected.has(path.posix.join(dir, name)),
      )
    )
      throw Error(
        "추출 결과에 없는 Terraform 파일이 있습니다. 도면 전용 디렉터리를 선택하세요.",
      );
  }
  for (const cli of ["terraform", "tofu"]) {
    let stdout;
    try {
      ({ stdout } = await run(cli, ["validate", "-json"], {
        cwd: directory,
        timeout: 60000,
        maxBuffer: 4_000_000,
        windowsHide: true,
      }));
    } catch (err) {
      if (err.code === "ENOENT") continue;
      if (!err.stdout) throw err;
      stdout = err.stdout;
    }
    const result = JSON.parse(stdout);
    return {
      tool: cli,
      valid: result.valid,
      diagnostics: result.diagnostics.map((d) => ({
        message: d.summary + " · " + d.detail,
        address:
          d.address ||
          (d.snippet?.context || "").replace(
            /^(resource|data) "([^"]+)" "([^"]+)"$/,
            (_, block, type, name) =>
              (block === "data" ? "data." : "") + type + "." + name,
          ),
        file: (d.range?.filename || "").replaceAll("\\", "/"),
        line: d.range?.start?.line || 0,
      })),
    };
  }
  throw Error("PATH에서 terraform 또는 tofu를 찾을 수 없습니다.");
}
