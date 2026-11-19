import { useLayoutEffect, useRef, useState, type RefObject } from "react";

export function useReadingPosition(
  pane: RefObject<HTMLElement | null>,
  key: string,
  body: string,
) {
  const [titles, setTitles] = useState<string[]>([]);
  const [current, setCurrent] = useState(-1);
  const elements = useRef<HTMLElement[]>([]);
  useLayoutEffect(() => {
    const main = pane.current;
    if (!main || !key) {
      elements.current = [];
      setTitles([]);
      setCurrent(-1);
      return;
    }
    const list = Array.from(
      main.querySelectorAll<HTMLElement>("article .markdown :is(h2,h3)"),
    );
    elements.current = list;
    setTitles(list.map((el) => el.textContent || ""));
    const active = () => {
      const top = main.getBoundingClientRect().top + 36;
      let index = -1;
      for (
        let i = 0;
        i < list.length && list[i].getBoundingClientRect().top <= top;
        i++
      )
        index = i;
      setCurrent(index);
    };
    active();
    main.addEventListener("scroll", active, { passive: true });
    return () => main.removeEventListener("scroll", active);
  }, [key, body, pane]);

  useLayoutEffect(() => {
    const main = pane.current;
    if (!main || !key) return;
    const storage = "xdocs.reading." + key;
    let position = 0;
    try {
      position = Number(localStorage.getItem(storage)) || 0;
    } catch {
      /* private storage */
    }
    main.scrollTop = position;
    let timer: ReturnType<typeof setTimeout>;
    const save = () => {
      try {
        localStorage.setItem(storage, String(position));
      } catch {
        /* storage unavailable */
      }
    };
    const scroll = () => {
      position = main.scrollTop;
      clearTimeout(timer);
      timer = setTimeout(save, 180);
    };
    main.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      main.removeEventListener("scroll", scroll);
      window.removeEventListener("pagehide", save);
      clearTimeout(timer);
      save();
    };
  }, [key, pane]);
  return {
    titles,
    current,
    jump: (i: number) =>
      elements.current[i]?.scrollIntoView({ block: "start" }),
  };
}
