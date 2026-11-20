import {caseDiagram} from "./case-diagrams.mjs";
import { boundarySVG, indexedPlacementTarget } from "./network-boundaries.mjs";
import { validateDrawing, drawingSVG } from "./aws-drawing.mjs";
import { stringify as yaml } from "yaml";
const field = (label, value = "", extra = {}) => ({ label, value, ...extra });
const ref = (label, kind) => field(label, "", { ref: kind, required: true });
/** @type {Record<string, any>} */
export const COMPONENTS = {
  aws_vpc: {
    group: "AWS",
    label: "VPC",
    fields: {
      name: field("이름", "network"),
      cidr: field("CIDR", "10.0.0.0/16", { cidr: true }),
    },
  },
  aws_route_table: {group:"AWS",label:"Route Table",fields:{name:field("이름","routes"),vpc:ref("VPC","aws_vpc")}},
  aws_subnet: {
    group: "AWS",
    label: "Subnet",
    fields: {
      name: field("이름", "private"),
      vpc: ref("VPC", "aws_vpc"),
      cidr: field("CIDR", "10.0.1.0/24", { cidr: true }),
    },
  },
  aws_instance: {
    group: "AWS",
    label: "EC2",
    fields: {
      name: field("이름", "server"),
      subnet: ref("Subnet", "aws_subnet"),
      ami: field("AMI ID", ""),
      instance_type: field("인스턴스 유형", "t3.micro"),
    },
  },
  aws_s3_bucket: {
    group: "AWS",
    label: "S3 Bucket",
    fields: { name: field("버킷 이름", "", { required: true }) },
  },
  azurerm_resource_group: {
    group: "Azure",
    label: "Resource Group",
    fields: {
      name: field("이름", "xdocs-rg"),
      location: field("위치", "koreacentral"),
    },
  },
  azurerm_virtual_network: {
    group: "Azure",
    label: "Virtual Network",
    fields: {
      name: field("이름", "network"),
      group: ref("Resource Group", "azurerm_resource_group"),
      cidr: field("CIDR", "10.10.0.0/16", { cidr: true }),
    },
  },
  azurerm_network_security_group:{group:"Azure",label:"Network Security Group",fields:{name:field("이름","workload-nsg"),group:ref("Resource Group","azurerm_resource_group")}},
  azurerm_subnet: {
    group: "Azure",
    label: "Subnet",
    fields: {
      name: field("이름", "private"),
      network: ref("Virtual Network", "azurerm_virtual_network"),
      cidr: field("CIDR", "10.10.1.0/24", { cidr: true }),
    },
  },
  azurerm_linux_virtual_machine: {
    group: "Azure",
    label: "Linux VM",
    fields: {
      name: field("이름", "server"),
      subnet: ref("Subnet", "azurerm_subnet"),
      size: field("크기", "Standard_B1s"),
      username: field("관리자", "azureuser"),
      ssh_key: field("SSH 공개키", "", { required: true }),
    },
  },
  azurerm_storage_account: {
    group: "Azure",
    label: "Storage Account",
    fields: {
      name: field("이름 (소문자·숫자 3–24자)", "", { required: true }),
      group: ref("Resource Group", "azurerm_resource_group"),
    },
  },
  google_compute_network: {
    group: "GCP",
    label: "VPC Network",
    fields: { name: field("이름", "network") },
  },
  google_compute_router:{group:"GCP",label:"Cloud Router",fields:{name:field("이름","workload-router"),network:ref("VPC Network","google_compute_network")}},
  google_compute_subnetwork: {
    group: "GCP",
    label: "Subnetwork",
    fields: {
      name: field("이름", "private"),
      network: ref("VPC Network", "google_compute_network"),
      cidr: field("CIDR", "10.20.0.0/24", { cidr: true }),
    },
  },
  google_compute_instance: {
    group: "GCP",
    label: "Compute Engine",
    fields: {
      name: field("이름", "server"),
      subnet: ref("Subnetwork", "google_compute_subnetwork"),
      machine_type: field("머신 유형", "e2-micro"),
      zone: field("Zone", "asia-northeast3-a"),
      image: field("이미지", "debian-cloud/debian-12"),
    },
  },
  google_storage_bucket: {
    group: "GCP",
    label: "Cloud Storage",
    fields: {
      name: field("버킷 이름", "", { required: true }),
      location: field("위치", "ASIA-NORTHEAST3"),
    },
  },
  k8s_namespace: {
    group: "Kubernetes",
    label: "Namespace",
    fields: { name: field("이름", "app") },
  },
  k8s_deployment: {
    group: "Kubernetes",
    label: "Deployment",
    fields: {
      name: field("이름", "web"),
      namespace: ref("Namespace", "k8s_namespace"),
      image: field("컨테이너 이미지", "nginx:1.28"),
      replicas: field("복제 수", "2", { number: true, min: 0, max: 1000 }),
      port: field("컨테이너 포트", "80", { number: true, min: 1, max: 65535 }),
    },
  },
  k8s_service: {
    group: "Kubernetes",
    label: "Service",
    fields: {
      name: field("이름", "web"),
      deployment: ref("Deployment", "k8s_deployment"),
      port: field("서비스 포트", "80", { number: true, min: 1, max: 65535 }),
    },
  },
  k8s_ingress: {
    group: "Kubernetes",
    label: "Ingress",
    fields: {
      name: field("이름", "web"),
      service: ref("Service", "k8s_service"),
      host: field("호스트", "app.example.com"),
      class: field("Ingress class", "nginx"),
    },
  },
  k8s_configmap: {
    group: "Kubernetes",
    label: "ConfigMap",
    fields: {
      name: field("이름", "settings"),
      namespace: ref("Namespace", "k8s_namespace"),
      data: field("데이터 (JSON 문자열 맵)", "{}", { json: true }),
    },
  },
  k8s_pvc: {
    group: "Kubernetes",
    label: "Volume Claim",
    fields: {
      name: field("이름", "data"),
      namespace: ref("Namespace", "k8s_namespace"),
      storage: field("용량", "10Gi"),
      storage_class: field("Storage class (빈 값: 기본값)", ""),
    },
  },
};
export const AVM_MODULES = {
  avm_resource_group: {
    source: "Azure/avm-res-resources-resourcegroup/azurerm",
    version: "0.5.0",
  },
  avm_virtual_network: {
    source: "Azure/avm-res-network-virtualnetwork/azurerm",
    version: "0.23.0",
  },
  avm_storage_account: {
    source: "Azure/avm-res-storage-storageaccount/azurerm",
    version: "0.11.0",
  },
};
Object.assign(COMPONENTS, {
  avm_resource_group: {
    group: "Azure AVM",
    label: "AVM Resource Group",
    fields: {
      name: field("이름", "xdocs-avm-rg"),
      location: field("위치", "koreacentral"),
    },
  },
  avm_virtual_network: {
    group: "Azure AVM",
    label: "AVM Virtual Network",
    fields: {
      name: field("이름", "avm-network"),
      group: ref("AVM Resource Group", "avm_resource_group"),
      cidr: field("VNet CIDR", "10.30.0.0/16", { cidr: true }),
      subnet_cidr: field("Private Endpoint Subnet", "10.30.1.0/24", {
        cidr: true,
      }),
    },
  },
  avm_storage_account: {
    group: "Azure AVM",
    label: "AVM Private Storage",
    fields: {
      name: field("이름 (소문자·숫자 3–24자)", "", { required: true }),
      network: ref("AVM Virtual Network", "avm_virtual_network"),
      sku: field("복제 SKU", "Standard_ZRS", {
        options: [
          "Standard_LRS",
          "Standard_ZRS",
          "Standard_GRS",
          "Standard_GZRS",
        ],
      }),
    },
  },
});
export const WAF_PILLARS = [
  {
    id: "reliability",
    label: "신뢰성",
    prompt: "가용 영역·복제, 백업, RTO/RPO와 복구 훈련을 검토하세요.",
  },
  {
    id: "security",
    label: "보안",
    prompt:
      "최소 권한·비밀 관리·Private Endpoint/DNS·TLS·네트워크 경계를 검토하세요.",
  },
  {
    id: "cost",
    label: "비용 최적화",
    prompt: "예산·태그·SKU·데이터 전송 및 로그 보존 비용을 검토하세요.",
  },
  {
    id: "operations",
    label: "운영 우수성",
    prompt: "진단 로그·경보·배포 검토·롤백·운영 담당자를 검토하세요.",
  },
  {
    id: "performance",
    label: "성능 효율성",
    prompt: "성능 목표·부하 시험·확장·한도와 지역별 용량을 검토하세요.",
  },
];
export function architectureReview(m) {
  return WAF_PILLARS.map((p) => ({
    ...p,
    note: m.review?.[p.id] || "",
    observations: [
      ...(p.id === "reliability" &&
      m.nodes.some(
        (n) =>
          n.kind.includes("instance") || n.kind.includes("virtual_machine"),
      )
        ? ["단일 VM은 다중 영역 가용성·백업을 보장하지 않습니다."]
        : []),
      ...(p.id === "security" &&
      m.nodes.some((n) => n.kind === "avm_storage_account")
        ? [
            "AVM Storage: 공개망·공유키 비활성, Blob Private Endpoint 및 Private DNS 연결을 생성합니다. 다른 서비스 endpoint·RBAC는 검토가 필요합니다.",
          ]
        : []),
      ...(p.id === "operations" ? [...new Set(m.nodes.filter(n=>!n.imported && Object.hasOwn(AVM_MODULES,n.kind)).map(n=>{
        const module=AVM_MODULES[n.kind];
        return module.source+" @ "+module.version+" · 모듈 업데이트 시 입력·출력과 리소스 참조 변경을 검토하세요.";
      }))] : []),
      ...(p.id === "operations"
        ? ["진단 수집·경보와 실제 배포 검증은 자동 구성되지 않습니다."]
        : []),
    ],
  }));
}
export const IMPORT_FIELDS = {
  aws_vpc: { name: "", cidr: "cidr_block" },
  aws_route_table:{},
  azurerm_network_security_group:{name:"name"},
  google_compute_router:{name:"name"},
  aws_subnet: { cidr: "cidr_block" },
  aws_instance: { ami: "ami", instance_type: "instance_type" },
  aws_s3_bucket: { name: "bucket" },
  azurerm_resource_group: { name: "name", location: "location" },
  azurerm_virtual_network: { name: "name" },
  azurerm_subnet: { name: "name" },
  azurerm_linux_virtual_machine: { name: "name", size: "size" },
  azurerm_storage_account: { name: "name" },
  google_compute_network: { name: "name" },
  google_compute_subnetwork: { name: "name", cidr: "ip_cidr_range" },
  google_compute_instance: {
    name: "name",
    machine_type: "machine_type",
    zone: "zone",
  },
  google_storage_bucket: { name: "name", location: "location" },
};
export function newArchitecture() {
  return {
    version: 1,
    title: "새 아키텍처",
    settings: {
      aws_region: "ap-northeast-2",
      azure_subscription: "",
      gcp_project: "",
      gcp_region: "asia-northeast3",
    },
    nodes: [],
    sources: [],
    warnings: [],
  };
}
export function newComponent(kind, x = 80, y = 80) {
  if (!Object.hasOwn(COMPONENTS, kind))
    throw Error("지원하지 않는 컴포넌트입니다.");
  return {
    id: "n_" + globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 16),
    kind,
    label: COMPONENTS[kind].label,
    x,
    y,
    props: Object.fromEntries(
      Object.entries(COMPONENTS[kind].fields).map(([k, f]) => [k, f.value]),
    ),
  };
}
const plain = (v) => v && typeof v === "object" && !Array.isArray(v);
export function validateArchitecture(m) {
  if (
    !plain(m) ||
    m.version !== 1 ||
    (m.caseStudyId !== undefined && typeof m.caseStudyId !== "string") ||
    typeof m.title !== "string" ||
    m.title.length > 200 ||
    !plain(m.settings) ||
    !Array.isArray(m.nodes) ||
    m.nodes.length > 300 ||
    !Array.isArray(m.sources) ||
    m.sources.length > 100 ||
    !Array.isArray(m.warnings) ||
    m.warnings.some((v) => typeof v !== "string" || v.length > 2000) ||
    Object.values(m.settings).some(
      (v) => typeof v !== "string" || v.length > 500,
    ) ||
    (m.review &&
      (!plain(m.review) ||
        Object.values(m.review).some(
          (v) => typeof v !== "string" || v.length > 20000,
        )))
  )
    throw Error("지원하지 않는 아키텍처 문서입니다.");
  const view = m.presentation;
  if (
    view !== undefined &&
    (!plain(view) ||
      ["locked", "folded"].some(
        (k) =>
          view[k] !== undefined &&
          (!Array.isArray(view[k]) ||
            view[k].some((v) => typeof v !== "string")),
      ) ||
      ["refs", "resources", "notes", "crossings"].some(
        (k) => view[k] !== undefined && typeof view[k] !== "boolean",
      ) ||
      (view.annotations !== undefined &&
        (!plain(view.annotations) ||
          Object.values(view.annotations).some(
            (v) => typeof v !== "string" || v.length > 160,
          ))) ||
      (view.annotationLinks !== undefined && (!Array.isArray(view.annotationLinks) || view.annotationLinks.length>500 || view.annotationLinks.some(l=>!plain(l) || typeof l.source!=="string" || typeof l.target!=="string" || l.source===l.target || typeof l.label!=="string" || l.label.length>100))) ||
      (view.anchors !== undefined &&
        (!plain(view.anchors) ||
          Object.values(view.anchors).some(
            (side) => !["right", "left", "top", "bottom"].includes(side),
          ))) ||
      (view.routes !== undefined &&
        (!plain(view.routes) ||
          Object.values(view.routes).some(
            (p) => !plain(p) || !Number.isFinite(p.x) || !Number.isFinite(p.y),
          ))))
  )
    throw Error("도면 표시 설정을 확인하세요.");
  const ids = new Set();
  for (const n of m.nodes) {
    if (
      !plain(n) ||
      !/^n_[a-z0-9_]{1,60}$/.test(n.id) ||
      ids.has(n.id) ||
      typeof n.kind !== "string" ||
      typeof n.label !== "string" ||
      n.label.length > 200 ||
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y) ||
      Math.abs(n.x) > 10000 ||
      Math.abs(n.y) > 10000 ||
      !plain(n.props) ||
      Object.values(n.props).some(
        (v) => typeof v !== "string" || v.length > 20000,
      )
    )
      throw Error("컴포넌트 형식을 확인해 주세요.");
    if (n.unresolvedReferences !== undefined &&
        (!Array.isArray(n.unresolvedReferences) || n.unresolvedReferences.some(v=>typeof v!=="string")))
      throw Error("미해석 참조 형식을 확인하세요.");
    if (!n.imported && !Object.hasOwn(COMPONENTS, n.kind))
      throw Error("알 수 없는 컴포넌트입니다.");
    if (
      n.imported &&
      (!/^(?:data\.)?[A-Za-z_][\w-]*\.[A-Za-z_][\w-]*$/.test(n.address) ||
        (n.subnetPrefixes !== undefined && (!Array.isArray(n.subnetPrefixes) || n.subnetPrefixes.some(v => typeof v !== "string"))) ||
        (n.moduleTrace !== undefined &&
          (!plain(n.moduleTrace) ||
            ["address", "file", "expression"].some(
              (k) => typeof n.moduleTrace[k] !== "string",
            ) ||
            ["target", "targetFile"].some(
              (k) =>
                n.moduleTrace[k] !== undefined &&
                typeof n.moduleTrace[k] !== "string",
            ))) ||
        (n.interfaceEvidence !== undefined &&
          (n.kind !== "google_compute_instance" ||
            !Array.isArray(n.interfaceEvidence) ||
            n.interfaceEvidence.some((line) => typeof line !== "string"))) ||
        (n.nicAddress !== undefined &&
          (![
            "azurerm_linux_virtual_machine",
            "azurerm_windows_virtual_machine",
          ].includes(n.kind) ||
            typeof n.nicAddress !== "string" ||
            !/^azurerm_network_interface\.[\w-]+$/.test(n.nicAddress))) ||
        (n.placementValue !== undefined &&
          typeof n.placementValue !== "string") ||
        (n.placementSource !== undefined &&
          (!plain(n.placementSource) ||
            n.placementSource.address !== n.scopeAddress ||
            typeof n.placementSource.file !== "string" ||
            !Number.isSafeInteger(n.placementSource.offset) ||
            n.placementSource.offset < 0 ||
            !Array.isArray(n.placementSource.otherRefs) ||
            n.placementSource.otherRefs.some(
              (ref) => typeof ref !== "string",
            ))) ||
        !plain(n.original) ||
        !Array.isArray(n.references) ||
        n.references.some((v) => typeof v !== "string") ||
        Object.values(n.original).some((v) => typeof v !== "string"))
    )
      throw Error("가져온 리소스 형식을 확인해 주세요.");
    ids.add(n.id);
  }
  if (m.drawing) validateDrawing(m.drawing);
  const paths = new Set();
  for (const f of m.sources) {
    if (
      !plain(f) ||
      typeof f.name !== "string" ||
      !/^(?:[A-Za-z0-9_-][\w.-]*\/)*[A-Za-z0-9_-][\w.-]*\.tf(?:\.json)?$/.test(
        f.name,
      ) ||
      f.name.startsWith(".") ||
      paths.has(f.name.toLowerCase()) ||
      (f.preservedDeclarations !== undefined &&
        (!Array.isArray(f.preservedDeclarations) || f.preservedDeclarations.some(v=>typeof v!=="string"))) ||
      typeof f.content !== "string"
    )
      throw Error("Terraform 원본 파일 이름을 확인해 주세요.");
    paths.add(f.name.toLowerCase());
  }
  if (new TextEncoder().encode(JSON.stringify(m)).length > 4_000_000)
    throw Error("아키텍처 노트는 4 MB 이하만 지원합니다.");
  return m;
}
export const encodeArchitecture = (m) =>
  "```xdocs-architecture\n" +
  JSON.stringify(validateArchitecture(m)).replaceAll("`", "\\u0060") +
  "\n```";
