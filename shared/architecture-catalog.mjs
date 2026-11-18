import {
  layoutArchitecture,
  newArchitecture,
  newComponent,
} from "./architecture.mjs";
const studies = [
  {
    id: "aws-recovery-isolation",
    provider: "AWS",
    name: "결제 서비스 · 격리 복구 리허설",
    study:
      "운영의 API·정산 작업과 복구 검증 환경을 서로 다른 VPC에 배치한다. 격리된 복구 VPC에서 원본 데이터 반입과 검증 후 폐기 절차를 검토한다.",
    build(add) {
      const prod = add("aws_vpc", "payments-prod", { cidr: "10.40.0.0/16" });
      const recovery = add("aws_vpc", "restore-lab", { cidr: "10.41.0.0/16" });
      for (const [vpc, tier, cidr, workers] of [
        [prod, "api", "10.40.1.0/24", ["orders", "ledger"]],
        [prod, "batch", "10.40.2.0/24", ["settlement"]],
        [
          recovery,
          "verification",
          "10.41.1.0/24",
          ["restore-runner", "reconciliation"],
        ],
      ]) {
        const subnet = add("aws_subnet", tier, { vpc, cidr });
        for (const name of workers) add("aws_instance", name, { subnet });
      }
      add("aws_s3_bucket", "payment-audit-archive");
    },
  },
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
  {
    id: "gcp-data-cutover",
    provider: "GCP",
    name: "분석 배치 플랫폼 · 병행 이전 검증",
    study:
      "기존 적재·변환 워커와 후보 플랫폼을 분리하고 검증 워커에서 결과를 비교하는 이전 설계다. 전환 전 데이터 전송과 대조 절차를 정한다.",
    build(add) {
      for (const [i, env, tiers] of [
        [0, "legacy", ["ingest", "transform"]],
        [1, "candidate", ["ingest", "transform", "compare"]],
      ]) {
        const network = add("google_compute_network", env);
        for (const [j, tier] of tiers.entries()) {
          const subnet = add("google_compute_subnetwork", env + "-" + tier, {
            network,
            cidr: "10." + (60 + i) + "." + j + ".0/24",
          });
          add("google_compute_instance", env + "-" + tier + "-worker", {
            subnet,
          });
        }
        add("google_storage_bucket", env + "-results");
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
