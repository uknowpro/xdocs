import { useRef, useState } from "react";

type Entry = { name: string; type?: string; required?: boolean };
type Contract = { inputs: Entry[]; outputs: Entry[] };

function readContract(text: string): Contract {
  const doc = JSON.parse(text);
  for (const section of ["inputs", "outputs"]) {
    const rows = doc?.[section];
    if (
      !Array.isArray(rows) ||
      rows.some(
        (r) =>
          typeof r?.name !== "string" ||
          !r.name ||
          (section === "inputs" &&
            (typeof r.required !== "boolean" || typeof r.type !== "string")),
      ) ||
      new Set(rows.map((r) => r.name)).size !== rows.length
    )
      throw Error(
        "inputs·outputs가 포함된 terraform-docs JSON 파일을 선택하세요.",
      );
  }
  return doc;
}

function contractChanges(before: Contract, after: Contract) {
  const changes: string[] = [];
  for (const section of ["inputs", "outputs"] as const) {
    const kind = section === "inputs" ? "입력" : "출력";
    const old = new Map(before[section].map((entry) => [entry.name, entry]));
    for (const entry of after[section]) {
      const previous = old.get(entry.name);
      old.delete(entry.name);
      if (!previous)
        changes.push(
          kind + " 추가 · " + entry.name + (entry.required ? " (필수)" : ""),
        );
      else if (section === "inputs") {
        if (entry.type !== previous.type)
          changes.push(
            "입력 유형 변경 · " +
              entry.name +
              " · " +
              previous.type +
              " → " +
              entry.type,
          );
        if (entry.required !== previous.required)
          changes.push(
            "입력 " +
              (entry.required ? "필수화" : "선택화") +
              " · " +
              entry.name,
          );
      }
    }
    for (const name of old.keys()) changes.push(kind + " 삭제 · " + name);
  }
  return changes;
}

function ContractFile({
  label,
  onChange,
}: {
  label: string;
  onChange: (c: Contract | null) => void;
}) {
  const revision = useRef(0);
  const [error, setError] = useState("");
  return (
    <label>
      {label}
      <input
        type="file"
        accept=".json"
        onChange={async (e) => {
          const id = ++revision.current;
          const file = e.target.files?.[0];
          onChange(null);
          setError("");
          if (!file) return;
          try {
            if (file.size > 5_000_000)
              throw Error("5MB 이하의 JSON 파일을 선택하세요.");
            const contract = readContract(await file.text());
            if (id === revision.current) onChange(contract);
          } catch (err) {
            if (id === revision.current) setError(String(err));
          }
        }}
      />
      {error && <span role="alert">{error}</span>}
    </label>
  );
}

export default function ModuleContractReview() {
  const [before, setBefore] = useState<Contract | null>(null);
  const [after, setAfter] = useState<Contract | null>(null);
  const changes = before && after ? contractChanges(before, after) : null;
  return (
    <details className="module-contract">
      <summary>AVM · Terraform 모듈 버전 비교</summary>
      <p>
        같은 모듈의 두 버전에서 각각 <code>terraform-docs json .</code>으로
        생성한 파일을 선택하세요.
      </p>
      <ContractFile label="현재 버전 JSON" onChange={setBefore} />
      <ContractFile label="후보 버전 JSON" onChange={setAfter} />
      {changes && (
        <>
          <p role="status">입출력 선언 변경 {changes.length}건</p>
          <ul>
            {changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