export function decodeArchitecture(body) {
  const m = body.match(/^```xdocs-architecture\r?\n([^]*?)\r?\n```$/m);
  return m ? validateArchitecture(JSON.parse(m[1])) : null;
}
export const replaceArchitecture = (body, m) =>
  body.replace(/^```xdocs-architecture\r?\n[^]*?\r?\n```$/m, () =>
    encodeArchitecture(m),
  );
export function architectureEdges(m) {
  const edges = [];
  for (const n of m.nodes) {
    if (n.imported) {
      const indexed = indexedPlacementTarget(n, m.nodes);
      for (const address of n.references) {
        const target = m.nodes.find((t) => t.address === address);
        if (target)
          edges.push({
            source: n.id,
            target: target.id,
            field: "원본 참조",
            ...(target === indexed ? { label: "선언 참조 · each.key" } : {}),
            locked: true,
          });
      }
    } else
      for (const [k, f] of Object.entries(COMPONENTS[n.kind].fields)) {
        if (f.ref && n.props[k])
          edges.push({
            source: n.id,
            target: n.props[k],
            field: k,
            locked: false,
          });
      }
  }
  return edges;
}
export function removeComponent(m, id) {
  if (m.nodes.find((n) => n.id === id)?.imported)
    throw Error("가져온 리소스는 원본 보존을 위해 삭제하지 않습니다.");
  return {
    ...m,
    ...(m.presentation?.annotationLinks ? {presentation:{...m.presentation,annotationLinks:m.presentation.annotationLinks.filter(l=>l.source!==id && l.target!==id)}}:{}),
    nodes: m.nodes
      .filter((n) => n.id !== id)
      .map((n) => ({
        ...n,
        props: Object.fromEntries(
          Object.entries(n.props).map(([k, v]) => [k, v === id ? "" : v]),
        ),
      })),
  };
}
const literal = (s) =>
  String(s)
    .replaceAll("${", () => "$${")
    .replaceAll("%{", "%%{");
