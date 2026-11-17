import { parseAllDocuments } from "yaml";
import {
  validateInfrastructure,
  INFRA_LIMITS,
} from "../shared/infrastructure.mjs";
const object = (v) => v && typeof v === "object" && !Array.isArray(v);
const string = (v) => (typeof v === "string" ? v.slice(0, 1000) : "");
const keys = (v) => (object(v) ? Object.keys(v) : []);
const array = (v) => (Array.isArray(v) ? v : []);
const actions = (v) =>
  array(v).filter((a) =>
    [
      "create",
      "read",
      "update",
      "delete",
      "no-op",
      "forget",
      "import",
    ].includes(a),
  );
const number = (v) => Number.isFinite(v) && v >= 0 && v <= 1e9;
const cluster = new Set([
  "Namespace",
  "Node",
  "PersistentVolume",
  "StorageClass",
  "CustomResourceDefinition",
  "ClusterRole",
  "ClusterRoleBinding",
  "MutatingWebhookConfiguration",
  "ValidatingWebhookConfiguration",
  "APIService",
  "PriorityClass",
]);
export function parseInfrastructure(raw, source = "infrastructure") {
  if (typeof raw !== "string" || Buffer.byteLength(raw) > 20 * 1024 * 1024)
    throw Error("입력 파일은 20 MB 이하만 지원합니다.");
  let documents;
  try {
    if (/^\s*[\[{]/.test(raw)) documents = [JSON.parse(raw)];
    else
      documents = parseAllDocuments(raw, {
        uniqueKeys: true,
        version: "1.2",
      }).map((doc) => {
        if (doc.errors.length || doc.warnings.length) throw Error("invalid");
        return doc.toJS({ maxAliasCount: 30 });
      });
  } catch {
    throw Error(
      "JSON/YAML을 읽을 수 없습니다. 문법·중복 키·별칭을 확인해 주세요. 원문은 기록하지 않았습니다.",
    );
  }
  const active = new WeakSet();
  let visited = 0;
  function check(value, depth = 0) {
    if (++visited > 500000 || depth > 64)
      throw Error("문서 구조가 너무 크거나 깊습니다.");
    if (!value || typeof value !== "object") return;
    if (active.has(value)) throw Error("순환 YAML 별칭은 지원하지 않습니다.");
    active.add(value);
    for (const item of Object.values(value)) check(item, depth + 1);
    active.delete(value);
  }
  documents.forEach((v) => check(v));
  const resources = new Map(),
    warnings = [];
  const add = (
    id,
    kind,
    name,
    scope,
    properties = {},
    dependencies = [],
    planned = [],
  ) => {
    if (!id || resources.has(id))
      throw Error("리소스 식별자가 없거나 중복되었습니다.");
    if (resources.size >= INFRA_LIMITS.resources)
      throw Error("리소스는 5,000개 이하만 지원합니다.");
    const r = {
      id: string(id),
      kind: string(kind),
      name: string(name),
      scope: string(scope),
      properties,
      dependencies: dependencies.map(string),
      actions: actions(planned),
    };
    resources.set(id, r);
    return r;
  };
  const first = documents[0];
  let format;
  if (
    documents.length === 1 &&
    object(first) &&
    (first.format_version ||
      first.resource ||
      first.configuration ||
      first.planned_values ||
      first.values)
  ) {
    format = "terraform";
    if (
      first.format_version &&
      String(first.format_version).split(".")[0] !== "1"
    )
      throw Error("지원하지 않는 Terraform/OpenTofu JSON 주 버전입니다.");
    const safeKeys = [
      "instance_type",
      "engine",
      "engine_version",
      "region",
      "availability_zone",
      "cidr_block",
      "port",
      "replicas",
    ];
    const safeProperties = (values, sensitive) => {
      const p = {};
      for (const k of safeKeys) {
        if (sensitive === true || sensitive?.[k]) continue;
        const v = values?.[k];
        if (
          (typeof v === "number" && Number.isFinite(v)) ||
          typeof v === "boolean" ||
          (typeof v === "string" && /^[A-Za-z0-9._:/-]{1,100}$/.test(v))
        )
          p[k] = v;
      }
      return p;
    };
    function moduleValues(module) {
      for (const r of array(module?.resources))
        add(
          r.address,
          r.type,
          r.name,
          r.address?.match(/^(.*)\.[^.]+\.[^.]+$/)?.[1] || "root",
          safeProperties(r.values, r.sensitive_values),
          array(r.depends_on),
        );
      for (const m of array(module?.child_modules)) moduleValues(m);
    }
    moduleValues(
      first.planned_values?.root_module || first.values?.root_module,
    );
    for (const r of array(first.resource_changes)) {
      const values = r.change?.after || r.change?.before;
      const record =
        resources.get(r.address) ||
        add(
          r.address,
          r.type,
          r.name,
          r.module_address || "root",
          safeProperties(
            values,
            r.change?.after
              ? r.change?.after_sensitive
              : r.change?.before_sensitive,
          ),
        );
      record.properties = safeProperties(
        values,
        r.change?.after
          ? r.change?.after_sensitive
          : r.change?.before_sensitive,
      );
      record.actions = actions(r.change?.actions);
    }
    function references(value, out = []) {
      if (!value || typeof value !== "object") return out;
      for (const [k, v] of Object.entries(value)) {
        if (k === "references")
          out.push(...array(v).filter((v) => typeof v === "string"));
        else references(v, out);
      }
      return out;
    }
    const pending = [];
    function config(module, prefix = "") {
      for (const r of array(module?.resources)) {
        const id = prefix + r.address;
        const record =
          resources.get(id) || add(id, r.type, r.name, prefix || "root");
        pending.push([
          record,
          references(r.expressions).concat(array(r.depends_on)),
          prefix,
        ]);
      }
      for (const [name, call] of Object.entries(module?.module_calls || {}))
        config(call.module, prefix + "module." + name + ".");
    }
    config(first.configuration?.root_module || first.root_module);
    for (const [kind, names] of Object.entries(first.resource || {}))
      for (const [name, config] of Object.entries(names)) {
        const record = add(kind + "." + name, kind, name, "root");
        pending.push([record, array(config?.depends_on), ""]);
      }
    for (const [record, refs, prefix] of pending)
      for (const ref of refs) {
        const candidates = [prefix + ref, ref];
        const match = [...resources.keys()]
          .filter((id) =>
            candidates.some((r) => r === id || r.startsWith(id + ".")),
          )
          .sort((a, b) => b.length - a.length)[0];
        if (match && match !== record.id) record.dependencies.push(match);
      }
    warnings.push(
      "변수·출력·일반 속성값은 저장하지 않습니다. 명시적으로 허용한 속성과 의존 참조만 문서화합니다. HCL .tf 실행·평가와 provider 조회는 하지 않습니다.",
    );
  } else if (documents.length === 1 && object(first?.services)) {
    format = "compose";
    for (const category of ["networks", "volumes", "secrets", "configs"])
      for (const name of keys(first[category]))
        add(
          category.slice(0, -1) + ":" + name,
          category[0].toUpperCase() + category.slice(1, -1),
          name,
          "compose",
        );
    for (const [name, s] of Object.entries(first.services)) {
      if (!object(s)) throw Error("Compose 서비스 정의를 확인해 주세요.");
      const deps = (
        Array.isArray(s.depends_on) ? s.depends_on : keys(s.depends_on)
      ).map((d) => "service:" + d);
      const networks = s.networks
        ? Array.isArray(s.networks)
          ? s.networks
          : keys(s.networks)
        : s.network_mode
          ? []
          : ["default"];
      for (const n of networks) {
        if (!resources.has("network:" + n))
          add("network:" + n, "Network", n, "compose");
        deps.push("network:" + n);
      }
      for (const v of array(s.volumes)) {
        const name =
          typeof v === "string"
            ? v.split(":")[0]
            : v?.type === "volume"
              ? v.source
              : null;
        if (name && resources.has("volume:" + name))
          deps.push("volume:" + name);
      }
      for (const kind of ["secrets", "configs"])
        for (const item of array(s[kind])) {
          const name = typeof item === "string" ? item : item?.source;
          if (name) deps.push(kind.slice(0, -1) + ":" + name);
        }
      const props = {};
      if (number(s.deploy?.replicas)) props.replicas = s.deploy.replicas;
      const ports = array(s.ports)
        .map((p) =>
          typeof p === "number"
            ? String(p)
            : typeof p === "string"
              ? p
              : object(p)
                ? [p.published, p.target]
                    .filter((v) => v !== undefined)
                    .join(":")
                : "",
        )
        .filter((p) => /^[0-9.:[\]-]+(?:\/(?:tcp|udp|sctp))?$/.test(p));
      if (ports.length) props.ports = ports.join(", ").slice(0, 1000);
      add("service:" + name, "Service", name, "compose", props, deps);
    }
    warnings.push(
      "environment·env_file·명령·Secret/Config 내용·호스트 경로를 저장하거나 읽지 않습니다. 변수 치환·extends/include는 평가하지 않습니다.",
    );
  } else {
    format = "kubernetes";
    const objects = [];
    function collect(value) {
      if (Array.isArray(value)) value.forEach(collect);
      else if (value?.kind === "List") array(value.items).forEach(collect);
      else if (value) objects.push(value);
    }
    documents.forEach(collect);
    const idFor = (kind, name, namespace) =>
      kind +
      ":" +
      (cluster.has(kind) ? "cluster" : namespace || "default") +
      ":" +
      name;
    for (const r of objects) {
      if (!r?.apiVersion || !r?.kind || !r?.metadata?.name)
        throw Error(
          "지원하는 Terraform JSON, Kubernetes 매니페스트 또는 Compose 문서를 선택해 주세요.",
        );
      const ns = cluster.has(r.kind)
        ? "cluster"
        : r.metadata.namespace || "default";
      const props = {};
      if (r.kind !== "Secret" && r.kind !== "ConfigMap") {
        if (number(r.spec?.replicas)) props.replicas = r.spec.replicas;
        if (
          ["ClusterIP", "NodePort", "LoadBalancer", "ExternalName"].includes(
            r.spec?.type,
          )
        )
          props.serviceType = r.spec.type;
        const ports = array(r.spec?.ports)
          .map((p) => p.port)
          .filter(number);
        if (ports.length) props.ports = ports.join(", ");
      }
      add(
        idFor(r.kind, r.metadata.name, ns),
        r.kind,
        r.metadata.name,
        ns,
        props,
      );
    }
    for (const r of objects) {
      const ns = r.metadata.namespace || "default",
        record = resources.get(idFor(r.kind, r.metadata.name, ns));
      const depend = (kind, name) => {
        if (name) record.dependencies.push(idFor(kind, name, ns));
      };
      for (const owner of array(r.metadata.ownerReferences))
        depend(owner.kind, owner.name);
      const pod =
        r.kind === "Pod"
          ? r.spec
          : r.spec?.template?.spec || r.spec?.jobTemplate?.spec?.template?.spec;
      if (pod) {
        depend("ServiceAccount", pod.serviceAccountName);
        for (const v of array(pod.volumes)) {
          depend("Secret", v.secret?.secretName);
          depend("ConfigMap", v.configMap?.name);
          depend("PersistentVolumeClaim", v.persistentVolumeClaim?.claimName);
        }
        for (const c of [
          ...array(pod.containers),
          ...array(pod.initContainers),
        ]) {
          for (const e of array(c.env)) {
            depend("Secret", e.valueFrom?.secretKeyRef?.name);
            depend("ConfigMap", e.valueFrom?.configMapKeyRef?.name);
          }
          for (const e of array(c.envFrom)) {
            depend("Secret", e.secretRef?.name);
            depend("ConfigMap", e.configMapRef?.name);
          }
        }
      }
      if (r.kind === "Service" && keys(r.spec?.selector).length)
        for (const target of objects) {
          if ((target.metadata.namespace || "default") !== ns) continue;
          const labels =
            target.kind === "Pod"
              ? target.metadata.labels
              : target.spec?.template?.metadata?.labels;
          if (
            labels &&
            Object.entries(r.spec.selector).every(([k, v]) => labels[k] === v)
          )
            depend(target.kind, target.metadata.name);
        }
      if (r.kind === "Ingress") {
        depend("Service", r.spec?.defaultBackend?.service?.name);
        for (const rule of array(r.spec?.rules))
          for (const p of array(rule.http?.paths))
            depend("Service", p.backend?.service?.name);
      }
    }
    warnings.push(
      "Secret/ConfigMap 내용, 환경변수 값, annotation과 임의 spec/status를 저장하지 않습니다. 관계는 파일에 명시된 참조·Service selector 기준이며 실제 클러스터 상태는 아닙니다.",
    );
  }
  if (!resources.size)
    throw Error(
      "문서화할 리소스가 없습니다. 빈 파일 또는 지원하지 않는 구조입니다.",
    );
  for (const r of resources.values())
    r.dependencies = [
      ...new Set(r.dependencies.filter((d) => d && d !== r.id)),
    ].sort();
  return validateInfrastructure({
    version: 1,
    format,
    source,
    importedAt: new Date().toISOString(),
    resources: [...resources.values()].sort((a, b) => a.id.localeCompare(b.id)),
    warnings,
    notes: {},
  });
}
