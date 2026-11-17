const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("xdocs", {
  updateStatus: () => ipcRenderer.invoke("update:status"),
  checkUpdate: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdate: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("update:status", listener);
    return () => ipcRenderer.removeListener("update:status", listener);
  },
  collaborationStart: (id) => ipcRenderer.invoke("collab:start", id),
  collaborationUpdate: (packet) => ipcRenderer.invoke("collab:update", packet),
  collaborationSync: (id) => ipcRenderer.invoke("collab:sync", id),
  collaborationCopy: (id) => ipcRenderer.invoke("collab:copy", id),
  organizationLogin: (server) => ipcRenderer.invoke("org:login", server),
  organizationOpen: (id) => ipcRenderer.invoke("org:open", id),
  organizationConflicts: () => ipcRenderer.invoke("org:conflicts"),
  organizationResolve: (id, choice) =>
    ipcRenderer.invoke("org:resolve", id, choice),
  organizationLogout: () => ipcRenderer.invoke("org:logout"),
  open: () => ipcRenderer.invoke("vault:open"),
  load: () => ipcRenderer.invoke("vault:load"),
  refresh: () => ipcRenderer.invoke("vault:refresh"),
  create: (title, body) => ipcRenderer.invoke("note:create", title, body),
  save: (data) => ipcRenderer.invoke("note:save", data),
  trash: (data) => ipcRenderer.invoke("note:trash", data),
  search: (query) => ipcRenderer.invoke("note:search", query),
  export: (data) => ipcRenderer.invoke("note:export", data),
  importMarkdown: () => ipcRenderer.invoke("note:import"),
  history: (id) => ipcRenderer.invoke("note:history", id),
  restoreHistory: (data) => ipcRenderer.invoke("note:restore-history", data),
  listTrash: () => ipcRenderer.invoke("vault:trash"),
  restoreTrash: (token) => ipcRenderer.invoke("vault:restore", token),
  addAttachment: () => ipcRenderer.invoke("asset:add"),
  readAttachment: (relative) => ipcRenderer.invoke("asset:read", relative),
  onChanged: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("vault:changed", listener);
    return () => ipcRenderer.removeListener("vault:changed", listener);
  },
  onWatchError: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on("vault:watch-error", listener);
    return () => ipcRenderer.removeListener("vault:watch-error", listener);
  },
  onClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app:close-request", listener);
    return () => ipcRenderer.removeListener("app:close-request", listener);
  },
  confirmClose: () => ipcRenderer.send("app:close-confirmed"),
});
