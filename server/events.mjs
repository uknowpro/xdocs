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
  async touch(workspace, id, actor, cursor) {
    const key = "xdocs:presence:" + workspace + ":" + id;
    const member = createHash("sha256")
      .update(actor + (cursor?.client || ""))
      .digest("hex")
      .slice(0, 16);
    const now = Date.now(),
      entry = {
        id: member,
        label: "참여자 " + member.slice(0, 4),
        ...cursor,
        time: now,
      };
    if (this.publisher?.isReady) {
      await this.publisher.hSet(
        key + ":cursors",
        member,
        JSON.stringify(entry),
      );
      await this.publisher.expire(key + ":cursors", 60);
      const values = await this.publisher.hGetAll(key + ":cursors");
      const active = [];
      for (const [who, value] of Object.entries(values)) {
        const peer = JSON.parse(value);
        if (peer.time < now - 20000)
          await this.publisher.hDel(key + ":cursors", who);
        else active.push(peer);
      }
      return active;
    }
    this.presence ??= new Map();
    for (const [room, peers] of this.presence) {
      for (const [who, peer] of peers)
        if (peer.time < now - 20000) peers.delete(who);
      if (!peers.size) this.presence.delete(room);
    }
    const peers = this.presence.get(key) || new Map();
    peers.set(member, entry);
    this.presence.set(key, peers);
    return [...peers.values()];
  }
  async close() {
    await Promise.all([this.publisher?.quit(), this.subscriber?.quit()]);
  }
}
