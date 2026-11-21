import {boundaryLayout} from "../shared/network-boundaries.mjs";
import { diffLines } from "diff";
import { placementFields } from "../shared/network-boundaries.mjs";
import { useMemo, useState } from "react";
import {
  architectureEdges,
  generateArchitecture,
} from "../shared/architecture.mjs";
import type {
  ArchitectureModel,
  ArchitectureNode,
} from "./ArchitectureDocument";

type Props = {
  placement?: {
    before: ArchitectureModel;
    after: ArchitectureModel;
    id: string;
  };
  before: ArchitectureModel;
  after: ArchitectureModel;
  original: Record<string, string>;
  files: Record<string, string>;
  errors: string[];
  onNode: (id: string) => void;
  onFile: (path: string) => void;
};

function definition(n: ArchitectureNode) {
  return JSON.stringify([
    n.kind,
    n.address,
    n.props,
    n.references,
    n.scopeAddress,
    n.placementValue,
  ]);
}

export default function ArchitectureImpact({
  before,
  placement,
  after,
  original,
  files,
  errors,
  onNode,
  onFile,
}: Props) {
  const previous = useMemo(
    () => new Map(before.nodes.map((n) => [n.id, n])),
    [before],
  );
  const current = new Map(after.nodes.map((n) => [n.id, n]));
  const changed = new Set(
    [...previous.keys(), ...current.keys()].filter((id) => {
      const a = previous.get(id),
        b = current.get(id);
      return !a || !b || definition(a) !== definition(b);
    }),
  );
  const oldEdges = useMemo(() => architectureEdges(before), [before]);
  const newEdges = useMemo(() => architectureEdges(after), [after]);
  const edgeKey = (edge: (typeof oldEdges)[number]) =>
    JSON.stringify([edge.source, edge.field, edge.target]);
  const oldKeys = new Set(oldEdges.map(edgeKey)),
    newKeys = new Set(newEdges.map(edgeKey));
  const rewired = [
    ...oldEdges
      .filter((edge) => !newKeys.has(edgeKey(edge)))
      .map((edge) => ({ edge, state: "해제" })),
    ...newEdges
      .filter((edge) => !oldKeys.has(edgeKey(edge)))
      .map((edge) => ({ edge, state: "연결" })),
  ];
  const move = useMemo(() => {
    if (!placement) return;
    const old = placement.before.nodes.find((n) => n.id === placement.id);
    const next = placement.after.nodes.find((n) => n.id === placement.id);
    const current = after.nodes.find((n) => n.id === placement.id);
    if (!old || !next || !current) return;
    const field = (placementFields as Record<string, string[]>)[next.kind]?.[0];
    const target = (n: ArchitectureNode) => n.scopeAddress || n.props[field] || boundaryLayout(n===old?placement.before:n===next?placement.after:after).parents.get(n.id) || "";
    if (target(current) !== target(next) || target(old) === target(next))
      return;
    const label = (model: ArchitectureModel, key: string) =>
      model.nodes.find((n) => n.id === key)?.label || key;
    const original = generateArchitecture(placement.before, "terraform").files;
    const updated = generateArchitecture(placement.after, "terraform").files;
    const paths = Object.keys({ ...original, ...updated }).filter(
      (p) => /\.tf(?:\.json)?$/.test(p) && original[p] !== updated[p],
    );
    return {
      label: next.address || next.label,
      from: label(placement.before, target(old)),
      to: label(placement.after, target(next)),
      files: paths.map((path) => ({
        path,
        changes: diffLines(original[path] || "", updated[path] || "", {
          timeout: 150,
        }),
      })),
    };
  }, [placement, after]);
  const dependents = new Set(
    [...oldEdges, ...newEdges]
      .filter((edge) => changed.has(edge.target) && !changed.has(edge.source))
      .map((edge) => edge.source),
  );
  const paths = [
    ...new Set([...Object.keys(original), ...Object.keys(files)]),
  ].filter(
    (path) =>
      path.startsWith("terraform/") &&
      /\.tf(?:\.json)?$/.test(path) &&
      original[path] !== files[path],
  );
  const [removedFile, setRemovedFile] = useState("");
  function row(id: string) {
    const n = current.get(id) || previous.get(id)!;
    return (
      <li key={id}>
        {current.has(id) ? (
          <button onClick={() => onNode(id)}>
            {n.label}
            {previous.has(id) ? "" : " (추가)"}
          </button>
        ) : (
          n.label + " (삭제)"
        )}
      </li>
    );
  }
  function rowTarget(id: string) {
    const n = current.get(id);
    return n ? (
      <button onClick={() => onNode(id)}>{n.label}</button>
    ) : (
      previous.get(id)?.label
    );
  }
  return (
    <div className="impact-body">
      {move && (
        <section aria-label="배치 변경과 Terraform 차이">
          <p>
            {move.label} · <del>{move.from}</del> → <ins>{move.to}</ins>
          </p>
          {move.files.map(({ path, changes }) => {
            return (
              <div key={path}>
                <small>{path}</small>
                {changes ? (
                  <pre>
                    {changes
                      .filter((c) => c.added || c.removed)
                      .map((c, i) => (
                        <span
                          key={i}
                          className={c.added ? "live-added" : "live-removed"}
                        >
                          {c.value.replace(
                            /^./gm,
                            (char) => (c.added ? "+ " : "− ") + char,
                          )}
                        </span>
                      ))}
                  </pre>
                ) : (
                  <p>파일이 커서 변경 줄 비교 시간을 초과했습니다.</p>
                )}
              </div>
            );
          })}
        </section>
      )}
      {changed.size > 0 && (
        <>
          <strong>직접 수정한 리소스</strong>
          <ul>{[...changed].map(row)}</ul>
        </>
      )}
      {dependents.size > 0 && (
        <>
          <strong>직접 참조하는 리소스</strong>
          <ul>{[...dependents].map(row)}</ul>
        </>
      )}
      {rewired.length > 0 && (
        <>
          <strong>참조 변경</strong>
          <ul>
            {rewired.map(({ edge, state }) => (
              <li key={state + edgeKey(edge)}>
                {state} ·{" "}
                {(current.get(edge.source) || previous.get(edge.source))?.label}{" "}
                → {rowTarget(edge.target)}
              </li>
            ))}
          </ul>
        </>
      )}
      {errors.length > 0 ? (
        <p role="status">
          Terraform 생성 오류를 해결하면 파일을 비교할 수 있습니다.
        </p>
      ) : paths.length > 0 ? (
        <>
          <strong>변경된 Terraform 파일</strong>
          <ul>
            {paths.map((path) => (
              <li key={path}>
                <button
                  onClick={() =>
                    files[path] === undefined
                      ? setRemovedFile(path)
                      : onFile(path)
                  }
                >
                  {path}
                  {files[path] === undefined ? " (삭제)" : ""}
                </button>
              </li>
            ))}
          </ul>
          {paths.includes(removedFile) && files[removedFile] === undefined && (
            <pre>{original[removedFile]}</pre>
          )}
        </>
      ) : (
        <p>열었을 때와 비교해 Terraform 파일 변경이 없습니다.</p>
      )}
    </div>
  );
}
