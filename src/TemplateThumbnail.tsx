import reviewedPaths from "../catalog/reviewed-paths.json";
import { caseDiagram } from "../shared/case-diagrams.mjs";
import { useEffect, useRef, useState } from "react";
import { architectureEdges, architectureSVG } from "../shared/architecture.mjs";
import { boundaryLayout, boundarySVG } from "../shared/network-boundaries.mjs";
import { openCloudTemplate } from "./cloudCatalog";

export function templateDiagram(
  model: Awaited<ReturnType<typeof openCloudTemplate>>,
  id: string,
  compact = false,
) {
  const nested = boundaryLayout(model).parents.size > 0;
  const keys = new Map(model.nodes.map((n) => [n.address || n.label, n.id]));
  const paths = (reviewedPaths as Record<string, string[][]>)[id] || [];
  const edges = architectureEdges(model);
  const references = compact
    ? edges.filter((e) =>
        paths.some(
          ([source, target]) =>
            keys.get(source) === e.source && keys.get(target) === e.target,
        ),
      )
    : edges;
  const svg =
    caseDiagram(model) ||
    (nested || !model.nodes.some((n) => n.imported)
      ? boundarySVG(model, "", references)
      : architectureSVG(model, references));
  const reference = paths[0]?.join(" → ");
  const size = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return {
    width: Number(size?.[1]) || 800,
    height: Number(size?.[2]) || 600,
    reference,
    image: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
    nested,
  };
}

export default function TemplateThumbnail({ id }: { id: string }) {
  const frame = useRef<HTMLSpanElement>(null);
  const [preview, setPreview] = useState<ReturnType<typeof templateDiagram>>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        openCloudTemplate(id)
          .then((model) => {
            if (!active) return;
            setPreview(templateDiagram(model, id, true));
          })
          .catch(() => {
            if (active) setFailed(true);
          });
      },
      { root: frame.current?.closest(".template-gallery") },
    );
    observer.observe(frame.current!);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [id]);
  return (
    <>
      <span className="template-thumbnail" ref={frame}>
        {preview ? (
          <img
            src={preview.image}
            alt={preview.nested ? "영역형 구성도" : "리소스 구성도"}
          />
        ) : failed ? (
          "미리보기를 열 수 없습니다"
        ) : null}
        {preview?.nested && (
          <span className="template-layout-label">영역형</span>
        )}
      </span>
      {preview?.reference && (
        <span className="thumbnail-reference">참조 · {preview.reference}</span>
      )}
    </>
  );
}
