import {
  COMPONENTS,
  layoutArchitecture,
  newArchitecture,
  newComponent,
} from "./architecture.mjs";
export const architectureCatalog = [
  {
    id: "aws-network",
    provider: "AWS",
    name: "VPC와 서브넷",
    kinds: ["aws_vpc", "aws_subnet"],
  },
  {
    id: "aws-compute",
    provider: "AWS",
    name: "서브넷 내 EC2",
    kinds: ["aws_vpc", "aws_subnet", "aws_instance"],
  },
  {
    id: "aws-storage",
    provider: "AWS",
    name: "S3 오브젝트 저장소",
    kinds: ["aws_s3_bucket"],
  },
  {
    id: "azure-network",
    provider: "Azure",
    name: "리소스 그룹과 VNet 서브넷",
    kinds: [
      "azurerm_resource_group",
      "azurerm_virtual_network",
      "azurerm_subnet",
    ],
  },
  {
    id: "azure-storage",
    provider: "Azure",
    name: "리소스 그룹 내 Storage Account",
    kinds: ["azurerm_resource_group", "azurerm_storage_account"],
  },
  {
    id: "azure-avm",
    provider: "Azure",
    name: "AVM 프라이빗 스토리지",
    kinds: ["avm_resource_group", "avm_virtual_network", "avm_storage_account"],
  },
  {
    id: "gcp-network",
    provider: "GCP",
    name: "VPC와 리전 서브넷",
    kinds: ["google_compute_network", "google_compute_subnetwork"],
  },
  {
    id: "gcp-compute",
    provider: "GCP",
    name: "서브넷 내 Compute Engine",
    kinds: [
      "google_compute_network",
      "google_compute_subnetwork",
      "google_compute_instance",
    ],
  },
  {
    id: "gcp-storage",
    provider: "GCP",
    name: "Cloud Storage 버킷",
    kinds: ["google_storage_bucket"],
  },
];
export function fromCatalog(id) {
  const entry = architectureCatalog.find((e) => e.id === id);
  if (!entry) throw Error("템플릿을 찾을 수 없습니다.");
  const model = newArchitecture();
  model.title = entry.provider + " · " + entry.name;
  for (const kind of entry.kinds) {
    const node = newComponent(kind);
    for (const [key, field] of Object.entries(COMPONENTS[kind].fields)) {
      if (field.ref)
        node.props[key] =
          model.nodes.find((n) => n.kind === field.ref)?.id || "";
    }
    if (
      [
        "azurerm_storage_account",
        "avm_storage_account",
        "google_storage_bucket",
        "aws_s3_bucket",
      ].includes(kind)
    )
      node.props.name = "xdocs" + node.id.slice(2);
    model.nodes.push(node);
  }
  return layoutArchitecture(model);
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
