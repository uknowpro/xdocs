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
  collaborationSync: (id, presence) =>
    ipcRenderer.invoke("collab:sync", id, presence),
  collaborationCopy: (id) => ipcRenderer.invoke("collab:copy", id),
  restoreBackupCopy:()=>ipcRenderer.invoke("vault:restore-copy"),
  backupWorkspace:()=>ipcRenderer.invoke("vault:backup"),
  organizationLogin: (server) => ipcRenderer.invoke("org:login", server),
  organizationOpen: (id) => ipcRenderer.invoke("org:open", id),
  organizationConflicts: () => ipcRenderer.invoke("org:conflicts"),
  organizationResolve: (id, choice) =>
    ipcRenderer.invoke("org:resolve", id, choice),
  organizationLogout: () => ipcRenderer.invoke("org:logout"),
  open: () => ipcRenderer.invoke("vault:open"),
  load: () => ipcRenderer.invoke("vault:load"),
  refresh: () => ipcRenderer.invoke("vault:refresh"),
  create: (title, body, directory) => ipcRenderer.invoke("note:create", title, body, directory),
  save: (data) => ipcRenderer.invoke("note:save", data),
  trashPages: (items) => ipcRenderer.invoke("vault:trash-pages",items),
  trash: (data) => ipcRenderer.invoke("note:trash", data),
  readNote: (id) => ipcRenderer.invoke("note:read", id),
  search: (query) => ipcRenderer.invoke("note:search", query),
  export: (data) => ipcRenderer.invoke("note:export", data),
  importArchitecture: (project = false) =>
    ipcRenderer.invoke("architecture:import", project),
  exportWorkflow: (kind, source) =>
    ipcRenderer.invoke("workflow:export", { kind, source }),
  checkTerraform: model => ipcRenderer.invoke("architecture:validate",model),
  exportArchitecture: (model, format, ids) =>
    ipcRenderer.invoke("architecture:export", { model, format, ids }),
  analyzerSource: (source) => ipcRenderer.invoke("analyzer:source", source),
  analyzerNotices: () => ipcRenderer.invoke("analyzer:notices"),
  analyzeDirectory: request => ipcRenderer.invoke("analyzer:directory",request),
  importInfrastructure: () => ipcRenderer.invoke("infra:import"),
  retrySheetFile: id => ipcRenderer.invoke("sheet:retry", id),
  importSheetDirectory: () => ipcRenderer.invoke("sheet:directory"),
  builderResources:request=>ipcRenderer.invoke("builder:resources",request),
  xcodeAttachment:data=>ipcRenderer.invoke("xcode:attachment",data),
  chooseWordForm: path => ipcRenderer.invoke("word:choose-form",path),
  renderWordTemplate:(bytes,context)=>ipcRenderer.invoke("word:render-template",bytes,context),
  wordHelper:()=>ipcRenderer.invoke("word:helper"),
  wordCapture:()=>ipcRenderer.invoke("word:capture"),
  wordPropose:(handle,text)=>ipcRenderer.invoke("word:propose",handle,text),
  xcodeAppend:data=>ipcRenderer.invoke("xcode:append",data),
  xcodeSkills:()=>ipcRenderer.invoke("xcode:skills"),
  xcodeAuthorize:endpoint=>ipcRenderer.invoke("xcode:authorize",endpoint),
  xcodeChat:request=>ipcRenderer.invoke("xcode:chat",request),
  xcodeCancel:id=>ipcRenderer.invoke("xcode:cancel",id),
  onXcodeDelta:callback=>{
    const listener=(_event,chunk)=>callback(chunk);
    ipcRenderer.on("xcode:delta",listener);
    return ()=>ipcRenderer.removeListener("xcode:delta",listener);
  },
  builderProfiles:()=>ipcRenderer.invoke("builder:profiles"),
  saveBuilderProfile:data=>ipcRenderer.invoke("builder:profile-save",data),
  builderModel: request => ipcRenderer.invoke("builder:model",request),
  importSpreadsheet: () => ipcRenderer.invoke("sheet:import"),
  openAttachment: (relative) => ipcRenderer.invoke("asset:open", relative),
  importMarkdown: () => ipcRenderer.invoke("note:import"),
  documentPermissions: (id, principal, readOnly) =>
    ipcRenderer.invoke("note:permissions", id, principal, readOnly),
  history: (id) => ipcRenderer.invoke("note:history", id),
  restoreHistory: (data) => ipcRenderer.invoke("note:restore-history", data),
  purgeTrash: (tokens) => ipcRenderer.invoke("vault:purge-trash", tokens),
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
