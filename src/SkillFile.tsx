import { parse, stringify } from "yaml";
import { useRef } from "react";
export type SkillText = { name: string; instruction: string };
export default function SkillFile({
  name,
  instruction,
  onRead,
  onError,
}: {
  name: string;
  instruction: string;
  onRead: (s: SkillText) => void;
  onError: (message: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  function download() {
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60)
        .replace(/-$/, "") || "xdocs-review";
    const data =
      "---\n" +
      stringify({
        name: slug,
        description: name || "시트 검토",
        metadata: { title: name },
      }) +
      "---\n\n" +
      instruction +
      "\n";
    const url = URL.createObjectURL(
      new Blob([data], { type: "text/markdown" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "SKILL.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function read(f: File) {
    if (f.size > 100000) throw Error("스킬 지침은 100 KB 이하로 선택하세요.");
    const match = (await f.text()).match(
      /^---\r?\n([^]*?)\r?\n---\r?\n([^]*)$/,
    );
    if (!match) throw Error("SKILL.md의 메타데이터와 본문을 확인하세요.");
    const meta = parse(match[1]);
    const instruction = match[2].trim();
    if (
      typeof meta?.name !== "string" ||
      typeof meta?.description !== "string" ||
      !instruction
    )
      throw Error("스킬 이름, 설명, 지침이 필요합니다.");
    onRead({
      name:
        typeof meta.metadata?.title === "string"
          ? meta.metadata.title
          : meta.name,
      instruction,
    });
  }
  return (
    <>
      <button onClick={download}>SKILL.md 저장</button>
      <button onClick={() => file.current?.click()}>스킬 지침 가져오기</button>
      <input
        hidden
        ref={file}
        type="file"
        accept=".md"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void read(f).catch((e) => onError(String(e)));
        }}
      />
    </>
  );
}
