import { streamChat, readSkills } from "./xcode.mjs";
import { homedir, tmpdir } from "node:os";
import { readAnalyzerSource } from "./analyzer-source.mjs";
import { analyzeDirectory } from "./analyzer.mjs";
import {modelProfiles} from "./builder-profiles.mjs";
import {builderResources} from "./builder-mcp.mjs";
import {runBuilderModel} from "./builder-model.mjs";
import { templates, workflowNodes } from "../shared/workflows.mjs";
import { importArchitecture } from "./architecture-import.mjs";
import {
  generateArchitecture,
  decodeArchitecture,
} from "../shared/architecture.mjs";
import { zipSync, strToU8 } from "fflate";
import { importInfrastructure } from "./infrastructure-import.mjs";
import {
  decodeInfrastructure,
  infrastructureMarkdown,
} from "../shared/infrastructure.mjs";
import { importWithExcel } from "./excel-bridge.mjs";
import { importSpreadsheet } from "./spreadsheet-import.mjs";
import {
  encodeWorkbook,
  decodeWorkbook,
  sheetMarkdown,
} from "../shared/tabular.mjs";
import { initializeUpdates } from "./updates.mjs";
import { OrganizationSession, OrganizationVault } from "./organization.mjs";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  safeStorage,
  shell,
} from "electron";
import { folderBody, withParent } from "../shared/page-parent.mjs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile, writeFile, mkdir, readdir, mkdtemp, rm } from "node:fs/promises";
import { VaultClient } from "./vault-client.mjs";
import { watch } from "chokidar";
import TurndownService from "turndown";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
let watcher, refreshTimer, organization, orgVault, syncTimer;
const directory = path.dirname(fileURLToPath(import.meta.url));
let window,
  vault,
  closeAllowed = false;
const pageURL = pathToFileURL(path.join(directory, "../dist/index.html")).href;
const configPath = () => path.join(app.getPath("userData"), "workspace.json");
const mustVault = () => {
  if (orgVault) return orgVault;
  if (!vault) throw new Error("먼저 보관함을 열어 주세요.");
  return vault;
};
const register = (channel, fn) =>
  ipcMain.handle(channel, async (event, ...args) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== pageURL
    )
      throw new Error("허용되지 않은 요청입니다.");
    return fn(...args);
  });
