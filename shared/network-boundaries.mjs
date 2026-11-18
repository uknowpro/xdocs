// Only membership fields produce nesting. General dependencies stay in the reference graph.
export const placementFields = {
  aws_subnet: ["vpc", "aws_vpc", "vpc_id"],
  aws_instance: ["subnet", "aws_subnet", "subnet_id"],
  azurerm_virtual_network: [
    "group",
    "azurerm_resource_group",
    "resource_group_name",
  ],
  azurerm_subnet: [
    "network",
    "azurerm_virtual_network",
    "virtual_network_name",
  ],
  azurerm_linux_virtual_machine: ["subnet", "azurerm_subnet"],
  azurerm_storage_account: [
    "group",
    "azurerm_resource_group",
    "resource_group_name",
  ],
  avm_virtual_network: ["group", "avm_resource_group"],
  google_compute_subnetwork: ["network", "google_compute_network", "network"],
  google_compute_instance: ["subnet", "google_compute_subnetwork"],
  k8s_deployment: ["namespace", "k8s_namespace"],
  k8s_configmap: ["namespace", "k8s_namespace"],
  k8s_pvc: ["namespace", "k8s_namespace"],
};
export function canPlace(model, child, parent) {
  const rule = placementFields[child?.kind];
  return !!(
    rule &&
    parent &&
    rule[1] === parent.kind &&
    child.id !== parent.id &&
    !model.presentation?.locked?.includes(child.id) &&
    (child.imported
      ? child.placementSource &&
        parent.imported &&
        parent.address &&
        !parent.multipleInstances
      : !parent.imported)
  );
}
export const containerKinds = new Set([
  "aws_vpc",
  "aws_subnet",
  "azurerm_resource_group",
  "azurerm_virtual_network",
  "azurerm_subnet",
  "google_compute_network",
  "google_compute_subnetwork",
  "avm_virtual_network",
  "avm_resource_group",
  "k8s_namespace",
]);
const providers = {
  aws: "AWS",
  azurerm: "Azure",
  avm: "Azure",
  google: "GCP",
  k8s: "Kubernetes",
};
const colors = {
  AWS: "#a66016",
  Azure: "#236d99",
  GCP: "#386ca2",
  Kubernetes: "#6359a0",
  Terraform: "#696879",
};
const escape = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function boundaryLayout(model) {
  const byId = new Map(model.nodes.map((n) => [n.id, n])),
    byAddress = new Map(
      model.nodes.filter((n) => n.address).map((n) => [n.address, n]),
    );
  const groups = new Map(),
    children = new Map(),
    parents = new Map();
  function direct(n) {
    const rule = placementFields[n.kind];
    if (!rule) return;
    const p = n.imported
      ? byAddress.get(n.scopeAddress)
      : byId.get(n.props[rule[0]]);
    if (p?.kind === rule[1]) return p;
  }
  for (const n of model.nodes) {
    let p = direct(n);
    if (!n.imported) {
      const dep =
        n.kind === "k8s_service"
          ? byId.get(n.props.deployment)
          : n.kind === "k8s_ingress"
            ? byId.get(byId.get(n.props.service)?.props.deployment)
            : null;
      if (dep?.kind === "k8s_deployment") p = direct(dep);
      if (n.kind === "avm_storage_account") {
        const network = byId.get(n.props.network);
        if (network?.kind === "avm_virtual_network") p = direct(network);
      }
    }
    if (p) {
      parents.set(n.id, p.id);
      if (!children.has(p.id)) children.set(p.id, []);
      children.get(p.id).push(n);
    } else {
      const provider = providers[n.kind.split("_")[0]] || "Terraform";
      if (!groups.has(provider)) groups.set(provider, []);
      groups.get(provider).push(n);
    }
  }
  const gap = 9,
    header = 44,
    pad = 10;
  const folded = new Set(model.presentation?.folded || []);
  const representatives = new Map();
  function hide(n, container) {
    representatives.set(n.id, container);
    let count = 1;
    for (const c of children.get(n.id) || []) count += hide(c, container);
    return count;
  }
  function measure(n) {
    if (folded.has(n.id)) return header + 12;
    const kids = children.get(n.id) || [];
    return (
      header +
      (kids.length
        ? pad + kids.reduce((sum, c) => sum + measure(c) + gap, 0)
        : containerKinds.has(n.kind)
          ? 12
          : 0)
    );
  }
  const frames = [],
    boxes = [];
  function place(n, x, y, w, provider, depth) {
    const height = measure(n);
    representatives.set(n.id, n.id);
    const hidden = folded.has(n.id)
      ? (children.get(n.id) || []).reduce((sum, c) => sum + hide(c, n.id), 0)
      : 0;
    boxes.push({
      hidden,
      id: n.id,
      label: n.label,
      kind: n.kind,
      x,
      y,
      w,
      h: height,
      provider,
      depth,
      container: containerKinds.has(n.kind),
      cidr: n.props.cidr || "",
      parent: parents.get(n.id),
    });
    if (folded.has(n.id)) return;
    let top = y + header;
    for (const child of children.get(n.id) || []) {
      place(child, x + pad, top, w - 2 * pad, provider, depth + 1);
      top += measure(child) + gap;
    }
  }
  let index = 0,
    top = 10,
    rowHeight = 0;
  for (const [provider, roots] of groups) {
    if (index > 0 && index % 2 === 0) {
      top += rowHeight + 14;
      rowHeight = 0;
    }
    const x = 10 + (index % 2) * 304,
      w = 290,
      h = header + pad + roots.reduce((sum, n) => sum + measure(n) + gap, 0);
    frames.push({ provider, x, y: top, w, h });
    let y = top + header;
    for (const n of roots) {
      place(n, x + pad, y, w - 2 * pad, provider, 0);
      y += measure(n) + gap;
    }
    rowHeight = Math.max(rowHeight, h);
    index++;
  }
  return {
    frames,
    representatives,
    parents,
    boxes,
    width: groups.size > 1 ? 614 : 310,
    height: top + rowHeight + 10,
  };
}
/** @param {any} model @param {string} selected @param {Array<{source:string,target:string,field:string}>} references */
function anchor(box, side) {
  switch (side) {
    case "left":
      return [box.x + 5, box.y + 20];
    case "top":
      return [box.x + box.w / 2, box.y + 2];
    case "bottom":
      return [box.x + box.w / 2, box.y + box.h - 2];
    default:
      return [box.x + box.w - 5, box.y + 20];
  }
}
// Draw a small bridge where this polyline crosses a previously drawn edge.
function connectorPath(points, previous, crossings) {
  let path = "M" + points[0].join(" ");
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    const axis = a[1] === b[1] ? 0 : 1,
      fixed = 1 - axis;
    const dir = Math.sign(b[axis] - a[axis]);
    const hits = [];
    if (crossings)
      for (const [c, d] of previous) {
        const at = c[axis];
        if (
          at === d[axis] &&
          dir * (at - a[axis]) > 4 &&
          dir * (b[axis] - at) > 4 &&
          (a[fixed] - c[fixed]) * (a[fixed] - d[fixed]) < 0
        )
          hits.push(at);
      }
    const command = axis === 0 ? "H" : "V";
    let last;
    for (const at of hits.sort((x, y) => dir * (x - y))) {
      if (last !== undefined && Math.abs(last - at) < 8) continue;
      const end = [...a];
      end[axis] = at + dir * 3;
      path += command + (at - dir * 3) + " A3 3 0 0 1 " + end.join(" ");
      last = at;
    }
    path += command + b[axis];
    segments.push([a, b]);
  }
  previous.push(...segments);
  return path;
}
export function boundarySVG(
  model,
  selected = "",
  references = [],
  hover = "",
  dragging = "",
) {
  const { frames, boxes, width, height, representatives } =
    boundaryLayout(model);
  const text = (x, y, s, size = 12, weight = 400) =>
    '<text x="' +
    x +
    '" y="' +
    y +
    '" font-size="' +
    size +
    '" font-weight="' +
    weight +
    '">' +
    escape(s) +
    "</text>";
  const frame = frames
    .map(
      (f) =>
        '<g><rect x="' +
        f.x +
        '" y="' +
        f.y +
        '" width="' +
        f.w +
        '" height="' +
        f.h +
        '" rx="8" fill="#fbfcfd" stroke="#a5aeb6"/><rect x="' +
        (f.x + 12) +
        '" y="' +
        (f.y + 15) +
        '" width="5" height="15" rx="2" fill="' +
        colors[f.provider] +
        '"/>' +
        text(f.x + 24, f.y + 28, f.provider, 15, 650) +
        "</g>",
    )
    .join("");
  const nodes = boxes
    .map((b) => {
      const x = b.x,
        y = b.y,
        c = colors[b.provider],
        active = selected === b.id;
      const label = b.label.length > 27 ? b.label.slice(0, 25) + "…" : b.label;
      const meta = b.hidden
        ? "접힘 · " + b.hidden + "개 리소스"
        : b.cidr || b.kind;
      const locked = model.presentation?.locked?.includes(b.id);
      const annotation = model.presentation?.annotations?.[b.id];
      const eligible =
        dragging &&
        canPlace(
          model,
          model.nodes.find((n) => n.id === dragging),
          model.nodes.find((n) => n.id === b.id),
        );
      const paper =
        model.presentation?.resources === false ? ' visibility="hidden"' : "";

      const glyph = b.container
        ? "M2 4h7l2 3h8v10H2z"
        : "M4 4h13v13H4zM7 1v3m6-3v3M7 17v3m6-3v3M1 8h3m13 0h3";
      return (
        "<g" +
        paper +
        '><rect data-boundary="' +
        escape(b.id) +
        '" x="' +
        x +
        '" y="' +
        y +
        '" width="' +
        b.w +
        '" height="' +
        b.h +
        '" rx="5" fill="' +
        (b.container ? (b.depth % 2 ? "#f8fbfd" : "#eff4f6") : "#fff") +
        '" stroke="' +
        (hover === b.id
          ? "#12794c"
          : eligible
            ? "#278767"
            : active
              ? "#175787"
              : b.container
                ? c
                : "#c3cbd2") +
        '" stroke-width="' +
        (hover === b.id ? 4 : eligible || active ? 2 : 1) +
        '" ' +
        (b.container && !active ? 'stroke-dasharray="5 3"' : "") +
        "/>" +
        '<g data-scope="' +
        escape(b.id) +
        '" role="button" tabindex="0" aria-label="컴포넌트 ' +
        escape(b.label) +
        '"><title>' +
        escape(b.label + " · " + meta) +
        '</title><rect fill="transparent" x="' +
        x +
        '" y="' +
        y +
        '" width="' +
        b.w +
        '" height="42"/>' +
        '<path d="' +
        glyph +
        '" transform="translate(' +
        (x + 9) +
        " " +
        (y + 11) +
        ')" fill="none" stroke="' +
        c +
        '" stroke-width="1.5"/>' +
        text(x + 36, y + 19, (locked ? "▣ " : "") + label, 12, 650) +
        text(
          x + 36,
          y + 34,
          meta.length > 32 ? meta.slice(0, 31) + "…" : meta,
          10,
        ) +
        "</g></g>" +
        (model.presentation?.notes !== false && annotation
          ? text(x + 36, y + 43, String(annotation).slice(0, 40), 9)
          : "")
      );
    })
    .join("");
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const segments = [];
  const arrows = references
    .filter(
      (e) =>
        representatives.get(e.source) === selected ||
        representatives.get(e.target) === selected,
    )
    .map((e, i) => {
      const a = byId.get(representatives.get(e.source)),
        b = byId.get(representatives.get(e.target));
      if (!a || !b || a.id === b.id) return "";
      const key = [e.source, e.field, e.target].join(":");
      const [x1, y1] = anchor(
        a,
        model.presentation?.anchors?.[key + ":source"],
      );
      const [x2, y2] = anchor(
        b,
        model.presentation?.anchors?.[key + ":target"],
      );
      const lane = Math.max(x1, x2) + 5 + (i % 4) * 2;
      const point = model.presentation?.routes?.[key];
      const moved = Number.isFinite(point?.x) && Number.isFinite(point?.y);
      const hx = moved ? point.x : lane,
        hy = moved ? point.y : (y1 + y2) / 2;
      const source = model.nodes.find((n) => n.id === e.source),
        target = model.nodes.find((n) => n.id === e.target);
      const field = placementFields[source?.kind]?.[0];
      const reconnect =
        field &&
        a.id === e.source &&
        b.id === e.target &&
        !model.presentation?.locked?.includes(source.id) &&
        (source.imported
          ? source.placementSource && source.scopeAddress === target?.address
          : source.props[field] === e.target);
      const points = moved
        ? [
            [x1, y1],
            [hx, y1],
            [hx, hy],
            [x2, hy],
            [x2, y2],
          ]
        : y1 === y2
          ? [
              [x1, y1],
              [x1, y1 - 10],
              [x2, y2 - 10],
              [x2, y2],
            ]
          : [
              [x1, y1],
              [lane, y1],
              [lane, y2],
              [x2, y2],
            ];
      const route = connectorPath(
        points,
        segments,
        model.presentation?.crossings !== false,
      );
      return (
        '<path data-reference="true" d="' +
        route +
        '" fill="none" stroke="#246782" stroke-width="1.8" marker-end="url(#scope-arrow)"><title>' +
        escape(a.label + " → " + b.label + " · " + e.field) +
        '</title></path><circle pointer-events="all" data-bend="' +
        escape(key) +
        '" cx="' +
        hx +
        '" cy="' +
        hy +
        '" r="4" fill="#fff" stroke="#246782"><title>꺾임점 이동</title></circle>' +
        (reconnect
          ? '<circle data-reconnect="' +
            escape(source.id) +
            '" pointer-events="all" cx="' +
            x2 +
            '" cy="' +
            y2 +
            '" r="4" fill="#246782"><title>소속 참조 대상 변경</title></circle>'
          : "")
      );
    })
    .join("");
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    width +
    " " +
    height +
    '" font-family="sans-serif" fill="#243440"><title>' +
    escape(model.title) +
    "</title>" +
    frame +
    nodes +
    (arrows
      ? '<defs><marker id="scope-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#246782"/></marker></defs><g pointer-events="none">' +
        arrows +
        "</g>"
      : "") +
    "</svg>"
  );
}
