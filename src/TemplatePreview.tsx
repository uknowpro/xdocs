import { useEffect, useMemo, useState } from "react";
import { containerKinds } from "../shared/network-boundaries.mjs";
import { templateDiagram } from "./TemplateThumbnail";
import { openCloudTemplate, type cloudTemplates } from "./cloudCatalog";
import type { ArchitectureModel } from "./ArchitectureDocument";

function scopeFacts(model: ArchitectureModel) {
  const regions = new Set<string>(),
    accounts = new Set<string>();
  function inspect(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "string" && item.trim()) {
        if (["region", "location", "zone", "availability_zone"].includes(key))
          regions.add(item);
        if (
          ["account_id", "subscription_id", "project", "project_id"].includes(
            key,
          )
        )
          accounts.add(item);
      } else inspect(item);
    }
  }
  for (const source of model.sources) {
    if (!source.name.endsWith(".tf.json")) continue;
    try {
      const doc = JSON.parse(source.content);
      inspect(doc.resource);
      inspect(doc.provider);
      inspect(doc.module);
    } catch {
      /* Other source files can still supply scope information. */
    }
  }
  for (const node of model.nodes) inspect(node.props);
  if (!model.sources.length) {
    if (model.nodes.some((n) => n.kind.startsWith("aws_")))
      regions.add(model.settings.aws_region);
    if (model.nodes.some((n) => n.kind.startsWith("google_")))
      regions.add(model.settings.gcp_region);
    accounts.add(model.settings.azure_subscription);
    accounts.add(model.settings.gcp_project);
  }
  return {
    regions: [...regions].filter(Boolean),
    accounts: [...accounts].filter(Boolean),
  };
}

export default function TemplatePreview({
  template,
}: {
  template: (typeof cloudTemplates)[number];
}) {
  const [model, setModel] = useState<ArchitectureModel>();
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    openCloudTemplate(template.id)
      .then((value) => {
        if (active) setModel(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [template.id]);
  const boundaries = model?.nodes.filter((n) => containerKinds.has(n.kind));
  const scope = useMemo(() => model && scopeFacts(model), [model]);
  const diagram = useMemo(() => model && templateDiagram(model), [model]);
  return (
    <div className="catalog-large-preview">
      <label>
        배율 {zoom}×{" "}
        <input
          type="range"
          min="1"
          max="4"
          step=".5"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </label>
      <div className="catalog-preview-scroll">
        <div style={{ width: zoom * 100 + "%", height: zoom * 100 + "%" }}>
          {diagram && (
            <img
              className="enlarged-diagram"
              src={diagram.image}
              alt={template.name + " 구성도"}
            />
          )}
        </div>
      </div>
      {error && <p>설계 정보를 열 수 없습니다.</p>}
      {model && (
        <>
          <p>
            <strong>{template.provider}</strong> · {model.nodes.length}개 리소스
          </p>
          <p>
            계정 · 구독 · 프로젝트:{" "}
            {scope?.accounts.join(", ") || "원본에서 확인"}
          </p>
          <p>리전 · 영역: {scope?.regions.join(", ") || "원본에서 확인"}</p>
          <p>
            네트워크·배치 경계:{" "}
            {boundaries?.map((n) => n.label).join(", ") || "명시된 경계 없음"}
          </p>
          <p>{template.review?.operations || template.study}</p>
        </>
      )}
    </div>
  );
}