const json = (v) => JSON.stringify(v, null, 2) + "\n";
function subset(m, ids) {
  if (!ids?.length) return m.nodes;
  const chosen = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of architectureEdges(m))
      if (chosen.has(e.source) && !chosen.has(e.target)) {
        chosen.add(e.target);
        changed = true;
      }
  }
  return m.nodes.filter((n) => chosen.has(n.id));
}
export function architectureIssues(m) {
  validateArchitecture(m);
  const issues = [];
  for (const issue of subnetConflicts(m.nodes)) {
    issues.push({id:issue.id, message:issue.message}, {id:issue.otherId, message:issue.message});
  }
  const seen = new Set();
  for (const n of m.nodes) {
    if (n.imported) {
      for (const [key, value] of Object.entries(n.props)) {
        if (value === n.original[key]) continue;
        const f = COMPONENTS[n.kind]?.fields[key];
        if (f && (!value || (f.cidr && !validCIDR(value))))
          issues.push({ id: n.id, message: f.label + " 변경값을 확인하세요." });
      }
      continue;
    }
    for (const [k, f] of Object.entries(COMPONENTS[n.kind].fields)) {
      const v = n.props[k] ?? "";
      if (
        (f.required || (!f.ref && !["storage_class", "ami"].includes(k))) &&
        !v
      )
        issues.push({ id: n.id, message: f.label + "을 입력하세요." });
      if (f.ref && v && !m.nodes.some((t) => t.id === v && t.kind === f.ref))
        issues.push({
          id: n.id,
          message: f.label + " 연결이 올바르지 않습니다.",
        });
      if (
        f.number &&
        (!/^\d+$/.test(v) || Number(v) < f.min || Number(v) > f.max)
      )
        issues.push({ id: n.id, message: f.label + " 범위를 확인하세요." });
      if (f.cidr && v && !validCIDR(v))
        issues.push({ id: n.id, message: "IPv4 CIDR을 확인하세요." });
      if (f.json) {
        try {
          const d = JSON.parse(v);
          if (
            !plain(d) ||
            Object.values(d).some((v) => typeof v !== "string") ||
            Object.keys(d).some((k) => !/^[-._a-zA-Z0-9]+$/.test(k))
          )
            throw Error();
        } catch {
          issues.push({
            id: n.id,
            message: "데이터는 문자열 값으로 된 JSON 객체여야 합니다.",
          });
        }
      }
    }
    for (const [key, f] of Object.entries(COMPONENTS[n.kind].fields)) {
      if (f.options && !f.options.includes(n.props[key]))
        issues.push({ id: n.id, message: f.label + " 선택을 확인하세요." });
      if (f.ref && n.props.cidr) {
        const parent = m.nodes.find((t) => t.id === n.props[key]);
        if (
          parent?.props.cidr &&
          validCIDR(parent.props.cidr) &&
          validCIDR(n.props.cidr) &&
          !cidrContains(parent.props.cidr, n.props.cidr)
        )
          issues.push({
            id: n.id,
            message: "Subnet CIDR은 상위 네트워크 안에 있어야 합니다.",
          });
      }
    }
    if (
      n.kind === "avm_virtual_network" &&
      validCIDR(n.props.cidr) &&
      validCIDR(n.props.subnet_cidr) &&
      !cidrContains(n.props.cidr, n.props.subnet_cidr)
    )
      issues.push({
        id: n.id,
        message: "Private Endpoint Subnet은 VNet CIDR 안에 있어야 합니다.",
      });
    const name = n.props.name;
    if (
      n.kind.startsWith("k8s_") &&
      (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name) || name.length > 63)
    )
      issues.push({
        id: n.id,
        message: "Kubernetes 이름은 소문자·숫자·하이픈 1–63자로 입력하세요.",
      });
    if (
      ["azurerm_storage_account", "avm_storage_account"].includes(n.kind) &&
      !/^[a-z0-9]{3,24}$/.test(name)
    )
      issues.push({
        id: n.id,
        message: "Storage Account 이름은 소문자·숫자 3–24자입니다.",
      });
    const key =
      n.kind +
      ":" +
      name +
      ":" +
      (n.props.namespace ||
        (n.kind === "aws_subnet"
          ? n.props.vpc
          : ["azurerm_subnet", "google_compute_subnetwork"].includes(n.kind)
            ? n.props.network
            : ""));
    if (seen.has(key))
      issues.push({ id: n.id, message: "같은 종류의 이름이 중복되었습니다." });
    seen.add(key);
  }
  return issues;
}
function cidrContains(parent, child) {
  const parts = (v) => {
    const [ip, bits] = v.split("/");
    return [
      ip.split(".").reduce((a, n) => ((a << 8) >>> 0) + Number(n), 0) >>> 0,
      Number(bits),
    ];
  };
  const [p, prefix] = parts(parent),
    [c, childPrefix] = parts(child);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return childPrefix >= prefix && (p & mask) >>> 0 === (c & mask) >>> 0;
}
function validCIDR(v) {
  const m =
    typeof v === "string" && v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/);
  return (
    !!m && m.slice(1, 5).every((x) => Number(x) <= 255) && Number(m[5]) <= 32
  );
}
// Explicit subnet components in the editable architecture model use IPv4.
const subnetNetworks = new Map([
  ["aws_subnet", "vpc"],
  ["azurerm_subnet", "network"],
  ["google_compute_subnetwork", "network"],
]);
function subnetConflicts(nodes, incoming) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const byAddress = new Map(
    nodes.filter((n) => n.address).map((n) => [n.address, n]),
  );
  const groups = new Map();
  const conflicts = [];
  for (const node of nodes) {
    const ref = subnetNetworks.get(node.kind);
    if (!ref || node.address?.startsWith("data.")) continue;
    const parent = node.imported
      ? byAddress.get(node.scopeAddress)
      : byId.get(node.props[ref]);
    if (!parent || parent.multipleInstances) continue;
    const ranges =
      node.imported && node.kind === "azurerm_subnet"
        ? node.subnetPrefixes || []
        : [node.props.cidr];
    const group = groups.get(parent.id) || [];
    for (const range of ranges.filter(validCIDR)) {
      for (const other of group) {
        if (
          node.id === other.node.id ||
          (incoming && !incoming.has(node.id) && !incoming.has(other.node.id))
        )
          continue;
        if (
          cidrContains(range, other.range) ||
          cidrContains(other.range, range)
        ) {
          const message =
            parent.label +
            " · CIDR 충돌: " +
            other.node.label +
            " (" +
            other.range +
            ") / " +
            node.label +
            " (" +
            range +
            ")";
          conflicts.push({ id: node.id, otherId: other.node.id, message });
        }
      }
      group.push({ node, range });
    }
    groups.set(parent.id, group);
  }
  return conflicts;
}
export function fragmentIssues(existing, incoming) {
  const issues = new Set();
  const previous = existing.slice();
  const all = [...existing, ...incoming];
  for (const node of incoming) {
    const owner = subnetNetworks.get(node.kind);
    const parent = owner && all.find((n) => n.id === node.props[owner]);
    for (const [field, value] of Object.entries(node.props)) {
      if (COMPONENTS[node.kind]?.fields[field]?.cidr && !validCIDR(value))
        issues.add(node.label + " · " + field + " IPv4 CIDR을 확인하세요.");
    }
    if (
      parent?.props.cidr &&
      validCIDR(parent.props.cidr) &&
      validCIDR(node.props.cidr) &&
      !cidrContains(parent.props.cidr, node.props.cidr)
    )
      issues.add(
        node.label +
          " · " +
          node.props.cidr +
          "은 " +
          parent.label +
          " 대역 밖입니다.",
      );
    if (
      node.kind === "avm_virtual_network" &&
      validCIDR(node.props.cidr) &&
      validCIDR(node.props.subnet_cidr) &&
      !cidrContains(node.props.cidr, node.props.subnet_cidr)
    )
      issues.add(node.label + " · 서브넷이 VNet 대역 밖입니다.");
    for (const other of previous) {
      if (other.kind !== node.kind) continue;
      if (owner && (!parent || other.props[owner] !== parent.id)) continue;
      if (
        node.props.name &&
        other.props.name === node.props.name &&
        (other.props.namespace || "") === (node.props.namespace || "")
      )
        issues.add(
          node.label + " · 같은 종류의 배포 이름 중복: " + node.props.name,
        );
    }
    if (!node.label.trim() || ("name" in node.props && !node.props.name.trim()))
      issues.add("표시 이름과 배포 이름을 입력하세요.");
    previous.push(node);
  }
  for (const conflict of subnetConflicts(all, new Set(incoming.map(n => n.id)))) issues.add(conflict.message);
  return [...issues];
}

