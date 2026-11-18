import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { builderEndpoint } from "./builder-model.mjs";
export function modelProfiles(directory, storage) {
  const file = path.join(directory, "builder-models.json");
  let queue = Promise.resolve();
  async function read() {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }
  function canStore() {
    return (
      storage.isEncryptionAvailable() &&
      !(
        process.platform === "linux" &&
        storage.getSelectedStorageBackend?.() === "basic_text"
      )
    );
  }
  const summary = (items) =>
    items.map(({ name, endpoint, model, secret }) => ({
      name,
      endpoint,
      model,
      hasKey: !!secret,
    }));
  return {
    async list() {
      await queue;
      return summary(await read());
    },
    save({ name, endpoint, model, key, remember }) {
      const action = queue.then(async () => {
        builderEndpoint(endpoint);
        if (
          typeof name !== "string" ||
          !name.trim() ||
          name.length > 100 ||
          typeof model !== "string" ||
          !model.trim()
        )
          throw Error("프로필 이름과 모델 이름을 확인하세요.");
        const items = await read();
        const profile = { name: name.trim(), endpoint, model };
        if (remember) {
          if (!key || !canStore())
            throw Error(
              "키를 보관하려면 운영체제 암호화 저장소와 API 키가 필요합니다.",
            );
          profile.secret = storage.encryptString(key).toString("base64");
        }
        const next = [...items.filter((p) => p.name !== profile.name), profile];
        await writeFile(file + ".tmp", JSON.stringify(next), { mode: 0o600 });
        await rename(file + ".tmp", file);
        return summary(next);
      });
      queue = action.catch(() => {});
      return action;
    },
    async keyFor(name, endpoint, model) {
      if (!name) return "";
      await queue;
      const item = (await read()).find(
        (p) => p.name === name && p.endpoint === endpoint && p.model === model,
      );
      if (!item?.secret) return "";
      if (!canStore()) throw Error("운영체제 키 저장소를 열 수 없습니다.");
      return storage.decryptString(Buffer.from(item.secret, "base64"));
    },
  };
}