async function chooseVault(root) {
  const next = await VaultClient.open(root);
  clearInterval(syncTimer);
  await orgVault?.close();
  orgVault = null;
  await watcher?.close();
  clearTimeout(refreshTimer);
  await vault?.close();
  vault = next;
  watcher = watch(root, {
    ignoreInitial: true,
    ignored: (file, stats) =>
      file.split(/[\\/]/).some((p) => p.startsWith(".")) ||
      (stats?.isFile() && !file.toLowerCase().endsWith(".md")),
    awaitWriteFinish: { stabilityThreshold: 350, pollInterval: 100 },
  });
  watcher.on("all", () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      try {
        const snapshot = await next.refresh();
        if (vault === next && !orgVault && !window.isDestroyed())
          window.webContents.send("vault:changed", snapshot);
      } catch (e) {
        if (!window.isDestroyed())
          window.webContents.send("vault:watch-error", e.message);
      }
    }, 400);
  });
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(configPath(), JSON.stringify({ root }));
  return vault.snapshot();
}
function exportHtml(note) {
  let body = note.body;
  try {
    const workbook = decodeWorkbook(body);
    if (workbook)
      body = body.replace(/^```xdocs-sheets\r?\n[^]*?\r?\n```$/m, () =>
        workbook.sheets
          .map(
            (sheet) =>
              "## " +
              sheet.name.replace(/[\r\n]/g, " ") +
              "\n\n" +
              sheetMarkdown(sheet),
          )
          .join("\n\n"),
      );
  } catch {}
  try {
    const infrastructure = decodeInfrastructure(body);
    if (infrastructure)
      body = body.replace(/^```xdocs-infra\r?\n[^]*?\r?\n```$/m, () =>
        infrastructureMarkdown(infrastructure),
      );
  } catch {}
  try {
    const m = decodeArchitecture(body);
    if (m)
      body = body.replace(/^```xdocs-architecture\r?\n[^]*?\r?\n```$/m, () =>
        sheetMarkdown({
          rows: [
            ["컴포넌트", "종류"],
            ...m.nodes.map((n) => [n.label, n.kind]),
          ],
        }),
      );
  } catch {}
  const safe = sanitizeHtml(marked.parse(body), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "input",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      input: ["type", "checked", "disabled"],
      img: ["src", "alt"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
  });
  const title = sanitizeHtml(note.title, {
    allowedTags: [],
    allowedAttributes: {},
  }).replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c],
  );
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${title}</title><style>body{font:15px/1.9 system-ui,sans-serif;color:#222;max-width:760px;margin:60px auto;padding:0 28px}h1,h2,h3{line-height:1.4}pre,blockquote{background:#f3f3f3;padding:16px;white-space:pre-wrap}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}img{max-width:100%}@page{margin:20mm}@media print{body{margin:0;padding:0}pre,blockquote,tr{break-inside:avoid}}</style><body>${safe}</body></html>`;
}
app.whenReady().then(async () => {
  if (process.env.XDOCS_TEST_DATA)
    app.setPath("userData", process.env.XDOCS_TEST_DATA);
  window = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 780,
    minHeight: 600,
    backgroundColor: "#fafafa",
    title: "xdocs",
    webPreferences: {
      preload: path.join(directory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  );
  const updates = initializeUpdates({
    app,
    notify: (state) => {
      if (!window.isDestroyed())
        window.webContents.send("update:status", state);
    },
    prepareInstall: () => {
      closeAllowed = true;
    },
  });
  register("update:status", () => updates.status());
  register("update:check", () => updates.check());
  register("update:download", () => updates.download());
  register("update:install", () => updates.install());
  organization = new OrganizationSession({
    directory: path.join(app.getPath("userData"), "accounts"),
    safeStorage,
    openExternal: (url) => shell.openExternal(url),
  });
  register("org:login", (server) => {
    if (orgVault) {
      if (server.replace(/\/$/, "") !== organization.server)
        throw Error("다른 서버에 연결하려면 먼저 로그아웃해 주세요.");
      return organization.list();
    }
    return organization.login(server);
  });
  register("org:open", async (id) => {
    const list = await organization.list();
    const selected = list.find((w) => w.id === id);
    if (!selected) throw Error("접근할 수 없는 조직 보관함입니다.");
    const next = await OrganizationVault.open(
      path.join(app.getPath("userData"), "organization-data"),
      organization,
      selected,
    );
    clearInterval(syncTimer);
    await orgVault?.close();
    orgVault = next;
    next.metadataOnly = true;
    syncTimer = setInterval(async () => {
      try {
        const snapshot = await next.sync();
        if (orgVault === next && !window.isDestroyed())
          window.webContents.send("vault:changed", snapshot);
      } catch (e) {
        if (orgVault === next && !window.isDestroyed())
          window.webContents.send(
            "vault:watch-error",
            "조직 동기화 대기: " + e.message,
          );
      }
    }, 15000);
    return next.snapshot();
  });
  register("collab:start", (id) => {
    if (!orgVault) throw Error("조직 보관함을 열어 주세요.");
    return orgVault.collaborationStart(id);
  });
  register("collab:update", (packet) => {
    if (!orgVault) throw Error("조직 보관함을 열어 주세요.");
    return orgVault.collaborationUpdate(packet);
  });
  register("collab:sync", (id, presence) => {
    if (!orgVault) throw Error("조직 보관함을 열어 주세요.");
    return orgVault.collaborationSync(id, presence);
  });
  register("collab:copy", (id) => {
    if (!orgVault) throw Error("조직 보관함을 열어 주세요.");
    return orgVault.collaborationCopy(id);
  });
  register("org:conflicts", () => orgVault?.conflicts() || []);
  register("org:resolve", async (id, choice) => {
    if (!orgVault) throw Error("조직 보관함을 열어 주세요.");
    return orgVault.resolveConflict(id, choice);
  });
  register("org:logout", async () => {
    clearInterval(syncTimer);
    await orgVault?.close();
    orgVault = null;
    await organization.logout();
    return vault?.snapshot() || null;
  });
  register("vault:load", async () => {
    if (vault) return vault.snapshot();
    try {
      const config = JSON.parse(await readFile(configPath(), "utf8"));
      return await chooseVault(config.root);
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  });
  register("vault:open", async () => {
    const result = await dialog.showOpenDialog(window, {
      title: "Markdown 보관함 선택",
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : chooseVault(result.filePaths[0]);
  });
  register("vault:refresh", () => mustVault().refresh());
  register("note:create", (title, body) => mustVault().create(title, body));
  register("note:save", (data) => mustVault().save(data));
  register("note:trash", (data) => mustVault().trash(data));
  register("note:read", (id) => mustVault().readNote(id));
  register("note:search", (query) => mustVault().search(query));
  register("note:history", (id) => mustVault().history(id));
  register("note:restore-history", (data) => mustVault().restoreHistory(data));
  register("vault:trash", () => mustVault().listTrash());
  register("vault:restore", (token) => mustVault().restoreTrash(token));
  register("note:permissions", (id, principal, readOnly) => {
    if (!orgVault) throw Error("조직 문서에서만 사용할 수 있습니다.");
    return orgVault.permissions(id, principal, readOnly);
  });
  register("asset:read", (relative) => mustVault().readAttachment(relative));
  register("asset:add", async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: [
        {
          name: "이미지 / PDF",
          extensions: [
            "png",
            "jpg",
            "jpeg",
            "webp",
            "gif",
            "pdf",
            "xlsx",
            "xlsm",
            "xls",
            "xlsb",
            "csv",
            "tsv",
            "txt",
          ],
        },
      ],
    });
    return result.canceled
      ? null
      : mustVault().addAttachment(result.filePaths[0]);
  });
  register("architecture:import", async (project = false) => {
    mustVault();
    const result = await dialog.showOpenDialog(window, {
      properties:
        project === true ? ["openDirectory"] : ["openFile", "multiSelections"],
      filters: [
        { name: "Terraform configuration", extensions: ["tf", "json"] },
      ],
    });
    if (result.canceled) return null;
    return importArchitecture(result.filePaths, project === true);
  });
  register("workflow:export", async ({ kind, source }) => {
    mustVault();
    if (!Object.hasOwn(templates, kind) || typeof source !== "string")
      throw Error("지원하지 않는 캔버스입니다.");
    workflowNodes(kind, source);
    const target = await dialog.showSaveDialog(window, {
      defaultPath: templates[kind].name,
    });
    if (target.canceled) return false;
    await writeFile(target.filePath, source, "utf8");
    return true;
  });
  register("architecture:export", async ({ model, format, ids }) => {
    mustVault();
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string"))
      throw Error("컴포넌트 선택 형식이 잘못되었습니다.");
    const result = generateArchitecture(model, format, ids);
    if (result.errors.length) throw Error(result.errors.join("\n"));
    const target = await dialog.showSaveDialog(window, {
      defaultPath: "xdocs-architecture.zip",
      filters: [{ name: "Architecture code bundle", extensions: ["zip"] }],
    });
    if (target.canceled) return false;
    await writeFile(
      target.filePath,
      zipSync(
        Object.fromEntries(
          Object.entries(result.files).map(([name, content]) => [
            name,
            strToU8(content),
          ]),
        ),
      ),
    );
    return true;
  });
  register("infra:import", async () => {
    mustVault();
    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: [
        {
          name: "Infrastructure JSON / YAML",
          extensions: ["json", "yaml", "yml"],
        },
      ],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return importInfrastructure(result.filePaths[0]);
  });
  register("analyzer:source", readAnalyzerSource);
  register("analyzer:notices", async () => {
    const root = app.isPackaged
      ? path.join(process.resourcesPath, "analyzer-tools", "licenses")
      : path.join(directory, "../.cache/analyzers", process.platform + "-" + process.arch, "licenses");
    async function collect(folder) {
      const result = [];
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) result.push(...await collect(file));
        else if (entry.isFile() && entry.name !== "BUILD-INFO.txt")
          result.push({ name: path.relative(root, file).split(path.sep).join(" / "), text: await readFile(file, "utf8") });
      }
      return result;
    }
    return (await collect(root)).sort((a, b) => a.name.localeCompare(b.name));
  });
  register("analyzer:directory", async request => {
    mustVault();
    const choice = await dialog.showOpenDialog(window,{title:"분석할 프로젝트 폴더 선택",properties:["openDirectory"]});
    if(choice.canceled || !choice.filePaths.length) return null;
    let values;
    if(request.customValues && request.mode.startsWith("helm")) {
      const file=await dialog.showOpenDialog(window,{title:"Helm values 파일",properties:["openFile"],filters:[{name:"YAML",extensions:["yaml","yml"]}]});
      if(file.canceled || !file.filePaths[0]) return null;
      values=file.filePaths[0];
    }
    return analyzeDirectory(choice.filePaths[0], request, values, app.isPackaged ? path.join(process.resourcesPath,"analyzer-tools") : undefined);
  });
  register("builder:resources",async request=>{mustVault();return builderResources(request)});
  const profiles=modelProfiles(app.getPath("userData"),safeStorage);
  const chats = new Map();
  register("xcode:attachment",async ({name,bytes})=>{
    const store = mustVault();
    const ext=path.extname(path.basename(name)).toLowerCase();
    if (![".png",".jpg",".jpeg",".webp",".gif",".pdf"].includes(ext) || !(bytes instanceof Uint8Array) || bytes.byteLength>12*1024*1024)
      throw Error("12MB 이하의 이미지 또는 PDF를 선택하세요.");
    const folder=await mkdtemp(path.join(tmpdir(),"xdocs-input-"));
    try {
      const file=path.join(folder,"input"+ext);
      await writeFile(file,bytes,{mode:0o600});
      return {...await store.addAttachment(file),name:path.basename(name)};
    } finally {await rm(folder,{recursive:true,force:true});}
  });
  register("xcode:skills",()=>readSkills([["사용자",homedir()],...(vault?.root ? [["워크스페이스",vault.root]] : [])]));
  register("xcode:cancel",id=>chats.get(id)?.abort());
  register("xcode:chat",async ({id,profile,...request})=>{
    if(typeof id !== "string" || chats.has(id)) throw Error("중복된 세션 요청입니다.");
    const controller=new AbortController(); chats.set(id,controller);
    try {
      const key=request.key || await profiles.keyFor(profile,request.endpoint,request.model);
      return await streamChat({...request,key},AbortSignal.any([controller.signal,AbortSignal.timeout(600000)]),
        token=>{if(window && !window.isDestroyed()) window.webContents.send("xcode:delta",{id,token});});
    } finally {chats.delete(id);}
  });
  register("builder:profiles",()=>profiles.list());
  register("builder:profile-save",data=>profiles.save(data));
  register("builder:model",async request=>{
    mustVault();
    const key=request.key || await profiles.keyFor(request.profile,request.endpoint,request.model);
    return runBuilderModel({...request,key});
  });
  register("sheet:import", async () => {
    const store = mustVault();
    const result = await dialog.showOpenDialog(window, {
      title: "시트 테이블 가져오기",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Excel / CSV / TSV / xl2txt",
          extensions: ["xlsx", "xlsm", "xls", "xlsb", "csv", "tsv", "txt"],
        },
      ],
    });
    if (result.canceled) return null;
    return importSheetFiles(store, result.filePaths);
  });
  register("sheet:directory", async () => {
    const store = mustVault();
    const choice = await dialog.showOpenDialog(window, {
      title: "Excel 폴더 가져오기",
      properties: ["openDirectory"],
    });
    if (choice.canceled || !choice.filePaths.length) return null;
    const root = choice.filePaths[0];
    const folders = new Map();
    const warnings = [];
    let count = 0,
      first;
    async function folder(dir) {
      if (!folders.has(dir)) {
        const parent =
          dir === root ? undefined : await folder(path.dirname(dir));
        const title = path.basename(dir) || "가져온 시트";
        folders.set(
          dir,
          (await store.create(title, folderBody(parent, title))).id,
        );
      }
      return folders.get(dir);
    }
    async function visit(dir) {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries.sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        const file = path.join(dir, entry.name);
        try {
          if (entry.isDirectory()) await visit(file);
          else if (
            entry.isFile() &&
            !entry.name.startsWith("~$") &&
            /\.(xlsx|xlsm|xlsb|xls|csv|tsv|txt)$/i.test(entry.name)
          ) {
            const result = await importSheetFiles(
              store,
              [file],
              await folder(dir),
            );
            if (result) {
              first ??= result.note;
              count++;
              warnings.push(
                ...result.warnings.map(
                  (w) => path.relative(root, file) + " · " + w,
                ),
              );
            } else warnings.push(path.relative(root, file) + " · 건너뜀");
          }
        } catch (error) {
          warnings.push(path.relative(root, file) + " · " + error.message);
        }
      }
    }
    await visit(root);
    return {
      note: first,
      warnings: [count + "개 파일을 페이지로 가져왔습니다.", ...warnings],
    };
  });
  async function importSheetFiles(store, paths, parent) {
    const sheets = [],
      warnings = [];
    for (const file of paths) {
      try {
        const data = await importSpreadsheet(file);
        sheets.push(...data.workbook.sheets);
        warnings.push(...data.warnings);
      } catch (error) {
        const answer = await dialog.showMessageBox(window, {
          type: "info",
          message: path.basename(file) + " 파일을 직접 읽을 수 없습니다.",
          detail:
            error.message +
            "\n권한·암호·DRM은 우회하지 않습니다. 로컬 앱에서 인증 후 허용되는 CSV/탭 구분 UTF-8 TXT로 내보내고 다시 가져오세요.",
          buttons: [
            "취소",
            "로컬 Excel / 기본 앱으로 열기",
            "원본만 노트에 첨부",
            ...(process.platform === "win32"
              ? ["Excel에서 읽기 전용으로 가져오기"]
              : []),
          ],
          defaultId: 0,
          cancelId: 0,
        });
        if (answer.response === 3) {
          const data = await importWithExcel(file);
          sheets.push(...data.workbook.sheets);
          warnings.push(...data.warnings);
          continue;
        }
        if (answer.response === 1) {
          const failure = await shell.openPath(file);
          if (failure) throw Error(failure);
        }
        if (answer.response === 2) {
          const attachment = await store.addAttachment(file);
          return {
            note: await store.create(
              path.basename(file),
              withParent(
                parent,
                "# " +
                  path.basename(file) +
                  "\n\n[원본 파일](" +
                  attachment.path +
                  ")\n",
              ),
            ),
            warnings: ["원본 파일을 첨부했습니다. 표 변환은 하지 않았습니다."],
          };
        }
        return null;
      }
    }
    const title = path.basename(paths[0], path.extname(paths[0]));
    const note = await store.create(
      title,
      withParent(
        parent,
        "# " + title + "\n\n" + encodeWorkbook({ version: 1, sheets }) + "\n",
      ),
    );
    return { note, warnings: [...new Set(warnings)] };
  }
  register("asset:open", async (relative) => {
    const store = mustVault();
    await store.readAttachment(relative);
    if (orgVault) {
      const result = await dialog.showSaveDialog(window, {
        title: "첨부파일 저장 후 열기",
        defaultPath: path.basename(relative),
      });
      if (result.canceled || !result.filePath) return;
      const asset = await store.readAttachment(relative);
      await writeFile(result.filePath, Buffer.from(asset.data, "base64"));
      const failure = await shell.openPath(result.filePath);
      if (failure) throw Error(failure);
      return;
    }
    const failure = await shell.openPath(path.join(store.root, relative));
    if (failure) throw Error(failure);
  });
  register("note:import", async () => {
    const store = mustVault();
    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Markdown / HTML", extensions: ["md", "html", "htm"] }],
    });
    if (result.canceled) return [];
    const imported = [];
    for (const file of result.filePaths) {
      const raw = await readFile(file, "utf8");
      let body = raw.replace(/^<!-- xdocs:id=[a-f0-9-]{36} -->\r?\n/i, "");
      if (/\.html?$/i.test(file))
        body = new TurndownService({
          headingStyle: "atx",
          codeBlockStyle: "fenced",
        }).turndown(
          sanitizeHtml(raw, {
            allowedTags: sanitizeHtml.defaults.allowedTags,
            allowedAttributes: { a: ["href"] },
            allowedSchemes: ["https", "http", "mailto"],
          }),
        );
      imported.push(
        await store.create(path.basename(file, path.extname(file)), body),
      );
    }
    return imported;
  });
  register("note:export", async ({ id, format }) => {
    if (!["md", "html", "pdf"].includes(format))
      throw new Error("지원하지 않는 내보내기 형식입니다.");
    const note = await mustVault().readNote(id);
    if (!note) throw new Error("노트를 찾을 수 없습니다.");
    const result = await dialog.showSaveDialog(window, {
      defaultPath: note.title.replace(/[<>:"/\\|?*]/g, "-") + "." + format,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (result.canceled) return false;
    if (format === "md") await writeFile(result.filePath, note.body);
    else if (format === "html")
      await writeFile(result.filePath, exportHtml(note));
    else {
      const print = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          javascript: false,
        },
      });
      try {
        await print.loadURL(
          "data:text/html;charset=utf-8," +
            encodeURIComponent(exportHtml(note)),
        );
        const pdf = await print.webContents.printToPDF({
          printBackground: true,
          pageSize: "A4",
        });
        await writeFile(result.filePath, pdf);
      } finally {
        print.destroy();
      }
    }
    return true;
  });
  window.on("close", (event) => {
    if (!closeAllowed) {
      event.preventDefault();
      window.webContents.send("app:close-request");
    }
  });
  ipcMain.on("app:close-confirmed", (event) => {
    if (event.sender === window.webContents) {
      closeAllowed = true;
      window.close();
    }
  });
  await window.loadURL(pageURL);
});
app.on("window-all-closed", async () => {
  clearTimeout(refreshTimer);
  clearInterval(syncTimer);
  await orgVault?.close();
  await watcher?.close();
  await vault?.close();
  app.quit();
});
