// Resources must be on disk before Electron Builder signs the application.
const path = require("node:path");
const { Arch } = require("builder-util");
module.exports = async (context) => {
  const { prepare } = await import("./prepare-analyzers.mjs");
  const platform = context.electronPlatformName;
  const resources =
    platform === "darwin"
      ? path.join(
          context.appOutDir,
          context.packager.appInfo.productFilename + ".app",
          "Contents",
          "Resources",
        )
      : path.join(context.appOutDir, "resources");
  await prepare(
    platform,
    Arch[context.arch],
    path.join(resources, "analyzer-tools"),
  );
};
