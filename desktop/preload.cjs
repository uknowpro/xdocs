const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("xdocs", {
  open: () => ipcRenderer.invoke("vault:open"),
  load: () => ipcRenderer.invoke("vault:load"),
  refresh: () => ipcRenderer.invoke("vault:refresh"),
  create: (title, body) => ipcRenderer.invoke("note:create", title, body),
  save: (data) => ipcRenderer.invoke("note:save", data),
  trash: (data) => ipcRenderer.invoke("note:trash", data),
  search: (query) => ipcRenderer.invoke("note:search", query),
  export: (data) => ipcRenderer.invoke("note:export", data),
  importMarkdown: () => ipcRenderer.invoke("note:import"),
  onClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app:close-request", listener);
    return () => ipcRenderer.removeListener("app:close-request", listener);
  },
  confirmClose: () => ipcRenderer.send("app:close-confirmed"),
});
