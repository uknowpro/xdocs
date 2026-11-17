import { useRef, useState } from "react";
import { drawingSVG, services } from "../shared/aws-drawing.mjs";
type Account = {
  id: string;
  label: string;
  region: string;
  x: number;
  y: number;
};
type Item = {
  id: string;
  account: string;
  kind: keyof typeof services;
  label: string;
  x: number;
  y: number;
};
type Arrow = { id: string; from: string; to: string; label: string };
export type Drawing = {
  organization: string;
  accounts: Account[];
  items: Item[];
  arrows: Arrow[];
};
export function AwsDrawing({
  data,
  onChange,
  readonly,
}: {
  data: Drawing;
  onChange: (v: Drawing) => void;
  readonly: boolean;
}) {
  const [selected, setSelected] = useState(""),
    [kind, setKind] = useState<keyof typeof services>("vault"),
    [target, setTarget] = useState("");
  const drag = useRef<{ x: number; y: number; id: string } | null>(null);
  const account = data.accounts.find((a) => a.id === selected),
    item = data.items.find((a) => a.id === selected),
    arrow = data.arrows.find((a) => a.id === selected);
  const parent =
    account ||
    data.accounts.find((a) => a.id === item?.account) ||
    data.accounts[0];
  const field = <K extends "accounts" | "items" | "arrows">(
    key: K,
    props: Record<string, string | number>,
    id = selected,
  ) =>
    onChange({
      ...data,
      [key]: data[key].map((n) => (n.id === id ? { ...n, ...props } : n)),
    });
  const all = [...data.accounts, ...data.items, ...data.arrows];
  function point(e: React.PointerEvent<HTMLDivElement>) {
    const svg = e.currentTarget.querySelector("svg")!,
      p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM()!.inverse());
  }
  function download() {
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([drawingSVG(data)], { type: "image/svg+xml" }),
      );
    a.href = url;
    a.download = "aws-architecture.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function remove() {
    const items = data.items.filter(
        (i) => i.id !== selected && i.account !== selected,
      ),
      ids = new Set(items.map((i) => i.id));
    onChange({
      ...data,
      accounts: data.accounts.filter((a) => a.id !== selected),
      items,
      arrows: data.arrows.filter(
        (e) => e.id !== selected && ids.has(e.from) && ids.has(e.to),
      ),
    });
    setSelected("");
  }
  return (
    <section className="aws-editor">
      <div
        className="aws-paper"
        aria-label="AWS 구성도"
        onPointerDown={(e) => {
          const id = (e.target as Element)
            .closest("[data-id]")
            ?.getAttribute("data-id");
          if (!id) return;
          setSelected(id);
          setTarget("");
          const p = point(e);
          drag.current = { id, x: p.x, y: p.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onPointerUp={(e) => {
          const start = drag.current;
          drag.current = null;
          if (!start || readonly) return;
          const p = point(e),
            dx = p.x - start.x,
            dy = p.y - start.y;
          if (Math.abs(dx) + Math.abs(dy) < 4) return;
          const a = data.accounts.find((v) => v.id === start.id),
            i = data.items.find((v) => v.id === start.id);
          if (a || i) {
            const n = (a || i)!;
            field(
              a ? "accounts" : "items",
              {
                x: Math.round(
                  Math.max(a ? 8 : 24, Math.min(a ? 12000 : 392, n.x + dx)),
                ),
                y: Math.round(
                  Math.max(a ? 46 : 78, Math.min(a ? 12000 : 195, n.y + dy)),
                ),
              },
              n.id,
            );
          }
        }}
        dangerouslySetInnerHTML={{ __html: drawingSVG(data, selected) }}
      />
      <aside className="aws-inspector">
        <strong>AWS 드로잉</strong>
        <label>
          조직 이름
          <input
            readOnly={readonly}
            maxLength={200}
            value={data.organization}
            onChange={(e) =>
              onChange({ ...data, organization: e.target.value })
            }
          />
        </label>
        <button
          className="button"
          disabled={readonly}
          onClick={() => {
            const id = crypto.randomUUID(),
              n = data.accounts.length;
            onChange({
              ...data,
              accounts: [
                ...data.accounts,
                {
                  id,
                  label: "AWS account",
                  region: "AWS Region",
                  x: 22 + (n % 2) * 484,
                  y: 70 + Math.floor(n / 2) * 276,
                },
              ],
            });
            setSelected(id);
          }}
        >
          계정·리전 추가
        </button>
        <label>
          선택한 항목
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setTarget("");
            }}
          >
            <option value="">항목 선택</option>
            {all.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label || "연결선"}
              </option>
            ))}
          </select>
        </label>
        {(account || item || arrow) && (
          <label>
            표시 이름
            <input
              maxLength={200}
              readOnly={readonly}
              value={(account || item || arrow)!.label}
              onChange={(e) =>
                field(account ? "accounts" : item ? "items" : "arrows", {
                  label: e.target.value,
                })
              }
            />
          </label>
        )}
        {account && (
          <label>
            리전
            <input
              maxLength={200}
              readOnly={readonly}
              value={account.region}
              onChange={(e) => field("accounts", { region: e.target.value })}
            />
          </label>
        )}
        {item && (
          <label>
            소속 계정
            <select
              disabled={readonly}
              value={item.account}
              onChange={(e) => field("items", { account: e.target.value })}
            >
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} · {a.region}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          서비스
          <select
            disabled={readonly}
            value={kind}
            onChange={(e) => setKind(e.target.value as keyof typeof services)}
          >
            {Object.entries(services).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button"
          disabled={!parent || readonly}
          onClick={() => {
            const id = crypto.randomUUID();
            onChange({
              ...data,
              items: [
                ...data.items,
                {
                  id,
                  account: parent.id,
                  kind,
                  label: services[kind].label,
                  x: 165,
                  y: 120,
                },
              ],
            });
            setSelected(id);
          }}
        >
          서비스 추가
        </button>
        {item && (
          <>
            <label>
              연결 대상
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">서비스 선택</option>
                {data.items
                  .filter((i) => i.id !== item.id)
                  .map((i) => (
                    <option value={i.id} key={i.id}>
                      {data.accounts.find((a) => a.id === i.account)?.label} ·{" "}
                      {i.label}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="button"
              disabled={!target || readonly}
              onClick={() => {
                const id = crypto.randomUUID();
                onChange({
                  ...data,
                  arrows: [
                    ...data.arrows,
                    { id, from: item.id, to: target, label: "" },
                  ],
                });
                setSelected(id);
                setTarget("");
              }}
            >
              방향선 추가
            </button>
          </>
        )}
        {selected && (
          <button className="text-button" disabled={readonly} onClick={remove}>
            선택 삭제
          </button>
        )}
        <button className="button" onClick={download}>
          드로잉 SVG 저장
        </button>
        <small>
          계정과 서비스를 끌어 배치합니다. 방향선은 설계 설명이며 배포 코드에
          추가되지 않습니다.
        </small>
      </aside>
    </section>
  );
}
