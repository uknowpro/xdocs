import { execFile } from "node:child_process";
import { join } from "node:path";
import { mkdtemp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

function execute(file, args, timeout = 15000) {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { timeout, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) reject(new Error((stderr || error.message).slice(-1200)));
        else resolve(stdout);
      },
    );
  });
}
const renderScript = `
import json, sys
from jinja2 import nodes
from docxtpl import DocxTemplate
from jinja2.sandbox import ImmutableSandboxedEnvironment
from jinja2 import StrictUndefined
class FieldEnvironment(ImmutableSandboxedEnvironment):
    def _parse(self, source, name, filename):
        ast = super()._parse(source, name, filename)
        allowed = (nodes.Output,nodes.TemplateData,nodes.Name,nodes.Const,nodes.For,nodes.If,nodes.Getattr,nodes.Getitem,nodes.Filter,nodes.Compare,nodes.Operand,nodes.Not,nodes.And,nodes.Or)
        for node in ast.find_all(nodes.Node):
            if not isinstance(node, allowed):
                raise ValueError("Only field substitution, simple conditions and row loops are supported.")
            if isinstance(node,nodes.For) and (node.recursive or any(node.find_all(nodes.For))):
                raise ValueError("Nested and recursive loops are unsupported.")
        return ast
    def is_safe_attribute(self, obj, attr, value): return False
    def is_safe_callable(self, obj): return False
env = FieldEnvironment(undefined=StrictUndefined, autoescape=True)
env.globals.clear()
env.filters = {k:v for k,v in env.filters.items() if k in ("length","upper","lower","default","trim","escape")}
doc = DocxTemplate(sys.argv[1])
with open(sys.argv[2], encoding="utf-8") as f: context=json.load(f)
doc.render(context, jinja_env=env, autoescape=True)
doc.save(sys.argv[3])
`;
export function wordRenderer(root, consent) {
  const python = join(
    root,
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  const check = () =>
    execute(python, ["-I", "-c", "from docxtpl import DocxTemplate"]);
  let installing;
  async function install() {
    if (!(await consent(root))) return false;
    await mkdir(root, { recursive: true });
    try {
      if (process.platform === "win32")
        await execute("py", ["-3", "-m", "venv", root], 90000);
      else await execute("python3", ["-m", "venv", root], 90000);
    } catch (error) {
      throw Error(
        "Python 3 및 venv 설치 상태를 확인한 뒤 다시 시도하세요. " +
          error.message,
      );
    }
    await execute(
      python,
      [
        "-I",
        "-m",
        "pip",
        "--isolated",
        "install",
        "--only-binary=:all:",
        "--index-url",
        "https://pypi.org/simple",
        "docxtpl==0.20.2",
      ],
      150000,
    );
    await check();
    return true;
  }
  return async (bytes, context) => {
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.length > 8 * 1024 * 1024 ||
      !context ||
      typeof context !== "object" ||
      Array.isArray(context) ||
      JSON.stringify(context).length > 160000
    )
      throw Error("양식 또는 필드 데이터를 확인하세요.");
    try {
      await check();
    } catch {
      installing ??= install().finally(() => {
        installing = undefined;
      });
      if (!(await installing)) return null;
    }
    const dir = await mkdtemp(join(tmpdir(), "xdocs-word-"));
    try {
      const input = join(dir, "form.docx"),
        data = join(dir, "fields.json"),
        output = join(dir, "result.docx");
      await writeFile(input, bytes);
      await writeFile(data, JSON.stringify(context));
      await execute(
        python,
        ["-I", "-c", renderScript, input, data, output],
        25000,
      );
      return new Uint8Array(await readFile(output));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
}
