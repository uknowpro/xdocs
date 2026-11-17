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
const containerKinds = new Set([
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
  function measure(n) {
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
    boxes.push({
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
    boxes,
    width: groups.size > 1 ? 614 : 310,
    height: top + rowHeight + 10,
  };
}
export function boundarySVG(model, selected = "") {
  const { frames, boxes, width, height } = boundaryLayout(model);
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
      const meta = b.cidr || b.kind;
      const glyph = b.container
        ? "M2 4h7l2 3h8v10H2z"
        : "M4 4h13v13H4zM7 1v3m6-3v3M7 17v3m6-3v3M1 8h3m13 0h3";
      return (
        '<rect x="' +
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
        (active ? "#175787" : b.container ? c : "#c3cbd2") +
        '" stroke-width="' +
        (active ? 2 : 1) +
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
        text(x + 36, y + 19, label, 12, 650) +
        text(
          x + 36,
          y + 34,
          meta.length > 32 ? meta.slice(0, 31) + "…" : meta,
          10,
        ) +
        "</g>"
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
    "</svg>"
  );
}
