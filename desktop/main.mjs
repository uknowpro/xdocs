import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Vault } from "./store.mjs";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
const directory = path.dirname(fileURLToPath(import.meta.url));
let window,
  vault,
  closeAllowed = false;
const pageURL = pathToFileURL(path.join(directory, "../dist/index.html")).href;
const configPath = () => path.join(app.getPath("userData"), "workspace.json");
const mustVault = () => {
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
  const next = await Vault.open(root);
  vault?.close();
  vault = next;
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(configPath(), JSON.stringify({ root }));
  return vault.snapshot();
}
function exportHtml(note) {
  const safe = sanitizeHtml(marked.parse(note.body), {
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
  register("note:search", (query) => mustVault().search(query));
  register("note:import", async () => {
    const store = mustVault();
    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (result.canceled) return [];
    const imported = [];
    for (const file of result.filePaths) {
      const raw = await readFile(file, "utf8");
      const body = raw.replace(/^<!-- xdocs:id=[a-f0-9-]{36} -->\r?\n/i, "");
      imported.push(await store.create(path.basename(file, ".md"), body));
    }
    return imported;
  });
  register("note:export", async ({ id, format }) => {
    if (!["md", "html", "pdf"].includes(format))
      throw new Error("지원하지 않는 내보내기 형식입니다.");
    const note = mustVault()
      .snapshot()
      .notes.find((n) => n.id === id);
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
app.on("window-all-closed", () => {
  vault?.close();
  app.quit();
});
