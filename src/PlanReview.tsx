import { useEffect, useRef, useState } from "react";
import { architectureEdges } from "../shared/architecture.mjs";
import { reviewPlan, planNode } from "../shared/plan-review.mjs";
import type { ArchitectureModel } from "./ArchitectureDocument";

export type PlanRows = {
  address: string;
  action: string;
  module: string;
  declaration: string;
  index: string;
  reason: string;
  wholeReplacement: boolean;
  fields: {
    key: string;
    before: string;
    after: string;
    replacementPaths: string[];
  }[];
}[];
export default function PlanReview({
  model,
  selected,
  rows,
  setRows,
  onNode,
  saveReview,
  readonly,
}: {
  saveReview: (text: string) => Promise<void>;
  readonly: boolean;
  selected: string;
  model: ArchitectureModel;
  rows: PlanRows;
  setRows: (r: PlanRows) => void;
  onNode: (id: string) => void;
}) {
  const [status, setStatus] = useState("");
  const [moduleFilter, setModuleFilter] = useState("*"),
    [actionFilter, setActionFilter] = useState(""),
    [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<number>>(new Set()),
    [checklist, setChecklist] = useState(""),
    [saving, setSaving] = useState(false);
  const visible = rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        (moduleFilter === "*" || row.module === moduleFilter) &&
        (!actionFilter || row.action === actionFilter) &&
        row.address.toLowerCase().includes(search.trim().toLowerCase()),
    );
  const summary = [
    "생성",
    "수정",
    "교체",
    "삭제",
    ...new Set(rows.map((row) => row.action)),
  ].filter((v, i, a) => a.indexOf(v) === i);
  function clearSelection() {
    setChecked(new Set());
    setChecklist("");
    setSearch("");
    setModuleFilter("*");
    setActionFilter("");
  }
  async function save() {
    if (saving || readonly || !checked.size) return;
    setSaving(true);
    try {
      const lines: string[] = [];
      const text = (value: string) =>
        value
          .replace(/[\r\n]+/g, " ")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replace(/([\\`*_{}\[\]#!|])/g, "\\$1");
      const edges = architectureEdges(model);
      for (const index of checked) {
        const row = rows[index];
        if (!row) continue;
        lines.push("## " + text(row.action + " · " + row.address), "");
        const id = planNode(row.address, model.nodes);
        const neighbours = new Set(
          edges.filter((edge) => edge.target === id).map((edge) => edge.source),
        );
        const linked = model.nodes
          .filter((n) => neighbours.has(n.id))
          .map((n) => n.label);
        lines.push(
          id
            ? "도면 리소스 · " +
                text(model.nodes.find((n) => n.id === id)!.label)
            : "도면에 대응하는 리소스 없음",
          "",
        );
        if (linked.length)
          lines.push("직접 참조하는 리소스 · " + text(linked.join(", ")), "");
        if (row.action === "교체")
          lines.push("교체 근거 · " + text(reason(row)), "");
        for (const f of row.fields)
          lines.push(
            "- " + text(f.key) + " · " + text(f.before) + " → " + text(f.after),
          );
        lines.push("");
      }
      lines.push(
        "## 확인할 사항",
        "",
        ...checklist
          .split("\n")
          .filter((s) => s.trim())
          .map((s) => "- [ ] " + text(s)),
      );
      await saveReview(lines.join("\n"));
      setChecked(new Set());
      setStatus("검토 노트를 저장했습니다.");
    } catch (e) {
      setStatus(String(e));
    } finally {
      setSaving(false);
    }
  }
  function reason(row: PlanRows[number]) {
    const paths = row.fields.flatMap((f) => f.replacementPaths);
    return (
      [
        ...paths,
        ...(row.wholeReplacement ? ["리소스 전체"] : []),
        ...(row.reason ? [row.reason] : []),
      ].join(" · ") || "계획에 사유 없음"
    );
  }
  const generation = useRef(0);
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const items =
      panel.current?.querySelectorAll<HTMLDetailsElement>("[data-plan-node]");
    if (!items || !panel.current || !rows.length) return;
    for (const item of items) {
      item.open = item.dataset.planNode === selected;
      if (item.open) panel.current.open = true;
    }
  }, [rows, selected]);
  return (
    <details ref={panel} className="arch-review-issues">
      <summary>Terraform plan 검토</summary>
      <label>
        로컬 plan JSON
        <input
          type="file"
          accept=".json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const ticket = ++generation.current;
            clearSelection();
            setRows([]);
            setStatus("읽는 중…");
            try {
              if (file.size > 32 * 1024 * 1024) throw Error();
              const next = reviewPlan(JSON.parse(await file.text()));
              if (ticket === generation.current) {
                setRows(next);
                setStatus(file.name + " · " + next.length + "개 항목");
              }
            } catch {
              if (ticket === generation.current)
                setStatus(
                  "plan JSON을 읽지 못했습니다. 형식과 크기(최대 32 MiB)를 확인하세요.",
                );
            }
          }}
        />
      </label>
      {status && <p role="status">{status}</p>}
      {rows.length > 0 && (
        <button
          onClick={() => {
            generation.current++;
            clearSelection();
            setRows([]);
            setStatus("");
          }}
        >
          계획 닫기
        </button>
      )}
      {rows.length > 0 && (
        <>
          <p aria-label="작업 건수">
            {summary
              .map(
                (action) =>
                  action +
                  " " +
                  rows.filter((row) => row.action === action).length,
              )
              .join(" · ")}
          </p>
          <label>
            모듈 경로
            <select
              aria-label="모듈 경로"
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <option value="*">전체 모듈</option>
              {[...new Set(rows.map((r) => r.module))].map((m) => (
                <option key={m} value={m}>
                  {m || "루트 모듈"}
                </option>
              ))}
            </select>
          </label>
          <label>
            작업 필터
            <select
              aria-label="작업 필터"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">전체 작업</option>
              {summary.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            인스턴스 주소 검색
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          {!visible.length && <p>일치하는 인스턴스가 없습니다.</p>}
        </>
      )}
      {visible.map(({ row, index }) => {
        const id = planNode(row.address, model.nodes);
        return (
          <details key={index} data-plan-node={id || ""}>
            <summary>
              {row.action} · {row.address}
            </summary>
            <label>
              <input
                type="checkbox"
                checked={checked.has(index)}
                onChange={(e) => {
                  const next = new Set(checked);
                  if (e.target.checked) next.add(index);
                  else next.delete(index);
                  setChecked(next);
                }}
              />
              검토에 포함 · {row.address}
            </label>
            <p>
              {row.module || "루트 모듈"} · {row.declaration} ·{" "}
              {row.index
                ? (row.index.startsWith('["') ? "for_each " : "count ") +
                  row.index
                : "단일 인스턴스"}
            </p>
            {row.action === "교체" && <p>교체 근거 · {reason(row)}</p>}
            {id ? (
              <button onClick={() => onNode(id)}>도면에서 보기</button>
            ) : (
              <p>대응하는 도면 리소스 없음</p>
            )}
            {row.fields.map((field) => (
              <div key={field.key}>
                <strong>{field.key}</strong>
                {field.replacementPaths.length > 0 && (
                  <mark>교체 유발 · {field.replacementPaths.join(", ")}</mark>
                )}
                <pre>
                  {field.before} → {field.after}
                </pre>
              </div>
            ))}
          </details>
        );
      })}
      {rows.length > 0 && !readonly && (
        <fieldset disabled={saving}>
          <label>
            확인할 사항
            <textarea
              value={checklist}
              onChange={(e) => setChecklist(e.target.value)}
            />
          </label>
          <button disabled={!checked.size} onClick={save}>
            검토 노트 저장 ({checked.size})
          </button>
        </fieldset>
      )}
    </details>
  );
}
