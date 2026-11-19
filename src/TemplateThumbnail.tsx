import {caseDiagram} from "../shared/case-diagrams.mjs";
import { useEffect, useRef, useState } from "react";
import { architectureSVG } from "../shared/architecture.mjs";
import { boundaryLayout, boundarySVG } from "../shared/network-boundaries.mjs";
import { openCloudTemplate } from "./cloudCatalog";

export function templateDiagram(model: Awaited<ReturnType<typeof openCloudTemplate>>) {
  const nested = boundaryLayout(model).parents.size > 0;
  const svg = caseDiagram(model) || (nested || !model.nodes.some(n => n.imported) ? boundarySVG(model) : architectureSVG(model));
  return {image: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), nested};
}

export default function TemplateThumbnail({ id }: { id: string }) {
  const frame = useRef<HTMLSpanElement>(null);
  const [preview, setPreview] = useState<{ image: string; nested: boolean }>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      openCloudTemplate(id).then(model => {
        if (!active) return;
        setPreview(templateDiagram(model));
      }).catch(() => { if (active) setFailed(true); });
    }, { root: frame.current?.closest(".template-gallery") });
    observer.observe(frame.current!);
    return () => { active = false; observer.disconnect(); };
  }, [id]);
  return <span className="template-thumbnail" ref={frame}>
    {preview ? <img src={preview.image} alt={preview.nested ? "영역형 구성도" : "리소스 구성도"} /> : failed ? "미리보기를 열 수 없습니다" : null}
    {preview?.nested && <span className="template-layout-label">영역형</span>}
  </span>;
}
