import { useEffect, useRef, useState } from "react";
import { reviewPlan, planNode } from "../shared/plan-review.mjs";
import type { ArchitectureModel } from "./ArchitectureDocument";

export type PlanRows = {
  address: string;
  action: string;
  fields: { key: string; before: string; after: string }[];
}[];
export default function PlanReview({
  model,
  selected,
  rows,
  setRows,
  onNode,
}: {
  selected: string;
  model: ArchitectureModel;
  rows: PlanRows;
  setRows: (r: PlanRows) => void;
  onNode: (id: string) => void;
}) {
  const [status, setStatus] = useState("");
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
            setRows([]);
            setStatus("");
          }}
        >
          계획 닫기
        </button>
      )}
      {rows.map((row, index) => {
        const id = planNode(row.address, model.nodes);
        return (
          <details key={index} data-plan-node={id || ""}>
            <summary>
              {row.action} · {row.address}
            </summary>
            {id ? (
              <button onClick={() => onNode(id)}>도면에서 보기</button>
            ) : (
              <p>대응하는 도면 리소스 없음</p>
            )}
            {row.fields.map((field) => (
              <div key={field.key}>
                <strong>{field.key}</strong>
                <pre>
                  {field.before} → {field.after}
                </pre>
              </div>
            ))}
          </details>
        );
      })}
    </details>
  );
}
