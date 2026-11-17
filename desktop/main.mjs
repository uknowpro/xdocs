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
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile, writeFile, mkdir } from "node:fs/promises";
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
    const sheets = [],
      warnings = [];
    for (const file of result.filePaths) {
      try {
        const data = await importSpreadsheet(file);
        sheets.push(...data.workbook.sheets);
        warnings.push(...data.warnings);
      } catch (error) {
        const answer = await dialog.showMessageBox(window, {
          type: "info",
          message: "시트 파일을 직접 읽을 수 없습니다.",
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
              "# " +
                path.basename(file) +
                "\n\n[원본 파일](" +
                attachment.path +
                ")\n",
            ),
            warnings: ["원본 파일을 첨부했습니다. 표 변환은 하지 않았습니다."],
          };
        }
        return null;
      }
    }
    const title = path.basename(
      result.filePaths[0],
      path.extname(result.filePaths[0]),
    );
    const note = await store.create(
      title,
      "# " + title + "\n\n" + encodeWorkbook({ version: 1, sheets }) + "\n",
    );
    return { note, warnings: [...new Set(warnings)] };
  });
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
