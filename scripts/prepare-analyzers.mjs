import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmod,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { unzipSync } from "fflate";

const assets = JSON.parse(
  await readFile(new URL("./analyzer-assets.json", import.meta.url)),
);
const cache = fileURLToPath(new URL("../.cache/analyzers/", import.meta.url));
const hash = (data) => createHash("sha256").update(data).digest("hex");

export async function prepare(platform, arch, destination) {
  const tools = assets[platform + "-" + arch];
  if (!tools)
    throw Error("No bundled Analyzer tools for " + platform + "-" + arch);
  await mkdir(cache, { recursive: true });
  await mkdir(destination, { recursive: true });
  for (const [name, asset] of Object.entries(tools)) {
    const cached = path.join(cache, path.basename(asset.url));
    const temp = await mkdtemp(path.join(cache, "unpack-"));
    try {
      let data = await readFile(cached).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
      if (!data || hash(data) !== asset.sha256) {
        const response = await fetch(asset.url, {
          signal: AbortSignal.timeout(180000),
        });
        if (!response.ok)
          throw Error(name + " download failed: HTTP " + response.status);
        data = Buffer.from(await response.arrayBuffer());
        if (hash(data) !== asset.sha256)
          throw Error(name + " archive digest mismatch");
        const download = path.join(temp, "download");
        await writeFile(download, data);
        await rename(download, cached);
      }
      const suffix = platform === "win32" ? ".exe" : "";
      const binary = name + suffix;
      const notices =
        name === "netspector"
          ? ["LICENSE", "licenses", "BUILD-INFO.txt"]
          : name === "kubewiser"
            ? ["LICENSE", "THIRD_PARTY_NOTICES.txt"]
            : ["LICENSE"];
      const source = path.join(temp, asset.directory);
      if (asset.url.endsWith(".zip")) {
        const files = unzipSync(data);
        for (const [key, bytes] of Object.entries(files)) {
          const relative = path.posix.relative(
            asset.directory,
            key.replaceAll("\\", "/"),
          );
          if (
            relative !== binary &&
            !notices.some((n) => n === relative || relative.startsWith(n + "/"))
          )
            continue;
          const target = path.resolve(source, relative);
          if (!target.startsWith(source + path.sep) || key.endsWith("/"))
            continue;
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, bytes);
        }
      } else {
        execFileSync("tar", ["-xzf", cached, "-C", temp]);
      }
      const output = path.join(destination, binary);
      await copyFile(path.join(source, binary), output);
      if (platform !== "win32") await chmod(output, 0o755);
      const legal = path.join(destination, "licenses", name);
      await mkdir(legal, { recursive: true });
      for (const notice of notices)
        await cp(path.join(source, notice), path.join(legal, notice), {
          recursive: true,
        });
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  await prepare(
    process.platform,
    process.arch,
    path.join(cache, process.platform + "-" + process.arch),
  );
