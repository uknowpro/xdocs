import { useLayoutEffect, type RefObject } from "react";

// Reserve room for controls before the pane and the footer immediately below it.
export function usePaneHeight(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const pane = ref.current;
    const main = pane?.closest("main");
    if (!pane || !main) return;
    const footer = pane.nextElementSibling;
    function measure() {
      if (!main || !pane) return;
      const top = pane.getBoundingClientRect().top + main.scrollTop;
      const reserve = footer
        ? footer.getBoundingClientRect().height +
          parseFloat(getComputedStyle(footer).marginTop || "0")
        : 0;
      const height = Math.floor(
        main.getBoundingClientRect().bottom - top - reserve - 12,
      );
      pane.style.setProperty(
        "--remaining-height",
        Math.max(180, height) + "px",
      );
    }
    const observer = new ResizeObserver(measure);
    function observe() {
      observer.disconnect();
      observer.observe(main!);
      if (footer) observer.observe(footer);
      for (
        let el: Element | null = pane!;
        el && el !== main;
        el = el.parentElement
      )
        for (
          let prev = el.previousElementSibling;
          prev;
          prev = prev.previousElementSibling
        )
          observer.observe(prev);
      measure();
    }
    observe();
    const structure = new MutationObserver(observe);
    for (
      let el: Element | null = pane.parentElement;
      el && el !== main.parentElement;
      el = el.parentElement
    )
      structure.observe(el, { childList: true });
    return () => {
      observer.disconnect();
      structure.disconnect();
    };
  }, [ref]);
}