/** @returns {{files: Record<string,string>, errors: string[], warnings: string[]}} */
export function generateArchitecture(m, format = "all", ids = []) {
  validateArchitecture(m);
  if (
    !["all", "terraform", "cloudformation", "manifest", "helm"].includes(format)
  )
    throw Error("지원하지 않는 추출 형식입니다.");
  const selected = subset(m, ids),
    wantTF = ["all", "terraform"].includes(format),
    wantK = ["all", "manifest", "helm"].includes(format);
  const nodes = selected.filter((n) =>
      format === "cloudformation"
        ? n.kind.startsWith("aws_") && !n.imported
        : n.kind.startsWith("k8s_")
          ? wantK
          : wantTF,
    ),
    issues = architectureIssues({ ...m, nodes: m.nodes }).filter((i) =>
      nodes.some((n) => n.id === i.id),
    );
  if (issues.length)
    return {
      files: {},
      errors: issues.map(
        (i) =>
          (m.nodes.find((n) => n.id === i.id)?.label || i.id) +
          ": " +
          i.message,
      ),
      warnings: [],
    };
  /** @type {Record<string,string>} */
  const files = {},
    warnings = [...m.warnings];
  if (m.drawing) {
    files["aws-drawing.svg"] = drawingSVG(m.drawing);
    warnings.push(
      "AWS 드로잉은 시각 문서입니다. 계정·서비스·방향선은 배포 코드에 포함되지 않습니다.",
    );
  }
  const skipped = selected.length - nodes.length;
  if (skipped)
    warnings.push(
      `${skipped}개 컴포넌트는 선택한 형식에 포함되지 않습니다. 전체 묶음을 선택하면 함께 추출됩니다.`,
    );
  const get = (id) => m.nodes.find((n) => n.id === id);
  const address = (n) => n.address || n.kind + "." + n.id;
  const expr = (n, key = "id") => "${" + address(n) + "." + key + "}";
  const r = {};
  const put = (kind, id, props) => {
    (r[kind] ??= {})[id] = props;
  };
  const lit = (v) => literal(v ?? "");
  const clouds = nodes.filter((n) => !n.kind.startsWith("k8s_") && !n.imported);
  if (wantTF && m.sources.length && clouds.length)
    return {
      files: {},
      errors: [
        "가져온 Terraform 원본과 새 클라우드 구성은 별도 아키텍처 노트에서 관리하세요. 원본의 provider·변수와 중복되는 설정을 자동 병합하지 않습니다.",
      ],
      warnings,
    };
  if (wantTF && nodes.some((n) => n.imported)) {
    for (const f of m.sources) files["terraform/" + f.name] = f.content;
    const overrides = {};
    for (const n of m.nodes.filter((n) => n.imported)) {
      for (const [key, value] of Object.entries(n.props)) {
        if (value === n.original[key]) continue;
        const attr = IMPORT_FIELDS[n.kind]?.[key];
        if (!attr || n.address.startsWith("data.")) continue;
        const [type, name] = n.address.split(".");
        ((overrides[type] ??= {})[name] ??= {})[attr] = lit(value);
      }
    }
    if (Object.keys(overrides).length) {
      if (
        m.sources.some(
          (f) =>
            f.name === "zz_xdocs_override.tf.json" ||
            /(?:^|_)override\.tf(?:\.json)?$/.test(f.name),
        )
      )
        return {
          files: {},
          errors: [
            "기존 override 파일이 있어 속성 변경을 병합할 수 없습니다. 원본 속성으로 되돌리거나 원본에서 수정해 다시 가져오세요.",
          ],
          warnings,
        };
      files["terraform/zz_xdocs_override.tf.json"] = json({
        resource: overrides,
      });
    }
    warnings.push(
      "가져온 Terraform은 선택 범위와 관계없이 원본 파일 전체를 보존합니다. 모듈·변수·데이터 소스를 평가하거나 내려받지 않습니다.",
    );
  }
  if (wantTF && clouds.length) {
    const modules = {};
    const groups = new Set(clouds.map((n) => COMPONENTS[n.kind].group)),
      providers = {},
      required = {},
      variables = {};
    if (groups.has("AWS")) {
      required.aws = { source: "hashicorp/aws", version: "~> 6.0" };
      providers.aws = { region: lit(m.settings.aws_region) };
    }
    if (groups.has("Azure") || groups.has("Azure AVM")) {
      required.azurerm = { source: "hashicorp/azurerm", version: "~> 4.0" };
      providers.azurerm = {
        features: [{}],
        subscription_id: "${var.azure_subscription_id}",
      };
      variables.azure_subscription_id = {
        type: "string",
        description: "Azure subscription ID",
      };
    }
    if (groups.has("GCP")) {
      required.google = { source: "hashicorp/google", version: "~> 7.0" };
      providers.google = {
        project: "${var.gcp_project_id}",
        region: lit(m.settings.gcp_region),
      };
      variables.gcp_project_id = {
        type: "string",
        description: "Google Cloud project ID",
      };
    }
    if (groups.has("Azure AVM")) {
      required.azapi = { source: "Azure/azapi", version: "~> 2.12" };
      providers.azapi = { subscription_id: "${var.azure_subscription_id}" };
    }
    for (const n of clouds) {
      const p = n.props,
        t = { Name: lit(p.name) },
        parent = Object.values(COMPONENTS[n.kind].fields).some((f) => f.ref)
          ? get(
              Object.entries(COMPONENTS[n.kind].fields).find(
                ([, f]) => f.ref,
              )?.[0] &&
                p[
                  Object.entries(COMPONENTS[n.kind].fields).find(
                    ([, f]) => f.ref,
                  )[0]
                ],
            )
          : null;
      if (AVM_MODULES[n.kind]) {
        const base = {
          ...AVM_MODULES[n.kind],
          name: lit(p.name),
          enable_telemetry: false,
        };
        if (n.kind === "avm_resource_group")
          modules[n.id] = { ...base, location: lit(p.location) };
        if (n.kind === "avm_virtual_network")
          modules[n.id] = {
            ...base,
            location: "${module." + parent.id + ".location}",
            parent_id: "${module." + parent.id + ".resource_id}",
            address_space: [p.cidr],
            subnets: {
              private: {
                name: "private-endpoints",
                address_prefixes: [p.subnet_cidr],
                private_endpoint_network_policies: "Disabled",
                default_outbound_access_enabled: false,
              },
            },
          };
        if (n.kind === "avm_storage_account") {
          const group = get(parent.props.group),
            groupName = "${module." + group.id + ".name}";
          modules[n.id] = {
            ...base,
            location: "${module." + group.id + ".location}",
            parent_id: "${module." + group.id + ".resource_id}",
            account_sku_name: p.sku,
            public_network_access_enabled: false,
            shared_access_key_enabled: false,
            https_traffic_only_enabled: true,
            min_tls_version: "TLS1_2",
            private_endpoints: {
              blob: {
                name: lit(p.name) + "-blob",
                subresource_name: "blob",
                subnet_resource_id:
                  "${module." + parent.id + '.subnets["private"].resource_id}',
                private_dns_zone_resource_ids: [
                  "${azurerm_private_dns_zone." + group.id + ".id}",
                ],
              },
            },
          };
          put("azurerm_private_dns_zone", group.id, {
            name: "privatelink.blob.core.windows.net",
            resource_group_name: groupName,
          });
          put("azurerm_private_dns_zone_virtual_network_link", parent.id, {
            name: lit(parent.props.name) + "-blob",
            resource_group_name: groupName,
            private_dns_zone_name:
              "${azurerm_private_dns_zone." + group.id + ".name}",
            virtual_network_id: "${module." + parent.id + ".resource_id}",
          });
        }
        continue;
      }
      switch (n.kind) {
        case "aws_route_table":
          put(n.kind,n.id,{vpc_id:expr(parent),tags:t});break;
        case "azurerm_network_security_group":
          put(n.kind,n.id,{name:lit(p.name),resource_group_name:expr(parent,"name"),location:expr(parent,"location")});break;
        case "google_compute_router":
          put(n.kind,n.id,{name:lit(p.name),network:expr(parent),region:lit(m.settings.gcp_region)});break;
        case "aws_vpc":
          put(n.kind, n.id, {
            cidr_block: p.cidr,
            enable_dns_hostnames: true,
            tags: t,
          });
          break;
        case "aws_subnet":
          put(n.kind, n.id, {
            vpc_id: expr(parent),
            cidr_block: p.cidr,
            map_public_ip_on_launch: false,
            tags: t,
          });
          break;
        case "aws_instance":
          if (!p.ami)
            variables["ami_" + n.id] = {
              type: "string",
              description: "AMI ID for " + n.label,
            };
          put(n.kind, n.id, {
            ami: p.ami ? lit(p.ami) : "${var.ami_" + n.id + "}",
            instance_type: lit(p.instance_type),
            subnet_id: expr(parent),
            associate_public_ip_address: false,
            metadata_options: [{ http_tokens: "required" }],
            root_block_device: [{ encrypted: true }],
            tags: t,
          });
          break;
        case "aws_s3_bucket":
          put(n.kind, n.id, { bucket: lit(p.name), force_destroy: false });
          put("aws_s3_bucket_public_access_block", n.id, {
            bucket: expr(n),
            block_public_acls: true,
            block_public_policy: true,
            ignore_public_acls: true,
            restrict_public_buckets: true,
          });
          break;
        case "azurerm_resource_group":
          put(n.kind, n.id, { name: lit(p.name), location: lit(p.location) });
          break;
        case "azurerm_virtual_network":
          put(n.kind, n.id, {
            name: lit(p.name),
            location: expr(parent, "location"),
            resource_group_name: expr(parent, "name"),
            address_space: [p.cidr],
          });
          break;
        case "azurerm_subnet":
          put(n.kind, n.id, {
            name: lit(p.name),
            virtual_network_name: expr(parent, "name"),
            resource_group_name: expr(parent, "resource_group_name"),
            address_prefixes: [p.cidr],
          });
          break;
        case "azurerm_storage_account":
          put(n.kind, n.id, {
            name: lit(p.name),
            location: expr(parent, "location"),
            resource_group_name: expr(parent, "name"),
            account_tier: "Standard",
            account_replication_type: "LRS",
            min_tls_version: "TLS1_2",
            allow_nested_items_to_be_public: false,
          });
          break;
        case "azurerm_linux_virtual_machine": {
          const network = get(parent.props.network),
            group = get(network.props.group);
          put("azurerm_network_interface", n.id, {
            name: lit(p.name) + "-nic",
            location: expr(group, "location"),
            resource_group_name: expr(group, "name"),
            ip_configuration: [
              {
                name: "private",
                subnet_id: expr(parent),
                private_ip_address_allocation: "Dynamic",
              },
            ],
          });
          put(n.kind, n.id, {
            name: lit(p.name),
            location: expr(group, "location"),
            resource_group_name: expr(group, "name"),
            size: lit(p.size),
            admin_username: lit(p.username),
            disable_password_authentication: true,
            network_interface_ids: [
              "${azurerm_network_interface." + n.id + ".id}",
            ],
            admin_ssh_key: [
              { username: lit(p.username), public_key: lit(p.ssh_key) },
            ],
            os_disk: [
              { caching: "ReadWrite", storage_account_type: "Standard_LRS" },
            ],
            source_image_reference: [
              {
                publisher: "Canonical",
                offer: "0001-com-ubuntu-server-jammy",
                sku: "22_04-lts-gen2",
                version: "latest",
              },
            ],
          });
          break;
        }
        case "google_compute_network":
          put(n.kind, n.id, {
            name: lit(p.name),
            auto_create_subnetworks: false,
          });
          break;
        case "google_compute_subnetwork":
          put(n.kind, n.id, {
            name: lit(p.name),
            network: expr(parent),
            ip_cidr_range: p.cidr,
            region: lit(m.settings.gcp_region),
            private_ip_google_access: true,
          });
          break;
        case "google_compute_instance":
          put(n.kind, n.id, {
            name: lit(p.name),
            machine_type: lit(p.machine_type),
            zone: lit(p.zone),
            boot_disk: [{ initialize_params: [{ image: lit(p.image) }] }],
            network_interface: [{ subnetwork: expr(parent) }],
            metadata: { "enable-oslogin": "TRUE" },
          });
          break;
        case "google_storage_bucket":
          put(n.kind, n.id, {
            name: lit(p.name),
            location: lit(p.location),
            uniform_bucket_level_access: true,
            public_access_prevention: "enforced",
            force_destroy: false,
          });
          break;
      }
    }
    files["terraform/main.tf.json"] = json({
      terraform: {
        required_version: groups.has("Azure AVM")
          ? ">= 1.10.0, < 2.0"
          : ">= 1.5.0",
        required_providers: required,
      },
      provider: providers,
      ...(Object.keys(variables).length ? { variable: variables } : {}),
      resource: r,
      ...(Object.keys(modules).length ? { module: modules } : {}),
    });
    files["terraform/terraform.tfvars.example"] =
      Object.keys(variables)
        .map(
          (k) =>
            k +
            " = " +
            JSON.stringify(
              k.startsWith("ami_")
                ? "YOUR_AMI_ID"
                : k === "gcp_project_id"
                  ? m.settings.gcp_project || "YOUR_PROJECT_ID"
                  : m.settings.azure_subscription || "YOUR_SUBSCRIPTION_ID",
            ),
        )
        .join("\n") + "\n";
  }
  if (["all", "cloudformation"].includes(format)) {
    const aws = nodes.filter((n) => n.kind.startsWith("aws_") && !n.imported),
      Resources = {},
      Parameters = {};
    const logical = (n) => "R" + n.id.replaceAll("_", ""),
      ref = (n) => ({ Ref: logical(n) });
    for (const n of aws) {
      const p = n.props;
      let resource;
      const Tags = [{ Key: "Name", Value: p.name }];
      switch (n.kind) {
        case "aws_route_table":resource={Type:"AWS::EC2::RouteTable",Properties:{VpcId:ref(get(p.vpc)),Tags}};break;
        case "aws_vpc":
          resource = {
            Type: "AWS::EC2::VPC",
            Properties: {
              CidrBlock: p.cidr,
              EnableDnsSupport: true,
              EnableDnsHostnames: true,
              Tags,
            },
          };
          break;
        case "aws_subnet":
          resource = {
            Type: "AWS::EC2::Subnet",
            Properties: {
              VpcId: ref(get(p.vpc)),
              CidrBlock: p.cidr,
              MapPublicIpOnLaunch: false,
              Tags,
            },
          };
          break;
        case "aws_instance":
          if (!p.ami)
            Parameters["Ami" + logical(n)] = { Type: "AWS::EC2::Image::Id" };
          resource = {
            Type: "AWS::EC2::Instance",
            Properties: {
              ImageId: p.ami || { Ref: "Ami" + logical(n) },
              InstanceType: p.instance_type,
              SubnetId: ref(get(p.subnet)),
              MetadataOptions: { HttpTokens: "required" },
              Tags,
            },
          };
          break;
        case "aws_s3_bucket":
          resource = {
            Type: "AWS::S3::Bucket",
            DeletionPolicy: "Retain",
            UpdateReplacePolicy: "Retain",
            Properties: {
              BucketName: p.name,
              PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                BlockPublicPolicy: true,
                IgnorePublicAcls: true,
                RestrictPublicBuckets: true,
              },
              BucketEncryption: {
                ServerSideEncryptionConfiguration: [
                  { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } },
                ],
              },
              OwnershipControls: {
                Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }],
              },
            },
          };
          break;
      }
      if (resource) Resources[logical(n)] = resource;
    }
    if (aws.length) {
      files["cloudformation/template.json"] = json({
        AWSTemplateFormatVersion: "2010-09-09",
        Description: "Architecture designed in xdocs",
        ...(Object.keys(Parameters).length ? { Parameters } : {}),
        Resources,
      });
      warnings.push(
        "동일 AWS 리소스에는 Terraform 또는 CloudFormation 중 하나만 사용하세요. CloudFormation의 AMI·EBS 암호화·IAM·Security Group·스택 실행 Region은 배포 전 검토가 필요합니다. S3는 스택 삭제·교체 시 보존됩니다.",
      );
    }
  }
  const docs = {};
  function namespace(n) {
    if (n.kind === "k8s_namespace") return n.props.name;
    const f = Object.entries(COMPONENTS[n.kind].fields).find(([, f]) => f.ref);
    return namespace(get(n.props[f[0]]));
  }
  for (const n of nodes.filter((n) => n.kind.startsWith("k8s_"))) {
    const p = n.props,
      meta = {
        name: p.name,
        ...(n.kind === "k8s_namespace" ? {} : { namespace: namespace(n) }),
      };
    let d;
    switch (n.kind) {
      case "k8s_namespace":
        d = { apiVersion: "v1", kind: "Namespace", metadata: meta };
        break;
      case "k8s_deployment": {
        const labels = { "app.kubernetes.io/name": p.name };
        d = {
          apiVersion: "apps/v1",
          kind: "Deployment",
          metadata: meta,
          spec: {
            replicas: Number(p.replicas),
            selector: { matchLabels: labels },
            template: {
              metadata: { labels },
              spec: {
                containers: [
                  {
                    name: p.name,
                    image: p.image,
                    ports: [{ containerPort: Number(p.port) }],
                  },
                ],
              },
            },
          },
        };
        break;
      }
      case "k8s_service": {
        const dep = get(p.deployment);
        d = {
          apiVersion: "v1",
          kind: "Service",
          metadata: meta,
          spec: {
            type: "ClusterIP",
            selector: { "app.kubernetes.io/name": dep.props.name },
            ports: [
              {
                port: Number(p.port),
                targetPort: Number(dep.props.port),
                protocol: "TCP",
              },
            ],
          },
        };
        break;
      }
      case "k8s_ingress": {
        const s = get(p.service);
        d = {
          apiVersion: "networking.k8s.io/v1",
          kind: "Ingress",
          metadata: meta,
          spec: {
            ingressClassName: p.class,
            rules: [
              {
                host: p.host,
                http: {
                  paths: [
                    {
                      path: "/",
                      pathType: "Prefix",
                      backend: {
                        service: {
                          name: s.props.name,
                          port: { number: Number(s.props.port) },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        };
        break;
      }
      case "k8s_configmap":
        d = {
          apiVersion: "v1",
          kind: "ConfigMap",
          metadata: meta,
          data: JSON.parse(p.data),
        };
        break;
      case "k8s_pvc":
        d = {
          apiVersion: "v1",
          kind: "PersistentVolumeClaim",
          metadata: meta,
          spec: {
            accessModes: ["ReadWriteOnce"],
            resources: { requests: { storage: p.storage } },
            ...(p.storage_class ? { storageClassName: p.storage_class } : {}),
          },
        };
        break;
    }
    docs[n.id] = d;
    if (["all", "manifest"].includes(format))
      files["manifests/" + n.id + ".yaml"] = yaml(d);
  }
  if (["all", "helm"].includes(format) && Object.keys(docs).length) {
    files["chart/Chart.yaml"] = yaml({
      apiVersion: "v2",
      name: "xdocs-architecture",
      description: "Architecture designed in xdocs",
      type: "application",
      version: "0.1.0",
      appVersion: "1.0.0",
    });
    files["chart/values.yaml"] = yaml({ resources: docs });
    files["chart/templates/resources.yaml"] =
      "{{- range $id, $resource := .Values.resources }}\n---\n{{ toYaml $resource }}\n{{- end }}\n";
  }
  if (!Object.keys(files).length)
    return {
      files,
      errors: ["선택한 형식으로 추출할 컴포넌트가 없습니다."],
      warnings,
    };
  files["architecture.json"] = json(m);
  files["architecture.svg"] = boundarySVG(m);
  if (m.caseStudyId && caseDiagram(m)) files["case-study.svg"] = caseDiagram(m);
  files["references.svg"] = architectureSVG(m);
  files["WELL_ARCHITECTED.md"] =
    "# 설계 검토\n\nAVM 사용은 WAF 인증이나 전체 워크로드 준수를 의미하지 않습니다. 자동 점수·합격 판정을 하지 않습니다.\n\n" +
    architectureReview(m)
      .map(
        (p) =>
          "## " +
          p.label +
          "\n\n" +
          p.prompt +
          "\n\n" +
          p.observations.join("\n") +
          "\n\n검토 기록: " +
          (p.note || "미작성") +
          "\n",
      )
      .join("\n");
  files["README.md"] =
    "# " +
    m.title.replace(/[\r\n]/g, " ") +
    "\n\nGenerated by xdocs IaCD. No deployment was performed.\n\n- Terraform: cd terraform; terraform init; terraform validate; terraform plan\n- Copy terraform.tfvars.example to terraform.tfvars and fill account IDs if generated. Use your normal credential chain.\n- Kubernetes: kubectl apply --dry-run=server -f manifests/ (requires a test cluster)\n- Helm: helm lint chart; helm template xdocs chart\n- CloudFormation: cfn-lint cloudformation/template.json; select stack region and inspect a change set before deployment. Never manage the same AWS resources with both Terraform and CloudFormation.\n- Choose manifests OR Helm for the same Kubernetes resources; do not deploy both. Review namespace ownership, Ingress controller, TLS, quotas, networking, IAM, images and storage classes.\n- JSON .tf.json is native Terraform configuration. Imported source files retain their original text except for explicitly reassigned placement references. Scalar edits use zz_xdocs_override.tf.json.\n- Included local module configurations retain their relative paths; supply any other required module files. No state, tfvars or credentials are fetched. Imported source may contain secrets.\n\n" +
    warnings.map((w) => "- " + w).join("\n") +
    "\n";
  return { files, errors: [], warnings };
}
export function layoutArchitecture(m) {
  const groups = [
      ...new Set(m.nodes.map((n) => COMPONENTS[n.kind]?.group || "Terraform")),
    ],
    counts = {};
  return {
    ...m,
    nodes: m.nodes.map((n) => {
      const group = COMPONENTS[n.kind]?.group || "Terraform";
      const row = counts[group] || 0;
      counts[group] = row + 1;
      return { ...n, x: 60 + groups.indexOf(group) * 240, y: 60 + row * 140 };
    }),
  };
}
export function architectureConnection(a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    const sign = dx >= 0 ? 1 : -1,
      ax = a.x + (sign > 0 ? 180 : 0),
      ay = a.y + 39,
      bx = b.x + (sign > 0 ? 0 : 180),
      by = b.y + 39,
      bend = Math.max(30, Math.abs(bx - ax) / 2);
    return `M${ax},${ay} C${ax + sign * bend},${ay} ${bx - sign * bend},${by} ${bx},${by}`;
  }
  const sign = dy >= 0 ? 1 : -1,
    ax = a.x + 90,
    ay = a.y + (sign > 0 ? 78 : 0),
    bx = b.x + 90,
    by = b.y + (sign > 0 ? 0 : 78),
    bend = Math.max(30, Math.abs(by - ay) / 2);
  return `M${ax},${ay} C${ax},${ay + sign * bend} ${bx},${by - sign * bend} ${bx},${by}`;
}
export function architectureSVG(m) {
  const escape = (v) =>
    String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const width = Math.max(800, ...m.nodes.map((n) => n.x + 240)),
    height = Math.max(400, ...m.nodes.map((n) => n.y + 140));
  const lines = architectureEdges(m)
    .map((e) => {
      const a = m.nodes.find((n) => n.id === e.source),
        b = m.nodes.find((n) => n.id === e.target);
      return a && b
        ? `<path d="${architectureConnection(a, b)}" stroke="#888" fill="none" marker-end="url(#arrow)"/>`
        : "";
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${escape(m.title)}</title><rect width="100%" height="100%" fill="white"/><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="#888"/></marker></defs>${lines}${m.nodes.map((n) => `<g><rect x="${n.x}" y="${n.y}" width="180" height="78" rx="8" fill="#fafafa" stroke="#555"/><text x="${n.x + 12}" y="${n.y + 30}" font-family="sans-serif" font-size="12" fill="#222">${escape(n.label.slice(0, 24))}</text><text x="${n.x + 12}" y="${n.y + 53}" font-family="sans-serif" font-size="10" fill="#666">${escape(n.kind.slice(0, 28))}</text></g>`).join("")}</svg>`;
}
export function architectureExample() {
  const m = newArchitecture();
  m.title = "멀티클라우드 · 웹 서비스";
  let i = 0;
  for (const kind of [
    "aws_vpc",
    "aws_subnet",
    "aws_instance",
    "azurerm_resource_group",
    "azurerm_virtual_network",
    "azurerm_subnet",
    "google_compute_network",
    "google_compute_subnetwork",
    "google_compute_instance",
    "k8s_namespace",
    "k8s_deployment",
    "k8s_service",
    "k8s_ingress",
  ]) {
    const n = newComponent(
      kind,
      60 + (i % 3) * 250,
      60 + Math.floor(i / 3) * 140,
    );
    for (const [k, f] of Object.entries(COMPONENTS[kind].fields))
      if (f.ref) n.props[k] = m.nodes.find((n) => n.kind === f.ref)?.id || "";
    if (kind === "aws_instance") {
      n.label = "Application EC2";
      n.props.name = "application";
    }
    if (kind === "azurerm_subnet") n.label = "Azure Subnet";
    m.nodes.push(n);
    i++;
  }
  return layoutArchitecture(m);
}
