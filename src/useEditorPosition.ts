import { useLayoutEffect, useRef } from "react";

export function useEditorPosition(key: string) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const positions = useRef(
    new Map<
      string,
      { start: number; end: number; top: number; left: number }
    >(),
  );
  useLayoutEffect(() => {
    const el = editor.current;
    if (!el) return;
    const saved = positions.current.get(key);
    if (saved) {
      el.setSelectionRange(saved.start, saved.end);
      el.scrollTo(saved.left, saved.top);
    } else {
      el.setSelectionRange(0, 0);
      el.scrollTo(0, 0);
    }
    function remember() {
      positions.current.set(key, {
        start: el!.selectionStart,
        end: el!.selectionEnd,
        top: el!.scrollTop,
        left: el!.scrollLeft,
      });
    }
    const events = ["select", "scroll", "keyup", "pointerup", "blur", "input"];
    events.forEach((event) => el.addEventListener(event, remember));
    return () =>
      events.forEach((event) => el.removeEventListener(event, remember));
  }, [key]);
  return editor;
}
