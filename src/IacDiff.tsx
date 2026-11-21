import { useMemo, useState } from "react";
import { createTwoFilesPatch } from "diff";
import { generateArchitecture } from "../shared/architecture.mjs";
import type { ArchitectureModel } from "./ArchitectureDocument";
type Files = Record<string, string>;
export default function IacDiff({
  baseline,
  format,
  ids,
  files,
  errors,
}: {
  baseline: ArchitectureModel;
  format: string;
  ids: string[];
  files: Files;
  errors: string[];
}) {
  const baselineId = ids[0];
  const before = useMemo(() => {
    if (baselineId && !baseline.nodes.some((n) => n.id === baselineId))
      return { files: {} as Files, errors: [] };
    return generateArchitecture(
      baseline,
      format,
      baselineId ? [baselineId] : [],
    );
  }, [baseline, format, baselineId]);
  const paths = [
    ...new Set([...Object.keys(before.files), ...Object.keys(files)]),
  ]
    .filter(
      (p) =>
        /^(terraform|cloudformation|manifests|chart)\//.test(p) &&
        before.files[p] !== files[p],
    )
    .sort();
  const [choice, setChoice] = useState("");
  const path = paths.includes(choice) ? choice : paths[0];
  const old = before.files[path],
    next = files[path];
  const diff = useMemo(
    () =>
      path
        ? createTwoFilesPatch(
            path,
            path,
            old ?? "",
            next ?? "",
            "기준",
            "현재",
            { context: 3, timeout: 250 },
          )
        : "",
    [path, old, next],
  );
  if (errors.length || before.errors.length)
    return (
      <p role="status">
        코드를 비교하려면 {errors.length ? "현재 설계" : "기준 설계"}의 설정을
        확인하세요. {errors[0] || before.errors[0]}
      </p>
    );
  const preserved = baseline.sources.filter(f => files["terraform/"+f.name] === f.content);
  const retained = preserved.length ? <details><summary>원문 그대로인 파일 {preserved.length}개</summary>
    <ul>{preserved.map(f=><li key={f.name}>{f.name}{f.preservedDeclarations?.length ? " · 원문 보존 선언 "+f.preservedDeclarations.length+"개" : ""}</li>)}</ul></details> : null;
  if (!paths.length) return <><p>생성된 IaC에 변경이 없습니다.</p>{retained}</>;
  return (
    <div className="iac-diff">
      {retained}
      <label>
        변경 파일{" "}
        <select value={path} onChange={(e) => setChoice(e.target.value)}>
          {paths.map((p) => (
            <option key={p} value={p}>
              {!(p in before.files) ? "추가" : !(p in files) ? "삭제" : "수정"}{" "}
              · {p}
            </option>
          ))}
        </select>
      </label>
      {paths.length > 1 && <nav className="diff-navigation" aria-label="차이 탐색">
        <button disabled={path===paths[0]} onClick={()=>setChoice(paths[paths.indexOf(path)-1])}>이전 변경 파일</button>
        <span>{paths.indexOf(path)+1} / {paths.length}</span>
        <button disabled={path===paths.at(-1)} onClick={()=>setChoice(paths[paths.indexOf(path)+1])}>다음 변경 파일</button>
      </nav>}
      <pre aria-label="IaC 변경 내용">
        {diff ??
          "비교 시간 한도를 초과했습니다. 추출 파일을 로컬 diff 도구에서 비교하세요."}
      </pre>
    </div>
  );
}
