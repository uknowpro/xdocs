import { useState } from "react";
import {
  fieldProblems,
  nestedFields,
  resourceSchema,
} from "../shared/resource-form.mjs";

type Fields = Record<string, [any, boolean, boolean]>;
type Props = {
  fields: Fields;
  values: Record<string, any>;
  disabled: boolean;
  change: (next: Record<string, any>) => void;
};
function FieldsEditor({ fields, values, disabled, change }: Props) {
  const [extra, setExtra] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const names = Object.keys(fields).sort(
    (a, b) => Number(fields[b][1]) - Number(fields[a][1]) || a.localeCompare(b),
  );
  const set = (name: string, v: any) => {
    const next = { ...values };
    if (v === undefined) delete next[name];
    else next[name] = v;
    change(next);
  };
  const visible = names.filter(
    (k) => fields[k][1] || Object.hasOwn(values, k) || k === extra,
  );
  return (
    <fieldset disabled={disabled} className="tf-schema-form">
      {visible.map((k) => {
        const [type, required, secret] = fields[k],
          value = values[k];
        const expression = typeof value === "string" && value.startsWith("${");
        const label = k + (required ? " *" : "");
        if (
          Array.isArray(type) &&
          typeof type[1] === "number" &&
          !expression &&
          ["list", "set", "single", "group"].includes(type[0])
        ) {
          const many = ["list", "set"].includes(type[0]);
          const rows = many ? value : value ? [value] : [];
          if (
            rows == null ||
            (Array.isArray(rows) &&
              rows.every(
                (r) => r && typeof r === "object" && !Array.isArray(r),
              ))
          )
            return (
              <details key={k} open>
                <summary>{label}</summary>
                {(rows || []).map((row: any, i: number) => (
                  <div key={i}>
                    <FieldsEditor
                      fields={nestedFields(type[1])}
                      values={row}
                      disabled={disabled}
                      change={(next) =>
                        set(
                          k,
                          many
                            ? rows.map((r: any, j: number) =>
                                j === i ? next : r,
                              )
                            : next,
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          k,
                          many
                            ? rows.filter((_: any, j: number) => i !== j)
                            : undefined,
                        )
                      }
                    >
                      항목 제거
                    </button>
                  </div>
                ))}
                {(many || !rows?.length) && (
                  <button
                    type="button"
                    onClick={() => set(k, many ? [...(rows || []), {}] : {})}
                  >
                    {k} 추가
                  </button>
                )}
              </details>
            );
        }
        return (
          <label key={k}>
            {label}
            {type === "bool" && !expression ? (
              <select
                value={String(value ?? "")}
                onChange={(e) =>
                  set(
                    k,
                    e.target.value === ""
                      ? undefined
                      : e.target.value === "true",
                  )
                }
              >
                <option value="">선택</option>
                <option>true</option>
                <option>false</option>
              </select>
            ) : Array.isArray(type) || type === "dynamic" ? (
              <textarea
                aria-label={k}
                value={
                  drafts[k] ??
                  (value === undefined ? "" : JSON.stringify(value, null, 2))
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  setDrafts((d) => ({ ...d, [k]: raw }));
                  try {
                    const parsed = raw.trim() ? JSON.parse(raw) : undefined;
                    set(k, parsed);
                    setDrafts((d) => {
                      const next = { ...d };
                      delete next[k];
                      return next;
                    });
                  } catch {
                    /* Keep the incomplete JSON in the field. */
                  }
                }}
              />
            ) : (
              <input
                aria-label={k}
                type={
                  secret
                    ? "password"
                    : type === "number" && !expression
                      ? "number"
                      : "text"
                }
                value={value ?? ""}
                onChange={(e) =>
                  set(
                    k,
                    e.target.value === ""
                      ? undefined
                      : type === "number" && !expression
                        ? Number(e.target.value)
                        : e.target.value,
                  )
                }
              />
            )}
            {drafts[k] !== undefined && (
              <small role="alert">
                JSON 문법을 확인하세요. 이 값은 아직 적용되지 않았습니다.
              </small>
            )}
          </label>
        );
      })}
      {names.some((k) => !visible.includes(k)) && (
        <select
          aria-label="선택 속성 추가"
          value=""
          onChange={(e) => setExtra(e.target.value)}
        >
          <option value="">선택 속성 추가</option>
          {names
            .filter((k) => !visible.includes(k))
            .map((k) => (
              <option key={k}>{k}</option>
            ))}
        </select>
      )}
    </fieldset>
  );
}
export default function ResourceFields({
  kind,
  raw,
  disabled,
  change,
}: {
  kind: string;
  raw: string;
  disabled: boolean;
  change: (s: string) => void;
}) {
  const schema = resourceSchema(kind);
  let args;
  try {
    args = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!schema || !args || Array.isArray(args) || typeof args !== "object")
    return null;
  const problems = fieldProblems(schema.fields, args);
  return (
    <details className="resource-fields" open>
      <summary>
        Terraform 속성 폼{problems.length ? " · 확인 " + problems.length : ""}
      </summary>
      <FieldsEditor
        fields={schema.fields}
        values={args}
        disabled={disabled}
        change={(v) => change(JSON.stringify(v, null, 2))}
      />
      {problems.map((p: string) => (
        <small className="arch-issue" key={p}>
          {p}
        </small>
      ))}
    </details>
  );
}
