import {
  layoutArchitecture,
  newArchitecture,
  newComponent,
} from "./architecture.mjs";
const studies = [
  {
    id: "azure-private-data-estate",
    provider: "Azure",
    name: "AVM · 사업부별 사설 데이터 구역",
    study:
      "수집·재무·감사 구역마다 Resource Group, VNet과 Private Endpoint 기반 저장소를 분리한다. 부서별 수명과 저장소 복제 정책을 비교한다.",
    build(add) {
      for (const [i, name, sku] of [
        [0, "intake", "Standard_LRS"],
        [1, "finance", "Standard_ZRS"],
        [2, "audit", "Standard_GRS"],
      ]) {
        const group = add("avm_resource_group", name + "-rg");
        const network = add("avm_virtual_network", name + "-network", {
          group,
          cidr: "10." + (50 + i) + ".0.0/16",
          subnet_cidr: "10." + (50 + i) + ".1.0/24",
        });
        add("avm_storage_account", name + "store", { network, sku });
      }
    },
  },
];
function buildStudy(entry) {
  const model = newArchitecture();
  model.title = entry.provider + " · " + entry.name;
  model.review = { operations: entry.study };
  entry.build((kind, label, props = {}) => {
    const node = newComponent(kind);
    node.label = label;
    const storage = [
      "avm_storage_account",
      "aws_s3_bucket",
      "google_storage_bucket",
    ].includes(kind);
    Object.assign(
      node.props,
      {
        name: storage
          ? label.replaceAll("-", "") + node.id.slice(2, 10)
          : label,
      },
      props,
    );
    model.nodes.push(node);
    return node.id;
  });
  return layoutArchitecture(model);
}
export const architectureCatalog = studies.map(({ build, ...entry }) => {
  const kinds = new Set();
  build((kind, label) => {
    kinds.add(kind);
    return label;
  });
  return { ...entry, kinds: [...kinds] };
});
export function fromCatalog(id) {
  const entry = studies.find((s) => s.id === id);
  if (!entry) throw Error("템플릿을 찾을 수 없습니다.");
  return buildStudy(entry);
}
export function terraformDeclarations(text, nodes) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return [];
  }
  return nodes.flatMap((n) => {
    const module = n.kind.startsWith("avm_");
    const address = n.address || (module ? "module" : n.kind) + "." + n.id;
    const parts = address.split(".");
    const block =
      parts.length === 2 &&
      (module || parts[0] === "module"
        ? doc?.module?.[parts[1]]
        : doc?.resource?.[parts[0]]?.[parts[1]]);
    return block ? [{ id: n.id, address, block }] : [];
  });
}
