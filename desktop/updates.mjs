import updater from "electron-updater";
const { autoUpdater } = updater;
export function initializeUpdates({ app, notify, prepareInstall }) {
  let state = {
    status: "idle",
    version: app.getVersion(),
    message: "업데이트를 확인할 수 있습니다.",
  };
  const update = (next) => {
    state = { ...state, ...next };
    notify(state);
  };
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on("checking-for-update", () =>
    update({ status: "checking", message: "새 버전 확인 중…" }),
  );
  autoUpdater.on("update-available", (info) =>
    update({
      status: "available",
      version: info.version,
      message: "새 버전이 있습니다.",
    }),
  );
  autoUpdater.on("update-not-available", () =>
    update({ status: "current", message: "최신 버전입니다." }),
  );
  autoUpdater.on("download-progress", (progress) =>
    update({
      status: "downloading",
      message: `다운로드 ${Math.round(progress.percent)}%`,
    }),
  );
  autoUpdater.on("update-downloaded", (info) =>
    update({
      status: "ready",
      version: info.version,
      message: "저장 후 다시 시작하면 업데이트합니다.",
    }),
  );
  autoUpdater.on("error", () =>
    update({
      status: "error",
      message:
        "업데이트를 확인하지 못했습니다. 릴리스 배포 여부와 네트워크를 확인해 주세요.",
    }),
  );
  return {
    status: () => state,
    async check() {
      if (!app.isPackaged) {
        update({
          status: "development",
          message:
            "개발 실행은 git pull 후 npm ci로 업데이트하세요. 보관함은 유지됩니다.",
        });
        return state;
      }
      await autoUpdater.checkForUpdates();
      return state;
    },
    async download() {
      if (state.status !== "available")
        throw Error("먼저 새 버전을 확인해 주세요.");
      await autoUpdater.downloadUpdate();
      return state;
    },
    install() {
      if (state.status !== "ready")
        throw Error("다운로드된 업데이트가 없습니다.");
      prepareInstall();
      autoUpdater.quitAndInstall(false, true);
    },
  };
}
