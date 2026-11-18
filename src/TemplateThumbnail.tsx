import { useEffect, useRef, useState } from "react";
import { architectureSVG } from "../shared/architecture.mjs";
import { boundarySVG } from "../shared/network-boundaries.mjs";
import { openCloudTemplate } from "./cloudCatalog";

export default function TemplateThumbnail({ id }: { id: string }) {
  const frame = useRef<HTMLSpanElement>(null);
  const [image, setImage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      openCloudTemplate(id).then(model => {
        if (active) setImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(model.nodes.some(n => n.imported) ? architectureSVG(model) : boundarySVG(model)));
      }).catch(() => { if (active) setFailed(true); });
    }, { root: frame.current?.closest(".template-gallery") });
    observer.observe(frame.current!);
    return () => { active = false; observer.disconnect(); };
  }, [id]);
  return <span className="template-thumbnail" ref={frame}>
    {image ? <img src={image} alt="" /> : failed ? "미리보기를 열 수 없습니다" : null}
  </span>;
}
