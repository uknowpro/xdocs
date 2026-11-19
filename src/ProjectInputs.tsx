import { useState } from "react";
import type { InputFile } from "./xcode-session";

export default function ProjectInputs({
  onAdd,
}: {
  onAdd: (files: InputFile[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]),
    [query, setQuery] = useState(""),
    [selection, setSelection] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [ranges, setRanges] = useState<Record<string, string>>({});
  const matches = files.filter((f) =>
    f.webkitRelativePath.toLowerCase().includes(query.toLowerCase()),
  );
  async function attach() {
    const chosen = files.filter((f) =>
      selection.includes(f.webkitRelativePath),
    );
    if (chosen.reduce((sum, f) => sum + f.size, 0) > 2 * 1024 * 1024) {
      setMessage("한 번에 선택할 수 있는 텍스트는 2 MiB입니다.");
      return;
    }
    setBusy(true);
    try {
      const result = await Promise.all(
        chosen.map(async (f) => {
          const name = f.webkitRelativePath;
          const text = new TextDecoder("utf-8", { fatal: true }).decode(
            await f.arrayBuffer(),
          );
          const range = ranges[name]?.trim();
          if (!range) return { name, text };
          const match = /^(\d+)(?:-(\d+))?$/.exec(range);
          const first = Number(match?.[1]),
            last = Number(match?.[2] ?? match?.[1]),
            lines = text.split(/\r?\n/);
          if (!match || first < 1 || last < first || last > lines.length)
            throw Error(
              name + " · 줄 범위를 1–" + lines.length + " 사이로 지정하세요.",
            );
          return {
            name: name + "#L" + first + "-L" + last,
            text: lines.slice(first - 1, last).join("\n"),
          };
        }),
      );
      onAdd(result);
      setSelection([]);
      setMessage(result.length + "개 파일 첨부");
    } catch (e) {
      setMessage(
        e instanceof TypeError
          ? "선택한 파일을 UTF-8 텍스트로 읽을 수 없습니다."
          : String(e),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>프로젝트 파일 선택</summary>
      <fieldset disabled={busy}>
        <label>
          프로젝트 폴더
          <input
            type="file"
            multiple
            {...{ webkitdirectory: "" }}
            onChange={(e) => {
              const next = Array.from(e.target.files || []).filter(
                (f) =>
                  !f.webkitRelativePath
                    .split("/")
                    .some(
                      (s) =>
                        s.startsWith(".") ||
                        ["node_modules", "target", "dist", "build"].includes(s),
                    ) &&
                  /\.(md|txt|java|kt|py|go|rs|c|cpp|h|ts|tsx|js|jsx|json|ya?ml|tf|sql|toml|xml)$/i.test(
                    f.name,
                  ) &&
                  f.size <= 2 * 1024 * 1024,
              );
              setFiles(next);
              setSelection([]);
              setRanges({});
              setMessage(next.length + "개 텍스트 파일");
              e.target.value = "";
            }}
          />
        </label>
        {files.length > 0 && (
          <>
            <label>
              프로젝트 경로 검색
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="project-file-list">
              {matches.slice(0, 100).map((f) => (
                <label key={f.webkitRelativePath}>
                  <input
                    type="checkbox"
                    checked={selection.includes(f.webkitRelativePath)}
                    onChange={(e) =>
                      setSelection(
                        e.target.checked
                          ? [...selection, f.webkitRelativePath]
                          : selection.filter((p) => p !== f.webkitRelativePath),
                      )
                    }
                  />
                  {f.webkitRelativePath}
                </label>
              ))}
            </div>
            {selection.map((name) => (
              <label key={name}>
                {name} 줄 범위
                <input
                  placeholder="전체 또는 10-25"
                  value={ranges[name] || ""}
                  onChange={(e) =>
                    setRanges({ ...ranges, [name]: e.target.value })
                  }
                />
              </label>
            ))}
            {matches.length > 100 && (
              <p>검색 결과 {matches.length}개 중 100개 표시</p>
            )}
            <button disabled={!selection.length} onClick={() => void attach()}>
              선택한 파일 {selection.length}개 첨부
            </button>
          </>
        )}
        {message && <small>{message}</small>}
      </fieldset>
    </details>
  );
}
