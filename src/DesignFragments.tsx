import { useMemo, useState } from "react";
import {
  COMPONENTS,
  newComponent,
  validateArchitecture,
  newArchitecture,
} from "../shared/architecture.mjs";
import { boundaryLayout } from "../shared/network-boundaries.mjs";
import type {
  ArchitectureModel,
  ArchitectureNode,
} from "./ArchitectureDocument";
import type { Note } from "./types";
import { api } from "./api";

export const fragmentMarker = "<!-- xdocs-design-fragment-v1 -->";
type Fragment = { nodes: ArchitectureNode[] };
type Props = {
  model: ArchitectureModel;
  selected: string;
  readonly: boolean;
  notes: Note[];
  save: (name: string, body: string) => Promise<void>;
  insert: (m: ArchitectureModel) => void;
};
function readFragment(body: string): Fragment {
  const encoded = body.match(/^```xdocs-fragment\n([^\n]+)\n```/m)?.[1];
  if (!encoded) throw Error("템플릿 내용을 읽을 수 없습니다.");
  const fragment = JSON.parse(encoded);
  validateArchitecture({ ...newArchitecture(), nodes: fragment.nodes });
  if (
    !fragment.nodes.length ||
    fragment.nodes.some((n: ArchitectureNode) => n.imported)
  )
    throw Error("지원되지 않는 설계 조각입니다.");
  return fragment;
}
export default function DesignFragments({
  model,
  selected,
  readonly,
  notes,
  save,
  insert,
}: Props) {
  const [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [fragment, setFragment] = useState<Fragment>(),
    [choice, setChoice] = useState(""),
    [bindings, setBindings] = useState<Record<string, string>>({});
  const saved = notes.filter((n) => n.body.includes(fragmentMarker));
  const group = useMemo(() => {
    const { parents } = boundaryLayout(model);
    const ids = new Set([selected]);
    for (const ancestor of ids)
      for (const [child, parent] of parents)
        if (parent === ancestor) ids.add(child);
    return model.nodes.filter((n) => ids.has(n.id));
  }, [model, selected]);
  const ids = new Set(fragment?.nodes.map((n) => n.id));
  const external = (fragment?.nodes || []).flatMap((n) =>
    Object.entries(COMPONENTS[n.kind]?.fields || {}).flatMap(
      ([field, spec]: [string, any]) =>
        spec.ref && n.props[field] && !ids.has(n.props[field])
          ? [
              {
                key: n.id + "." + field,
                label: n.label + " · " + spec.label,
                kind: spec.ref,
              },
            ]
          : [],
    ),
  );
  const collisions = fragment?.nodes.filter((n) =>
    model.nodes.some(
      (m) =>
        m.label === n.label ||
        (n.props.name && m.kind === n.kind && m.props.name === n.props.name),
    ),
  );
  async function store() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      if (saved.some((n) => n.title === name.trim()))
        throw Error("같은 이름의 템플릿이 있습니다.");
      await save(
        name.trim(),
        fragmentMarker +
          "\n\n```xdocs-fragment\n" +
          JSON.stringify({ nodes: group }).replaceAll("`", "\\u0060") +
          "\n```",
      );
      setMessage("워크스페이스에 저장했습니다.");
      setName("");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function load(id: string) {
    setChoice(id);
    setBindings({});
    setFragment(undefined);
    setMessage("");
    if (!id) return;
    setBusy(true);
    try {
      const note = saved.find((n) => n.id === id)!;
      setFragment(
        readFragment(
          (note.unloaded && api.readNote ? await api.readNote(id) : note).body,
        ),
      );
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  function apply() {
    if (!fragment) return;
    try {
      const copies = fragment.nodes.map(
        (n) =>
          newComponent(
            n.kind,
            Math.min(n.x + 40, 10000),
            Math.min(n.y + 40, 10000),
          ) as ArchitectureNode,
      );
      const mapped = new Map(
        fragment.nodes.map((n, i) => [n.id, copies[i].id]),
      );
      fragment.nodes.forEach((n, i) => {
        const copy = copies[i];
        copy.label = n.label;
        copy.props = { ...n.props };
        for (const [field, spec] of Object.entries(
          COMPONENTS[n.kind].fields,
        ) as [string, { ref?: string }][])
          if (spec.ref && n.props[field])
            copy.props[field] =
              mapped.get(n.props[field]) || bindings[n.id + "." + field] || "";
      });
      const next = { ...model, nodes: [...model.nodes, ...copies] };
      validateArchitecture(next);
      insert(next);
      setChoice("");
      setFragment(undefined);
      setMessage("설계에 삽입했습니다.");
    } catch (e) {
      setMessage(String(e));
    }
  }
  return (
    <details className="arch-review-issues">
      <summary>워크스페이스 설계 템플릿</summary>
      {model.sources.length > 0 && (
        <p>워크스페이스 템플릿은 새 캔버스에서 조합할 수 있습니다.</p>
      )}
      <fieldset disabled={readonly || busy || model.sources.length > 0}>
        <label>
          템플릿 이름
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={90}
          />
        </label>
        <button
          disabled={
            !name.trim() || !group.length || group.some((n) => n.imported)
          }
          onClick={store}
        >
          선택 영역 저장 ({group.length})
        </button>
        {group.some((n) => n.imported) && (
          <p>
            원본 Terraform 선언은 원본 파일과 함께 보관됩니다. 이 기능은
            캔버스에서 만든 컴포넌트를 지원합니다.
          </p>
        )}
        <label>
          저장된 설계
          <select value={choice} onChange={(e) => void load(e.target.value)}>
            <option value="">템플릿 선택</option>
            {saved.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        </label>
        {fragment && (
          <>
            <p>
              {fragment.nodes.length}개 리소스 · 외부 참조 {external.length}개
            </p>
            {!!collisions?.length && (
              <p>
                동일 이름 확인: {collisions.map((n) => n.label).join(", ")}.
                삽입 후 배포 이름을 검토하세요.
              </p>
            )}
            {external.map((ref) => (
              <label key={ref.key}>
                {ref.label}
                <select
                  value={bindings[ref.key] || ""}
                  onChange={(e) =>
                    setBindings({ ...bindings, [ref.key]: e.target.value })
                  }
                >
                  <option value="">연결 대상 선택</option>
                  {model.nodes
                    .filter((n) => n.kind === ref.kind && !n.imported)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                </select>
              </label>
            ))}
            <button
              disabled={external.some((r) => !bindings[r.key])}
              onClick={apply}
            >
              설계에 삽입
            </button>
          </>
        )}
      </fieldset>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
