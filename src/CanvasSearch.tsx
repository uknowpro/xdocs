import { useEffect, useId, useRef, useState } from "react";

type Entry = { id: string; label: string; detail: string };
export default function CanvasSearch({
  label,
  entries,
  onChoose,
  disabled = false,
  shortcutKey = "/",
}: {
  label: string;
  entries: Entry[];
  onChoose: (id: string) => void;
  disabled?: boolean;
  shortcutKey?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const list = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const words = query.toLowerCase().trim().split(/\s+/);
  const matches = entries.filter((e) =>
    words.every((w) =>
      (e.label + " " + e.detail + " " + e.id).toLowerCase().includes(w),
    ),
  );
  const active = Math.min(index, matches.length - 1);
  useEffect(() => {
    const scope = input.current?.closest<HTMLElement>("[data-search-scope]");
    function shortcut(e: KeyboardEvent) {
      if (
        e.key !== shortcutKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.isComposing ||
        (e.target as Element).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (input.current?.disabled) return;
      e.preventDefault();
      input.current?.focus();
    }
    scope?.addEventListener("keydown", shortcut);
    return () => scope?.removeEventListener("keydown", shortcut);
  }, [shortcutKey]);
  useEffect(() => {
    if (open)
      document
        .getElementById(list + "-" + active)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, list]);
  function choose(id: string) {
    setOpen(false);
    setQuery("");
    setIndex(0);
    onChoose(id);
  }
  return (
    <div
      className="canvas-search"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <input
        ref={input}
        role="combobox"
        aria-label={label}
        placeholder={label + " (" + shortcutKey + ")"}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={list}
        aria-autocomplete="list"
        aria-activedescendant={
          open && active >= 0 ? list + "-" + active : undefined
        }
        value={query}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Escape") {
            setOpen(false);
            e.stopPropagation();
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setIndex(
              Math.max(
                0,
                Math.min(
                  matches.length - 1,
                  active + (e.key === "ArrowDown" ? 1 : -1),
                ),
              ),
            );
          }
          if (open && e.key === "Enter" && active >= 0) {
            e.preventDefault();
            choose(matches[active].id);
          }
        }}
      />
      {open && (
        <div
          className="canvas-search-results"
          role="listbox"
          aria-label={label + " 결과"}
          id={list}
        >
          {matches.map((e, i) => (
            <button
              key={e.id}
              id={list + "-" + i}
              type="button"
              role="option"
              aria-selected={i === active}
              tabIndex={-1}
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => choose(e.id)}
            >
              <strong>{e.label}</strong>
              <small>{e.detail}</small>
            </button>
          ))}
          {!matches.length && <span>검색 결과가 없습니다.</span>}
        </div>
      )}
    </div>
  );
}
