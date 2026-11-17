import { editText } from "../shared/collab-blocks.mjs";
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { X, Users } from "lucide-react";
import { api } from "./api";
import type { Note, CollaborationPacket } from "./types";
const encode = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};
const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export default function CollaborationEditor({
  note,
  onClose,
  onCopy,
  registerGuard,
}: {
  note: Note;
  onClose: () => void;
  onCopy: (note: Note) => void;
  registerGuard: (guard: (() => Promise<boolean>) | null) => void;
}) {
  const [participants, setParticipants] = useState(0);
  const [blocks, setBlocks] = useState<{ id: string; text: string }[]>([]);
  const [peers, setPeers] = useState<
    NonNullable<CollaborationPacket["participants"]>
  >([]);
  const cursor = useRef({ client: crypto.randomUUID(), block: "", offset: 0 });
  const [text, setText] = useState(""),
    [status, setStatus] = useState("연결 중…"),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  const document = useRef<Y.Doc | null>(null),
    generation = useRef(""),
    queue = useRef<Promise<unknown>>(Promise.resolve()),
    composing = useRef(false),
    deferred = useRef<CollaborationPacket | null>(null);
  useEffect(() => {
    registerGuard(async () => {
      try {
        await queue.current;
        return true;
      } catch {
        setError("공동 편집 변경이 저장되지 않았습니다. 내용을 복사해 주세요.");
        return false;
      }
    });
    return () => registerGuard(null);
  }, [registerGuard]);
  useEffect(() => {
    let disposed = false,
      busy = false;
    const doc = new Y.Doc();
    document.current = doc;
    const shared = doc.getText("markdown");
    const observer = () => {
      setText(shared.toString());
      setBlocks(
        doc
          .getArray<Y.Map<unknown>>("blocks")
          .toArray()
          .map((b) => ({
            id: b.get("id") as string,
            text: (b.get("text") as Y.Text).toString(),
          })),
      );
    };
    doc.on("afterTransaction", observer);
    const apply = (p: CollaborationPacket) => {
      setParticipants(p.participants?.length || 1);
      setPeers(
        (p.participants || []).filter(
          (p) => p.client !== cursor.current.client,
        ),
      );
      if (composing.current) {
        deferred.current = p;
        return;
      }
      Y.applyUpdate(doc, decode(p.state), "remote");
      setStatus(
        p.pending ? "이 기기에 저장됨 · 동기화 대기" : "서버와 동기화됨",
      );
    };
    const update = (_update: Uint8Array, origin: unknown) => {
      if (origin !== "local") return;
      setStatus("이 기기에 저장 중…");
      const packet = {
        id: note.id,
        generation: generation.current,
        state: encode(Y.encodeStateAsUpdate(doc)),
      };
      queue.current = queue.current
        .catch(() => {})
        .then(() => api.collaborationUpdate!(packet))
        .then(() => {
          if (!disposed) setStatus("이 기기에 저장됨 · 동기화 대기");
        })
        .catch((e) => {
          if (!disposed) {
            setError(String(e));
            setStatus("저장 실패 · 내용을 복사해 주세요");
          }
          throw e;
        });
      queue.current.catch(() => {});
    };
    doc.on("update", update);
    const initial = api.collaborationStart!(note.id)
      .then((p) => {
        if (disposed) return;
        generation.current = p.generation;
        apply(p);
        setReady(true);
        if (p.error) setError(p.error);
      })
      .catch((e) => {
        if (!disposed) setError(String(e));
      });
    const timer = setInterval(async () => {
      if (busy || !generation.current || composing.current) return;
      busy = true;
      try {
        await queue.current;
        const p = await api.collaborationSync!(note.id, cursor.current);
        if (!disposed) {
          apply(p);
          setError("");
        }
      } catch (e) {
        if (!disposed) {
          setError(String(e));
          setStatus("연결 대기 · 기기에 보관됨");
        }
      } finally {
        busy = false;
      }
    }, 1000);
    return () => {
      disposed = true;
      clearInterval(timer);
      doc.off("afterTransaction", observer);
      doc.off("update", update);
      doc.destroy();
      document.current = null;
    };
  }, [note.id]);
  function change(value: string, id?: string) {
    const doc = document.current;
    if (!doc) return;
    const target = id
      ? (doc
          .getArray<Y.Map<unknown>>("blocks")
          .toArray()
          .find((b) => b.get("id") === id)
          ?.get("text") as Y.Text)
      : doc.getText("markdown");
    if (target) editText(doc, target, value);
  }
  function addBlock() {
    const doc = document.current;
    if (!doc) return;
    doc.transact(() => {
      const b = new Y.Map();
      b.set("id", crypto.randomUUID());
      b.set("text", new Y.Text());
      doc.getArray("blocks").push([b]);
    }, "local");
  }
  function endComposition() {
    composing.current = false;
    if (deferred.current && document.current) {
      Y.applyUpdate(document.current, decode(deferred.current.state), "remote");
      deferred.current = null;
    }
  }
  async function close() {
    try {
      await queue.current;
      onClose();
    } catch {
      setError(
        "저장되지 않은 변경이 있습니다. 내용을 복사한 뒤 다시 시도해 주세요.",
      );
    }
  }
  return (
    <div className="overlay">
      <section
        className="dialog collaboration-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="실시간 공동 편집"
      >
        <header>
          <h2>
            <Users size={18} />
            공동 편집 · {note.title}
          </h2>
          <button className="button" onClick={() => void close()}>
            <X size={16} />
            닫기
          </button>
        </header>
        <p className="small-text muted">
          Markdown 블록 공동 편집 · 약 1초 간격으로 변경을 병합합니다. 오프라인
          변경은 이 기기에 보존합니다.
        </p>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        {blocks.length ? (
          <div className="collaboration-blocks">
            {blocks.map((block, index) => (
              <div className="collaboration-block" key={block.id}>
                <div className="small-text muted">
                  블록 {index + 1}{" "}
                  {peers
                    .filter((peer) => peer.block === block.id)
                    .map((peer) => (
                      <span className="tag" key={peer.id}>
                        {peer.label} · 커서 {(peer.offset || 0) + 1}
                      </span>
                    ))}
                </div>
                <textarea
                  aria-label={`공동 편집 블록 ${index + 1}`}
                  disabled={!ready}
                  value={block.text}
                  onChange={(e) => change(e.target.value, block.id)}
                  onSelect={(e) => {
                    cursor.current = {
                      ...cursor.current,
                      block: block.id,
                      offset: e.currentTarget.selectionStart,
                    };
                  }}
                  onCompositionStart={() => {
                    composing.current = true;
                  }}
                  onCompositionEnd={endComposition}
                />
                <button
                  className="text-button"
                  disabled={!ready || blocks.length === 1}
                  onClick={() => {
                    const doc = document.current;
                    if (doc)
                      doc.transact(
                        () => doc.getArray("blocks").delete(index, 1),
                        "local",
                      );
                  }}
                >
                  블록 삭제
                </button>
              </div>
            ))}
            <button className="button" disabled={!ready} onClick={addBlock}>
              블록 추가
            </button>
          </div>
        ) : (
          <textarea
            aria-label="공동 편집 본문"
            disabled={!ready}
            value={text}
            onChange={(e) => change(e.target.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={endComposition}
          />
        )}
        <footer>
          <span role="status">
            {status} · {participants}명 참여 중
          </span>
          <button
            className="button"
            disabled={!ready}
            onClick={async () => {
              try {
                await queue.current;
                onCopy(await api.collaborationCopy!(note.id));
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            내 내용 사본 보존
          </button>
        </footer>
      </section>
    </div>
  );
}
