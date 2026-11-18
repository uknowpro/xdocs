// Usage: node catalog/compile.mjs <AWS clone> <Azure clone> <GCP clone>
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseTerraformFiles } from "../desktop/architecture-reader.mjs";
import { generateArchitecture } from "../shared/architecture.mjs";
const root = fileURLToPath(new URL(".", import.meta.url));
const sources = JSON.parse(
  await readFile(path.join(root, "sources.json"), "utf8"),
);
const clones = Object.fromEntries(
  ["AWS", "Azure", "GCP"].map((p, i) => [p, process.argv[i + 2]]),
);
for (const s of sources) {
  const dir = clones[s.provider];
  if (
    !dir ||
    execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim() !== s.revision
  )
    throw Error("Supply the pinned " + s.provider + " checkout");
  const base = path.join(dir, s.directory);
  const files = [];
  for (const name of (await readdir(base))
    .filter((n) => n.endsWith(".tf"))
    .sort()) {
    files.push({
      name,
      content: await readFile(path.join(base, name), "utf8"),
    });
  }
  const url =
    "https://github.com/" + s.repo + "/tree/" + s.revision + "/" + s.directory;
  const license = await readFile(path.join(dir, "LICENSE"), "utf8");
  files.push({
    name: "xdocs-source-notice.tf",
    content:
      (url + "\n" + license)
        .split(/\r?\n/)
        .map((l) => "# " + l)
        .join("\n") + "\n",
  });
  const m = await parseTerraformFiles(files);
  m.title = s.provider + " · " + s.name;
  const output = generateArchitecture(m, "terraform");
  if (
    output.errors.length ||
    files.some((f) => output.files["terraform/" + f.name] !== f.content)
  )
    throw Error(s.id + " failed Terraform round trip");
  const dest = path.join(root, "snapshots");
  await mkdir(dest, { recursive: true });
  await writeFile(
    path.join(dest, s.id + ".json"),
    JSON.stringify(m, null, 2) + "\n",
  );
}
