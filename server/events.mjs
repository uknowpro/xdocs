import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { createClient } from "redis";
export class Events extends EventEmitter {
  async connect(url) {
    if (!url) return;
    this.publisher = createClient({ url });
    this.subscriber = this.publisher.duplicate();
    this.publisher.on("error", () => {});
    this.subscriber.on("error", () => {});
    await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
    await this.subscriber.subscribe("xdocs:changes", (message) => {
      try {
        this.emit("change", JSON.parse(message));
      } catch {}
    });
  }
  async publish(event) {
    if (this.publisher?.isReady)
      await this.publisher.publish("xdocs:changes", JSON.stringify(event));
    else this.emit("change", event);
  }
  async touch(workspace, id, actor) {
    const key = "xdocs:presence:" + workspace + ":" + id,
      member = createHash("sha256").update(actor).digest("hex").slice(0, 10),
      now = Date.now();
    if (this.publisher?.isReady) {
      await this.publisher.zAdd(key, { score: now, value: member });
      await this.publisher.zRemRangeByScore(key, 0, now - 20000);
      await this.publisher.expire(key, 60);
      const members = await this.publisher.zRange(key, 0, -1);
      return members.map((id) => ({ id, label: "참여자 " + id.slice(0, 4) }));
    }
    this.presence ??= new Map();
    const peers = this.presence.get(key) || new Map();
    peers.set(member, now);
    for (const [who, time] of peers) if (time < now - 20000) peers.delete(who);
    this.presence.set(key, peers);
    return [...peers.keys()].map((id) => ({
      id,
      label: "참여자 " + id.slice(0, 4),
    }));
  }
  async close() {
    await Promise.all([this.publisher?.quit(), this.subscriber?.quit()]);
  }
}
