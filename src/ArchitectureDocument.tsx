import {serviceGlyph} from "../shared/service-glyph.mjs";
import schemaChanges from "../shared/schema-changes.mjs";
import {declarationLines} from "../shared/declaration-lines.mjs";
import ResourceFields from "./ResourceFields";
import { compatibleFields, referenceTargets, resourceSchema, fieldProblems } from "../shared/resource-form.mjs";
import {networkCases} from "../shared/network-case-layouts.mjs";
import {firewallCase,firewallSteps} from "../shared/azure-firewall-path.mjs";
import {caseDiagram} from "../shared/case-diagrams.mjs";
import type {Note} from "./types";
import DesignFragments from "./DesignFragments";
import PlanReview, {type PlanRows} from "./PlanReview";
import {planNode,planModuleTarget} from "../shared/plan-review.mjs";
import ArchitectureImpact from "./ArchitectureImpact";
import TemplatePreview from "./TemplatePreview";
import catalogInspection from "../catalog/inspection.json";
import reviewedPaths from "../catalog/reviewed-paths.json";
import TemplateThumbnail from "./TemplateThumbnail";
import ModuleContractReview from "./ModuleContractReview";
import { terraformDeclarations } from "../shared/architecture-catalog.mjs";
import { cloudTemplates, openCloudTemplate } from "./cloudCatalog";
import CanvasSearch from "./CanvasSearch";
import {
  boundaryLayout,
  placementFields,
  indexedPlacementTarget,
} from "../shared/network-boundaries.mjs";
import { canPlace, reassignPlacement } from "../shared/placement-edit.mjs";
import { diffLines } from "diff";
import IacDiff from "./IacDiff";
import NetworkLayout from "./NetworkLayout";
import { AwsDrawing, type Drawing } from "./AwsDrawing";
import { backupDrawing, blankDrawing } from "../shared/aws-drawing.mjs";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Cloud,
  Plus,
  Upload,
  Download,
  Undo2,
  Redo2,
  Trash2,
  Link2,
  ZoomIn,
  ZoomOut,
  PanelLeft, PanelRight, LayoutGrid,
  Code2,
  ShieldCheck,
  X,
  Copy,
} from "lucide-react";
import {
  allComponents as COMPONENTS,
  catalogSettings, catalogVersions,
  terraformAddress,
  COMPONENTS as builtInComponents,
  AVM_MODULES,
  newArchitecture,
  newComponent,
  architectureExample,
  architectureEdges,
  architectureIssues,
  generateArchitecture,
  removeComponent,
  architectureReview,
  layoutArchitecture,
  architectureConnection,
} from "../shared/architecture.mjs";
import { zipSync, strToU8 } from "fflate";
import { api } from "./api";
function moduleDeclarationPreview(
  source: ArchitectureModel["sources"][number] | undefined,
  address: string,
) {
  if (!source) return "";
  if (source.name.endsWith(".json")) {
    const parts = address.split(".");
    const block = parts.length === 3 ? parts.shift()! : "resource";
    try {
      return JSON.stringify(
        JSON.parse(source.content)[block]?.[parts[0]]?.[parts[1]],
        null,
        2,
      );
    } catch {
      return source.name;
    }
  }
  const line = source.declarationLines?.[address];
  return line
    ? source.name +
        ":" +
        line +
        " · " +
        source.content.split("\n")[line - 1]?.trim()
    : source.name;
}
export type ArchitectureNode = {
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
  props: Record<string, string>;
  schemaFingerprint?:string;
  imported?: boolean;
  unresolvedReferences?:string[];
  sourceFile?: string;
  sourceLine?: number;
  address?: string;
  original?: Record<string, string>;
  references?: string[];
  placementSource?: {
    file: string;
    offset: number;
    address: string;
    otherRefs: string[];
  };
  scopeAddress?: string;
  nicAddress?: string;
  moduleTrace?: {
    address: string;
    file: string;
    expression: string;
    target?: string;
    targetFile?: string;
  };
  interfaceEvidence?: string[];
  placementUnknown?: boolean;
  placementValue?: string;
  locationScope?: string;
};
export type ArchitectureModel = {
  version: number;
  title: string;
  settings: Record<string, string>;
  nodes: ArchitectureNode[];
  sources: { name: string; content: string; preservedDeclarations?:string[]; declarationLines?:Record<string,number> }[];
  warnings: string[];
  caseStudyId?: string;
  drawing?: Drawing;
  presentation?: {
    folded?: string[];
    locked?: string[];
    annotations?: Record<string, string>;
    annotationLinks?: { source: string; target: string; label: string }[];
    crossings?: boolean;
    anchors?: Record<string, string>;
    routes?: Record<string, { x: number; y: number }>;
    resources?: boolean;
    refs?: boolean;
    notes?: boolean;
  };
  review?: Record<string, string>;
};
function ServiceIcon({kind,size}:{kind:string;size:number}) {
  return <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d={String(serviceGlyph(kind))}/></svg>;
}
const scenarios: Record<string, RegExp> = {
  "복구 · 백업": /복구|백업|failover|recovery|backup|disaster/i,
  "네트워크 격리": /격리|망 분리|스포크|isolat|private|사설|프라이빗|spoke/i,
  "공유 이그레스": /이그레스|egress|중앙.{0,8}NAT|shared.{0,8}NAT/i,
  "컨테이너 플랫폼": /kubernetes|컨테이너|eks|aks|gke/i,
  "데이터 분석": /분석|analytics|warehouse|lake|웨어하우스/i,
};
export function ArchitectureStart({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (m: ArchitectureModel, focusTemplate?: string) => Promise<void>;
}) {
  const [preview, setPreview] = useState<ArchitectureModel | null>(null),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState("AWS");
  const [templateId, setTemplateId] = useState(cloudTemplates[0].id);
  const [previewId,setPreviewId] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogMode, setCatalogMode] = useState("전체");
  const [scenario, setScenario] = useState("");
  const query = catalogSearch.trim().toLowerCase();
  const catalogModes = (cloud: string) => ["전체", ...["사례 설계", "컴포넌트 편집", "Terraform 원본"].filter(mode =>
    cloudTemplates.some(t => t.provider === cloud && templateMode(t) === mode))];
  function templateMode(t: typeof cloudTemplates[number]) {
    return "caseStudy" in t ? "사례 설계" : "repo" in t ? "Terraform 원본" : "컴포넌트 편집";
  }
  const matchesScenario = (t: typeof cloudTemplates[number], name: string) =>
    scenarios[name].test([t.name, t.study, t.id, ...t.kinds].join(" "));
  const availableScenarios = (cloud: string) => Object.keys(scenarios).filter(name =>
    cloudTemplates.some(t => t.provider === cloud && matchesScenario(t, name)));
  const matches = cloudTemplates.filter(
    (t) =>
      t.provider === provider &&
      (!scenario || matchesScenario(t, scenario)) &&
      (catalogMode === "전체" || catalogMode === templateMode(t)) &&
      (!query ||
        [t.name, t.study, t.id, ...t.kinds].some((v) =>
          (v + " " + (COMPONENTS[v]?.label || "")).toLowerCase().includes(query),
        )),
  );
  const chosen = matches.find((t) => t.id === templateId) || matches[0];
  async function openChosen(id = chosen?.id, focus = false) {
    if (!id || busy) return;
    setBusy(true);
    setError("");
    try {
      await onCreate(await openCloudTemplate(id), focus ? id : undefined);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function importTerraform(project = false) {
    setBusy(true);
    setError("");
    try {
      const m = await api.importArchitecture!(project);
      if (m) {
        setPreview(m);
        setAccepted(false);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function create(m: ArchitectureModel) {
    setBusy(true);
    try {
      await onCreate(m);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay">
      <section
        className="dialog architecture-start"
        role="dialog"
        aria-label="xinfra 캔버스 만들기"
      >
        <header>
          <h2>xinfra · 아키텍처 설계</h2>
          <button aria-label="아키텍처 만들기 닫기" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="catalog-content">
        <p>구성 요소를 배치하고 연결해 코드와 문서를 함께 만드세요.</p>
        <div className="arch-start-options">
          <button
            className="button"
            disabled={busy}
            onClick={() => void create(newArchitecture())}
          >
            <Plus size={16} />빈 캔버스
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() => void create(architectureExample())}
          >
            <LayoutGrid size={16} />
            멀티클라우드 예제
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void create({
                ...newArchitecture(),
                title: "AWS · 계정 간 백업",
                drawing: backupDrawing() as Drawing,
              })
            }
          >
            <Cloud size={16} />
            AWS 백업 드로잉 예제
          </button>
          <button
            className="button"
            disabled={busy || !api.importArchitecture}
            onClick={() => void importTerraform()}
          >
            <Upload size={16} />
            Terraform 가져오기
          </button>
          <button
            className="button"
            disabled={busy || !api.importArchitecture}
            onClick={() => void importTerraform(true)}
          >
            로컬 모듈 포함 폴더 가져오기
          </button>
        </div>
        <fieldset disabled={busy} className="architecture-catalog">
          <legend>템플릿 카탈로그 · {matches.length}종</legend>
          <label className="catalog-field">
            <span>공급자</span>
            <select
              aria-label="공급자"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                if (scenario && !availableScenarios(e.target.value).includes(scenario)) setScenario("");
                if (!catalogModes(e.target.value).includes(catalogMode)) setCatalogMode("전체");
                setTemplateId(
                  cloudTemplates.find((t) => t.provider === e.target.value)!.id,
                );
              }}
            >
              {["AWS", "Azure", "GCP","멀티클라우드"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="catalog-field">
            <span>업무 시나리오</span>
            <select value={scenario} onChange={e => setScenario(e.target.value)}>
              <option value="">전체 시나리오</option>
              {availableScenarios(provider).map(name => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label className="catalog-field">
            <span>템플릿 검색</span>
            <input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="이름 또는 Terraform 리소스"
            />
          </label>
          <div className="catalog-modes" role="group" aria-label="템플릿 편집 방식">
            {catalogModes(provider).map((mode) => (
              <button key={mode} type="button" aria-pressed={catalogMode === mode}
                onClick={() => setCatalogMode(mode)}>{mode}</button>
            ))}
          </div>
          {matches.length > 0 && (
            <div className="template-gallery" role="group" aria-label="설계 템플릿">
              {matches.map(t => (
                <div key={t.id} className="template-card">
                <button type="button" className="template-select"
                  aria-label={t.name} aria-pressed={chosen?.id === t.id}
                  onClick={() => setTemplateId(t.id)}>
                  <TemplateThumbnail id={t.id} />
                  <strong>{t.name}</strong>
                  <small>{t.study}</small>
                </button>
                <button className="thumbnail-reference" onClick={() => void openChosen(t.id,true)}>참조 열기 · {reviewedPaths[t.id as keyof typeof reviewedPaths][0].join(" → ")}</button>
                </div>
              ))}
            </div>
          )}
          {chosen && <>
            <p className="catalog-study">{chosen.study}</p>
            <details><summary>필수 입력과 준비 사항</summary>
              <p>기본값 없는 루트 변수 · {catalogInspection[chosen.id as keyof typeof catalogInspection].inputs.join(", ") || "없음"}</p>
              {chosen.review?.operations && <p>{chosen.review.operations}</p>}
              {chosen.id === "efs-backup-copy" && <p>AWS Organizations에서 계정 간 백업을 활성화하고 대상 계정 역할, 백업 볼트 및 KMS 키 권한을 확인하세요.</p>}
              {chosen.id === "batch-parity" && <p>대상 프로젝트에서 BigQuery와 BigQuery Data Transfer API를 활성화하고 예약 쿼리 실행 권한을 확인하세요.</p>}
              {!chosen.review?.operations && <p>{chosen.provider} 배포 계정의 인증, 리전, 리소스 생성 권한을 확인하세요.</p>}
            </details>
            <button type="button" className="button" aria-expanded={previewId === chosen.id}
              onClick={() => setPreviewId(previewId === chosen.id ? "" : chosen.id)}>구성도 확대 미리보기</button>
            {previewId === chosen.id && <TemplatePreview key={chosen.id} template={chosen}/>}
          </>}
          {chosen?.review && <details><summary>운영 전제와 검증 방법</summary>
            <p>{chosen.review.operations}</p><p>{chosen.review.reliability}</p><p>{chosen.review.security}</p><p>{chosen.review.cost}</p><p>{chosen.review.performance}</p></details>}
          {chosen ? (
            <details>
              <summary>구성 리소스 {chosen.kinds.length}종</summary>
              <p>
                {chosen.kinds.map((k) => COMPONENTS[k]?.label || k).join(" · ")}
              </p>
            </details>
          ) : (
            <div className="catalog-empty" role="status">
              <p>일치하는 템플릿이 없습니다.</p>
              <button type="button" onClick={() => { setCatalogSearch(""); setCatalogMode("전체"); setScenario(""); }}>
                검색 조건 초기화
              </button>
            </div>
          )}
          {chosen && "repo" in chosen && (
            <small>
              Terraform 원본 기반 · {String(chosen.repo)} ·{" "}
              {"revision" in chosen && String(chosen.revision).slice(0, 7)}
            </small>
          )}
        </fieldset>

        <p className="muted small-text">
          AWS · Azure · Azure Verified Modules · GCP · Kubernetes. .tf와
          .tf.json 파일 선택은 데스크톱 앱에서 지원합니다.
        </p>
        {preview && (
          <section className="infra-preview">
            <h3>
              {preview.nodes.length}개 컴포넌트 · {preview.sources.length}개
              원본 파일
            </h3>
            <p>{preview.sources.map((f) => f.name).join(", ")}</p>
            <p>
              원본 설정·변수 기본값·주석도 노트에 보관합니다. 비밀정보를 먼저
              제거하세요. 조직 보관함에서는 원본도 동기화됩니다.
            </p>
            <label>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              원본 설정을 이 노트에 보관하는 것을 확인했습니다.
            </label>
            <p>
              <button
                className="button primary"
                disabled={!accepted || busy}
                onClick={() => void create(preview)}
              >
                다이어그램으로 가져오기
              </button>
            </p>
          </section>
        )}
        {error && <p role="alert">{error}</p>}
        </div>
        {!preview && <>
        <footer className="catalog-confirm">
          <strong>{chosen?.name}</strong>
          <button
            className="button primary"
            disabled={!chosen || busy}
            onClick={() => void openChosen()}
          >
            템플릿으로 시작
          </button>
        </footer>
        </>}
      </section>
    </div>
  );
}
export default function ArchitectureDocument({
  model,
  focusTemplate,focusResource,
  notes,saveFragment,saveReview,
  onChange,
  readonly = false,
}: {
  focusTemplate?: string;
  focusResource?:string;
  saveReview:(text:string)=>Promise<void>;
  notes:Note[]; saveFragment:(name:string,body:string)=>Promise<void>;
  model: ArchitectureModel;
  onChange: (m: ArchitectureModel) => void;
  readonly?: boolean;
}) {
  const [entry] = useState(() => {
    const key = focusTemplate as keyof typeof reviewedPaths;
    if (!Object.hasOwn(reviewedPaths, key)) return;
    const [a,b] = reviewedPaths[key][0].map(address => model.nodes.find(n => (n.address || n.label) === address));
    if (a && b) return {source:a.id, target:b.id, sites:catalogInspection[key].sites, label:reviewedPaths[key][0].join(" → ")};
  });
  const [pathFocus,setPathFocus] = useState(Boolean(entry));
  const [sitesOpen,setSitesOpen] = useState(false);
  const [site,setSite] = useState<{file:string;line:number;property:string}>();
  const [selected, setSelected] = useState(entry?.source || model.nodes[0]?.id || ""),
    [paletteOpen,setPaletteOpen] = useState(() => !window.matchMedia("(min-width: 801px) and (max-width: 1050px)").matches),
    [railOpen,setRailOpen] = useState(true),
    [codeOnly,setCodeOnly] = useState(false),
    [paletteQuery,setPaletteQuery] = useState(""),
    [group, setGroup] = useState<string>(() => {
      const groups = new Set<string>();
      for (const node of model.nodes) {
        const group = COMPONENTS[node.kind]?.group;
        if (group) groups.add(group === "Azure AVM" ? "Azure" : group);
      }
      return groups.size === 1 ? [...groups][0] : "전체";
    }),
    [paletteLimit, setPaletteLimit] = useState(50),
    [paletteMode, setPaletteMode] = useState("all"),
    [zoom, setZoom] = useState(1),
    [boundary, setBoundary] = useState(true),
    [caseView, setCaseView] = useState(Boolean(model.caseStudyId) && !entry),
    [viewScale, setViewScale] = useState<"fit" | "actual" | "selection" | "manual">("fit"),
    [tab, setTab] = useState(model.drawing ? "drawing" : "canvas"),
    [format, setFormat] = useState("all"),
    [only, setOnly] = useState(false),
    [file, setFile] = useState(""),
    [connecting, setConnecting] = useState(false),
    [refChoice,setRefChoice] = useState(""),
    [catalogService,setCatalogService] = useState(""),
    [cliReport,setCliReport] = useState<{model:ArchitectureModel;message:string;rows:{message:string;address:string;file:string;line:number}[]}>(),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const [drag, setDrag] = useState<{
    id: string;
    x: number;
    y: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [baseline, setBaseline] = useState(model),
    [comparison, setComparison] = useState(false),
    [customBase, setCustomBase] = useState(false);
  const undo = useRef<ArchitectureModel[]>([]),
    redo = useRef<ArchitectureModel[]>([]),
    [, rerender] = useState(0),
    viewport = useRef<HTMLDivElement>(null);
  const node = model.nodes.find((n) => n.id === selected),
    edges = architectureEdges(model),
    issues = useMemo(()=>[...architectureIssues(model),...model.nodes.flatMap(n=>{
      if(n.imported || !COMPONENTS[n.kind]?.generic) return [];
      const schema=resourceSchema(n.kind);
      try{return schema?fieldProblems(schema.fields,JSON.parse(n.props.arguments)).map((message:string)=>({id:n.id,message})):[];}catch{return [];}
    })],[model]);
  const migration = node && (schemaChanges.changes as Record<string,{from:string;added:string[];removed:string[];changed:string[]}>)[node.kind.startsWith("arm_")?"azapi_resource":node.kind];
  const selectedId = only ? node?.id : undefined;
  const result = useMemo(() => {
    try {
      return generateArchitecture(
        model,
        tab === "code" ? format : "terraform",
        tab === "code" && selectedId ? [selectedId] : [],
      );
    } catch (error) {
      return {
        files: {} as Record<string, string>,
        errors: [String(error)],
        warnings: [],
      };
    }
  }, [model, tab, format, selectedId]);
  const terraformFiles = Object.keys(result.files).filter((name) =>
    /\.tf(?:\.json)?$/.test(name),
  );
  const [planRows,setPlanRows]=useState<PlanRows>([]);
  const planLabels=useMemo(()=>{
    const labels:Record<string,string>={};
    for(const row of planRows){
      const id=planNode(row.address,model.nodes) || planModuleTarget(row,model)?.id;
      if(id && !labels[id]?.split(" · ").includes(row.action)) labels[id]=labels[id] ? labels[id]+" · "+row.action : row.action;
    }
    return labels;
  },[planRows,model.nodes]);
  const [moduleFocus,setModuleFocus] = useState<{file:string;address:string}|null>(null);
  const [liveFile, setLiveFile] = useState("");
  const livePath = terraformFiles.includes(liveFile)
    ? liveFile
    : terraformFiles[0];
  const [focusRelated, setFocusRelated] = useState(false);
  const neighbours = edges.filter(edge => edge.source === selected || edge.target === selected);
  const focused = pathFocus && entry && selected === entry.source && edges.some(e => e.source === entry.source && e.target === entry.target) ? entry : undefined;
  const focusIds = new Set(focused ? [focused.source, focused.target] : [selected, ...neighbours.flatMap(edge => [edge.source, edge.target])]);
  if ((focused || focusRelated) && node) {
    const { parents } = boundaryLayout(model);
    for (const id of focusIds) {
      const parent = parents.get(id);
      if (parent) focusIds.add(parent);
    }
  }
  const focusAttributes = ["data-scope", "data-boundary", "data-free-id", "data-resource"];
  const mutedSelector = (focused || focusRelated) && node
    ? model.nodes.filter(n => !focusIds.has(n.id)).flatMap(n =>
        focusAttributes.map(attr => `.arch-workspace [${attr}="${CSS.escape(n.id)}"]`)).join(",")
    : "";
  const openingModel = useRef(model);
  const targetNode = focused && model.nodes.find(n => n.id === focused.target);
  const targetAddress = targetNode && terraformAddress(targetNode);
  const sites = focused?.sites.filter(s => {
    const current = result.files["terraform/" + s.file];
    const original = openingModel.current.sources.find(f => f.name === s.file);
    return (!original || current === original.content) && targetAddress && current?.split("\n")[s.line-1]?.includes(targetAddress);
  }) || [];
  function jumpToSite(s: typeof sites[number]) {
    setSite(s); setLiveFile("terraform/" + s.file); setCompareFile(false);
    if (viewer.current) viewer.current.open = true;
    requestAnimationFrame(() => viewer.current?.querySelector("mark")?.scrollIntoView({block:"nearest"}));
  }
  function showSites() {
    setSitesOpen(true);
    if (sites.length === 1) jumpToSite(sites[0]);
  }
  const [compareFile, setCompareFile] = useState(false);
  const [impactOpen,setImpactOpen] = useState(false);
  const initialFiles = useMemo(() => compareFile || impactOpen ? generateArchitecture(openingModel.current, "terraform").files : {}, [compareFile,impactOpen]);
  const fileChanges = useMemo(() => {
    if (!compareFile || !livePath) return [];
    return diffLines(initialFiles[livePath] || "", result.files[livePath], { timeout: 150 });
  }, [compareFile, livePath, initialFiles, result.files]);
  const scopedNodes = useMemo(
    () =>
      model.nodes.filter((n) =>
        n.sourceFile
          ? "terraform/" + n.sourceFile === livePath
          : !livePath?.slice(10).includes("/"),
      ),
    [model.nodes, livePath],
  );
  const declarations: { id: string; address: string; block: unknown }[] =
    useMemo(
      () =>
        livePath?.endsWith(".tf.json")
          ? terraformDeclarations(result.files[livePath], scopedNodes)
          : scopedNodes
              .filter((n) => n.sourceFile && n.address)
              .map((n) => ({
                id: n.id,
                address: n.address!,
                block: n.sourceLine
                  ? n.sourceFile +
                    ":" +
                    n.sourceLine +
                    " · " +
                    ((model.caseStudyId === firewallCase || Object.hasOwn(networkCases, model.caseStudyId || ""))
                      ? result.files[livePath].split("\n").slice(n.sourceLine - 1).join("\n").match(/^[^]*?^\}[ \t]*$/m)?.[0]
                      : result.files[livePath]?.split("\n")[n.sourceLine - 1])
                  : n.sourceFile,
              })),
      [result.files, livePath, scopedNodes, model.caseStudyId],
    );
  const lineNodes = useMemo(()=>declarationLines(result.files[livePath]||"",livePath,scopedNodes),[result.files,livePath,scopedNodes]);
  const codeLines=useMemo(()=>{
    const lines=(result.files[livePath]||"").split("\n");
    const parts:(string|{number:number;id:string;line:string})[]=[];
    let start=0;
    for(const [number,id] of [...lineNodes].sort((a,b)=>a[0]-b[0])){
      const i=number-1;
      if(i<start||i>=lines.length)continue;
      if(start<i)parts.push(lines.slice(start,i).join("\n")+"\n");
      parts.push({number,id,line:lines[i]});
      if(i+1<lines.length)parts.push("\n");
      start=i+1;
    }
    parts.push(lines.slice(start).join("\n"));
    return parts;
  },[result.files,livePath,lineNodes]);
  const parameters = useMemo(() => {
    if (!livePath?.endsWith(".tf.json")) return [];
    try {
      const doc = JSON.parse(result.files[livePath]);
      return ["variable", "locals", "output"].flatMap((kind) =>
        Object.entries(doc[kind] || {}).map(([name, value]) => ({
          kind,
          name,
          value,
        })),
      );
    } catch {
      return [];
    }
  }, [result.files, livePath]);
  const viewer = useRef<HTMLDetailsElement>(null);
  const resourceCode = useRef<HTMLDetailsElement>(null);
  const revealSelection = useRef(false);
  const declaration = declarations.find((d) => d.id === selected);
  const nodeCodePath = useMemo(() => {
    if (!node || tab !== "canvas") return undefined;
    if (node.sourceFile && node.address) {
      const path = "terraform/" + node.sourceFile;
      return Object.hasOwn(result.files, path) ? path : undefined;
    }
    return Object.keys(result.files).find((path) =>
      path.endsWith(".tf.json") && terraformDeclarations(result.files[path], [node]).length > 0,
    );
  }, [node, result.files, tab]);

  useLayoutEffect(() => {
    if (nodeCodePath) setLiveFile(nodeCodePath);
  },[selected,nodeCodePath]);

  function showNodeCode() {
    if (!nodeCodePath || !viewer.current) return;
    setLiveFile(nodeCodePath);
    setDetail("closed");
    viewer.current.open = true;
    requestAnimationFrame(() => {
      if (!resourceCode.current) return;
      resourceCode.current.open = true;
      const line=viewer.current?.querySelector<HTMLElement>('[data-declaration="'+CSS.escape(selected)+'"]');
      line?.scrollIntoView({block:"nearest"});
      resourceCode.current.querySelector<HTMLElement>("pre")?.focus({preventScroll:!!line});
    });
  }
  const fileNames = Object.keys(result.files),
    activeFile = fileNames.includes(file) ? file : fileNames[0];
  function change(next: ArchitectureModel) {
    if (readonly) return;
    try {
      for (const id of model.presentation?.locked || []) {
        const before = model.nodes.find((n) => n.id === id),
          after = next.nodes.find((n) => n.id === id);
        if (!before) continue;
        if (
          !after ||
          before.x !== after.x ||
          before.y !== after.y ||
          before.scopeAddress !== after.scopeAddress ||
          before.props.arguments !== after.props.arguments ||
          Object.entries(COMPONENTS[before.kind]?.fields || {}).some(
            ([key, f]: [string, any]) =>
              f.ref && before.props[key] !== after.props[key],
          )
        ) {
          setError("배치 잠금을 해제한 후 변경하세요.");
          return;
        }
      }
      undo.current.push(model);
      if (undo.current.length > 60) undo.current.shift();
      redo.current = [];
      onChange(next);
      setError("");
    } catch (e) {
      undo.current.pop();
      setError(String(e));
    }
  }
  function updateNode(patch: Partial<ArchitectureNode>) {
    if (node)
      change({
        ...model,
        nodes: model.nodes.map((n) =>
          n.id === node.id ? { ...n, ...patch } : n,
        ),
      });
  }
  function add(
    kind: string,
    x?: number,
    y?: number,
    parent?: ArchitectureNode,
    displayName?: string,
  ) {
    if (readonly) return;
    const n = newComponent(
      kind,
      x ?? 60 + (model.nodes.length % 4) * 220,
      y ?? 60 + Math.floor(model.nodes.length / 4) * 130,
    ) as ArchitectureNode;
    if (displayName) n.label = displayName;
    if (parent && !canPlace(model, n, parent)) return;
    const next = { ...model, nodes: [...model.nodes, n] };
    const placed = parent ? reassignPlacement(next, n, parent) : next;
    change(placed);
    if (parent || document.activeElement?.closest(".canvas-search"))
      openDetail(n.id, placed);
    setSelected(n.id);
  }
  function select(n: ArchitectureNode) {
    if (connecting && node) {
      if (COMPONENTS[node.kind]?.generic && !node.imported) {
        if (node.id===n.id || !compatibleFields(node.kind,n.kind).length) {setError("호환되는 참조 속성이 없습니다.");return;}
        setRefChoice(n.id);
        return;
      }
      const match = Object.entries(COMPONENTS[node.kind]?.fields || {}).find(
        ([, f]: [string, any]) => f.ref === n.kind,
      );
      if (!match || node.imported) {
        setError(
          "이 두 컴포넌트에는 지원하는 연결이 없습니다. 속성의 연결 대상을 확인하세요.",
        );
        return;
      }
      updateNode({ props: { ...node.props, [match[0]]: n.id } });
      setConnecting(false);
    } else {
      if (n.sourceFile) setLiveFile("terraform/" + n.sourceFile);
      setSelected(n.id);
      setDetail("open");
      const rail = section.current?.querySelector<HTMLElement>(".arch-review-rail");
      revealSelection.current = true;
      if (railOpen && window.matchMedia("(min-width: 801px) and (max-width: 1050px)").matches && !compareFile) {
        if (viewer.current) viewer.current.open = true;

      } else if (railOpen && !codeOnly && rail && rail.scrollTop > 0)
        requestAnimationFrame(() => rail.querySelector(".arch-properties header")?.scrollIntoView({block:"nearest",container:"nearest"} as ScrollIntoViewOptions));
    }
  }
  async function download() {
    try {
      if (result.errors.length) throw Error(result.errors[0]);
      if (api.exportArchitecture) {
        const saved = await api.exportArchitecture(
          model,
          format,
          only && node ? [node.id] : [],
        );
        if (!saved) return;
      } else {
        const zip = zipSync(
          Object.fromEntries(
            Object.entries(result.files).map(([p, c]) => [p, strToU8(c)]),
          ),
        );
        const url = URL.createObjectURL(
          new Blob([new Uint8Array(zip)], { type: "application/zip" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "xdocs-architecture.zip";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setStatus("코드 묶음을 내보냈습니다.");
    } catch (e) {
      setError(String(e));
    }
  }
  const section = useRef<HTMLElement>(null);
  const workspacePane = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const pane = workspacePane.current;
    const main = pane?.closest<HTMLElement>(".main");
    if (!pane || !main) return;

    function resize() {
      if (!pane || !main) return;
      const top = pane.getBoundingClientRect().top + main.scrollTop;
      const remaining = Math.floor(main.getBoundingClientRect().bottom - top - 8);
      pane.style.setProperty("--canvas-height", Math.max(220, remaining) + "px");
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(main);
    // Headers, toolbars and the stacked mobile palette can wrap independently.
    for (let node: Element | null = pane; node && node !== main; node = node.parentElement) {
      for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        observer.observe(sibling);
      }
    }
    return () => observer.disconnect();
  }, [tab]);

  const [detail, setDetail] = useState<"auto" | "open" | "closed">("auto");
  const [navigationView, setNavigationView] =
    useState<ArchitectureModel["presentation"]>();
  const displayModel = navigationView
    ? { ...model, presentation: { ...model.presentation, ...navigationView } }
    : model;
  const rules: Record<string, string[]> = placementFields;
  const binding = node?.placementSource;
  const placementField =
    node &&
    (rules[node.kind]?.[2] ||
      (node.kind === "google_compute_instance"
        ? "network_interface.subnetwork"
        : node.kind === "azurerm_network_interface"
          ? "ip_configuration.subnet_id"
          : node.kind === "azurerm_linux_virtual_machine" ||
              node.kind === "azurerm_windows_virtual_machine"
            ? "network_interface_ids[0]"
            : undefined));
  const source = binding && model.sources.find((f) => f.name === binding.file);
  const directExpression =
    source &&
    binding &&
    source.content.slice(binding.offset).match(/^[\w.-]+/)?.[0];
  const evidence =
    directExpression ||
    (node?.placementValue !== undefined
      ? JSON.stringify(node.placementValue)
      : undefined);
  const scope =
    node?.scopeAddress &&
    model.nodes.find(
      (n) =>
        n.address === node.scopeAddress && n.kind === rules[node.kind]?.[1],
    );
  const indexed = indexedPlacementTarget(node, model.nodes);
  const nic =
    node?.nicAddress && model.nodes.find((n) => n.address === node.nicAddress);
  const viaParentId = nic && node && boundaryLayout(model).parents.get(node.id);
  const viaSubnet =
    viaParentId && model.nodes.find((n) => n.id === viaParentId);
  const contextParent =
    boundary &&
    node &&
    !node.imported &&
    Object.values(rules).some((rule) => rule[1] === node.kind)
      ? node
      : undefined;
  const searchEntries = useMemo(() => {
    const {parents} = boundaryLayout(model);
    const nodes = new Map(model.nodes.map(n => [n.id,n]));
    return model.nodes.map(n => {
      const path: string[] = [];
      const seen = new Set([n.id]);
      let parent = parents.get(n.id);
      while (parent && !seen.has(parent)) {
        seen.add(parent);
        const scope = nodes.get(parent);
        if (!scope) break;
        path.unshift([scope.locationScope || scope.props.availability_zone || scope.props.region,scope.label].filter(Boolean).join(" / "));
        parent = parents.get(parent);
      }
      const region = n.locationScope || n.props.region || n.props.availability_zone || n.props.location;
      return {id:n.id,label:n.label,detail:[COMPONENTS[n.kind]?.group,n.props.account_id || n.props.subscription_id || n.props.project,...path,region,n.props.name,n.address || terraformAddress(n),n.kind].filter(Boolean).join(" · ")};
    });
  },[model]);
  function focusNode(id: string, takeFocus = true) {
    requestAnimationFrame(() => {
      const el = section.current?.querySelector<HTMLElement>(
        `[data-scope="${CSS.escape(id)}"],[data-free-id="${CSS.escape(id)}"],[data-resource="${CSS.escape(id)}"]`,
      );
      if (takeFocus) el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "center", inline: "center", container:"nearest" } as ScrollIntoViewOptions);
    });
  }
  useEffect(()=>{
    if(focusResource && model.nodes.some(node=>node.id===focusResource)){
      openDetail(focusResource);focusNode(focusResource);
    }
  },[focusResource]);
  function openDetail(id: string, source = model, preservePanel = false) {
    if (caseView && !section.current?.querySelector(`.case-blueprint [data-resource="${CSS.escape(id)}"]`)) {
      setCaseView(false);
      setBoundary(true);
    }
    const origin = source.nodes.find((n) => n.id === id)?.sourceFile;
    if (origin) setLiveFile("terraform/" + origin);
    const { parents } = boundaryLayout(source);
    const ancestors = new Set<string>();
    let parent = parents.get(id);
    while (parent && !ancestors.has(parent)) {
      ancestors.add(parent);
      parent = parents.get(parent);
    }
    const view = displayModel.presentation;
    setNavigationView({
      ...navigationView,
      resources: true,
      folded: (view?.folded || []).filter((n) => !ancestors.has(n)),
    });
    setConnecting(false);
    setSelected(id);
    if (!preservePanel) { setCodeOnly(false); setRailOpen(true); setDetail("open"); }
    requestAnimationFrame(() => {
      section.current
        ?.querySelector<HTMLElement>(
          `[data-scope="${CSS.escape(id)}"],[data-free-id="${CSS.escape(id)}"],[data-resource="${CSS.escape(id)}"]`,
        )
        ?.scrollIntoView({ block: "center", inline: "center", container:"nearest" } as ScrollIntoViewOptions);
      if (!preservePanel) section.current
        ?.querySelector<HTMLInputElement>(".arch-properties input")
        ?.focus();
    });
  }
  function updatePresentation(
    next: NonNullable<ArchitectureModel["presentation"]>,
  ) {
    if (readonly) {
      setNavigationView(next);
      return;
    }
    const shown = displayModel.presentation || {};
    const edits = Object.fromEntries(
      Object.entries(next).filter(
        ([key, value]) => shown[key as keyof typeof shown] !== value,
      ),
    );
    if (edits.folded) {
      const saved = new Set(model.presentation?.folded);
      for (const id of shown.folded || [])
        if (!next.folded?.includes(id)) saved.delete(id);
      for (const id of next.folded || [])
        if (!shown.folded?.includes(id)) saved.add(id);
      edits.folded = [...saved];
    }
    change({ ...model, presentation: { ...model.presentation, ...edits } });
    if (navigationView)
      setNavigationView(
        Object.fromEntries(
          Object.entries(navigationView).filter(([key]) => !(key in edits)),
        ),
      );
  }
  function closeDetail() {
    setDetail("closed");
    focusNode(selected);
  }
  const [lastPlacement,setLastPlacement] = useState<{before:ArchitectureModel;after:ArchitectureModel;id:string}>();
  function place(child: ArchitectureNode, parent: ArchitectureNode) {
    try {
      const next = reassignPlacement(model, child, parent);
      change(next);
      setLastPlacement({before:model,after:next,id:child.id});
      setImpactOpen(true);
      setSelected(child.id);
    } catch (e) {
      setError(String(e));
    }
  }
  const providerEntries = useMemo(() => Object.entries(COMPONENTS).filter(([, c]) =>
    !c.documentationOnly && (paletteMode === "all" || (paletteMode === "service" ? c.diagramOnly : !c.diagramOnly)) && (group === "전체" || c.group === group || (group === "Azure" && c.group === "Azure AVM")),
  ), [group, paletteMode]);
  const serviceName=(c:any)=>c.extension==="azuread"?"Microsoft Entra ID":(c.service||c.group).split(" · ")[0];
  const serviceOptions=useMemo(()=>[...new Set(providerEntries.map(([,c])=>serviceName(c)))].sort(),[providerEntries]);
  const query = paletteQuery.trim().toLowerCase();
  const matches = useMemo(() => providerEntries.filter(([kind, c]) =>
    (!catalogService || serviceName(c)===catalogService) && query.split(/\s+/).every(w=>[kind,c.label,c.group,c.service,serviceName(c)].join(" ").toLowerCase().includes(w)),
  ), [providerEntries, query,catalogService]);
  const visibleMatches = useMemo(()=>{
    const visible=matches.slice(0,paletteLimit);
    return query?visible.sort((a,b)=>String(a[1].service||a[1].group).localeCompare(String(b[1].service||b[1].group))):visible;
  },[matches,paletteLimit,query]);
  const insertionEntries=useMemo(()=>providerEntries.filter(([kind,c])=>
    (!catalogService||serviceName(c)===catalogService) && (!contextParent || rules[kind]?.[1]===contextParent.kind || (c.generic && compatibleFields(kind,contextParent.kind).length===1))
  ).map(([id,c])=>({id,label:c.label,detail:c.group+" · "+id})),[providerEntries,catalogService,contextParent?.kind,rules]);
  const width = Math.max(1000, ...model.nodes.map((n) => n.x + 240)),
    height = Math.max(650, ...model.nodes.map((n) => n.y + 150));
  useLayoutEffect(() => {
    const pane = viewport.current;
    if (!pane || viewScale === "manual") return;
    function resize() {
      if (!pane) return;
      const fit = Math.min(pane.clientWidth / width, pane.clientHeight / height);
      setZoom(viewScale === "fit" ? Math.max(0.01,fit) : viewScale === "selection" ? Math.min(2,pane.clientWidth/230,pane.clientHeight/110) : 1);
      if (viewScale === "selection" && selected) focusNode(selected,false);
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(pane);
    return () => observer.disconnect();
  },[width,height,tab,caseView,boundary,viewScale,selected]);
  useLayoutEffect(() => {
    if (tab !== "canvas" || (viewScale !== "actual" && viewScale !== "manual")) return;
    const surface = section.current?.querySelector<HTMLElement>(".case-blueprint,.network-sheet,.arch-viewport");
    if (!surface) return;
    let width = surface.clientWidth, height = surface.clientHeight;
    const observer = new ResizeObserver(() => {
      const nextWidth=surface.clientWidth, nextHeight=surface.clientHeight;
      surface.scrollBy((width-nextWidth)/2,(height-nextHeight)/2);
      width=nextWidth;
      height=nextHeight;
    });
    observer.observe(surface);
    return () => observer.disconnect();
  },[tab,caseView,boundary,viewScale]);
  useLayoutEffect(() => {
    const code = viewer.current?.querySelector<HTMLElement>('pre[aria-label="Terraform 코드"]');
    const line = code?.querySelector<HTMLElement>('[data-declaration="'+CSS.escape(selected)+'"]');
    if (!code || !line || !railOpen) return;
    code.scrollTop += line.getBoundingClientRect().top - code.getBoundingClientRect().top - 12;
    if (revealSelection.current && window.matchMedia("(min-width: 801px) and (max-width: 1050px)").matches) {
      line.scrollIntoView({block:"nearest", inline:"nearest"});
    }
  },[livePath,selected,railOpen,compareFile,tab]);
  return (
    <section
      onKeyDownCapture={(e) => {
        if (e.key !== "Enter" || connecting) return;
        const id = (e.target as Element).closest("[data-scope],[data-free-id]");
        const selectedId =
          id?.getAttribute("data-scope") || id?.getAttribute("data-free-id");
        if (selectedId) {
          e.preventDefault();
          e.stopPropagation();
          openDetail(selectedId);
        }
      }}
      ref={section}
      data-search-scope
      className="architecture-document"
      aria-label="xinfra 캔버스 편집기"
    >
      <header className="arch-command-row">
        <div className="arch-header">
          <textarea
            rows={1}
            onKeyDown={e=>{if(e.key==="Enter" && !e.nativeEvent.isComposing)e.preventDefault();}}
            aria-label="아키텍처 제목"
            value={model.title}
            readOnly={readonly}
            onChange={(e) => change({ ...model, title: e.target.value.replace(/[\r\n]+/g," ") })}
          />
        <span className="arch-count">
          {tab === "drawing"
            ? (model.drawing?.accounts.length ?? 0) +
              "개 계정 영역 · " +
              (model.drawing?.items.length ?? 0) +
              "개 서비스"
            : model.nodes.length + "개 컴포넌트 · " + edges.length + "개 연결"}
        </span>
      </div>
      <div className="arch-toolbar">
        <div className="segmented">
          {[
            ["canvas", "설계"],
            ["drawing", "AWS 드로잉"],
            ["code", "코드 추출"],
            ["review", "WAF 검토"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "selected" : ""}
              onClick={() => setTab(id)}
            >
              {id === "canvas" ? (
                <LayoutGrid size={14} />
              ) : id === "code" ? (
                <Code2 size={14} />
              ) : (
                <ShieldCheck size={14} />
              )}{" "}
              {label}
            </button>
          ))}
        </div>
        <div className="arch-tools">
          {tab === "canvas" && <>
            <button aria-expanded={paletteOpen} aria-label="리소스 팔레트" title="리소스 팔레트" onClick={()=>setPaletteOpen(!paletteOpen)}><PanelLeft size={16}/></button>
            <button aria-expanded={railOpen} aria-label="Terraform·속성 패널" title="Terraform·속성 패널" onClick={()=>setRailOpen(!railOpen)}><PanelRight size={16}/></button>
          </>}
          <button
            title="실행 취소"
            aria-label="아키텍처 실행 취소"
            disabled={readonly || !undo.current.length}
            onClick={() => {
              const prev = undo.current.pop();
              if (prev) {
                redo.current.push(model);
                onChange(prev);
                rerender((v) => v + 1);
              }
            }}
          >
            <Undo2 size={16} />
          </button>
          <button
            title="다시 실행"
            aria-label="아키텍처 다시 실행"
            disabled={readonly || !redo.current.length}
            onClick={() => {
              const next = redo.current.pop();
              if (next) {
                undo.current.push(model);
                onChange(next);
                rerender((v) => v + 1);
              }
            }}
          >
            <Redo2 size={16} />
          </button>
        </div>
      </div>
      </header>
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      {tab === "drawing" && (
        <AwsDrawing
          data={model.drawing || blankDrawing()}
          readonly={readonly}
          onChange={(drawing) => change({ ...model, drawing })}
        />
      )}
      {tab === "canvas" && (
        <div className="canvas-findbar">
          <CanvasSearch
            label="리소스 찾기"
            entries={searchEntries}
            onChoose={openDetail}
          />
          {node && (
            <button
              className="button small"
              onClick={() => openDetail(node.id)}
            >
              속성 열기
            </button>
          )}
          {!readonly && !model.sources.length && (
            <CanvasSearch
              label={
                contextParent
                  ? contextParent.label + " 안에 추가"
                  : "컴포넌트 추가"
              }
              shortcutKey="+"
              resultLimit={100}
              entries={insertionEntries}
              onChoose={(kind) =>
                add(kind, undefined, undefined, contextParent)
              }
            />
          )}
        </div>
      )}
      {tab === "canvas" && (
        <div className={"arch-editor inspector-" + detail} data-palette={paletteOpen} data-rail={railOpen}>
          <aside className="arch-palette" hidden={!paletteOpen}>
            <strong>컴포넌트</strong>
            <select
              aria-label="컴포넌트 공급자"
              value={group}
              onChange={(e) => {setGroup(e.target.value); setCatalogService(""); setPaletteLimit(50); setPaletteQuery("");}}
            >
              {[
                "전체",
                ...new Set(Object.values(builtInComponents).map((c: any) => c.group)),
              ].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <select aria-label="컴포넌트 종류" value={paletteMode} onChange={e => {setPaletteMode(e.target.value); setCatalogService(""); setPaletteLimit(50);}}>
              <option value="all">모든 컴포넌트</option>
              <option value="resource">인프라 리소스</option>
              <option value="service">서비스 도식</option>
            </select>
            <select aria-label="클라우드 서비스" value={catalogService} onChange={e=>{setCatalogService(e.target.value);setPaletteLimit(50);}}>
              <option value="">모든 서비스</option>{serviceOptions.map(service=><option key={service}>{service}</option>)}
            </select>
            <input className="palette-search" type="search" aria-label="추가할 리소스 검색" placeholder="리소스 검색" value={paletteQuery} onChange={e=>{setPaletteQuery(e.target.value); setPaletteLimit(50);}}/>
            {visibleMatches.map(([kind, c],i) => {
                const service=c.service||c.group;
                const previous=visibleMatches[i-1]?.[1];
                return (<Fragment key={kind}>
                  {query && service!==(previous?.service||previous?.group) && <small className="palette-service-name">{service}</small>}
                  <button
                    key={kind}
                    draggable={!readonly}
                    disabled={readonly}
                    onDragStart={(e) =>
                      e.dataTransfer.setData(
                        "application/x-xdocs-component",
                        kind,
                      )
                    }
                    onClick={() => add(kind)}
                    title={c.group + " · " + c.label}
                  >
                    <ServiceIcon kind={kind} size={17} />
                    <span>
                      {c.label}
                      <small>{c.generic || c.diagramOnly ? c.service : c.group}</small>
                    </span>
                    <Plus size={12} />
                  </button></Fragment>
                );
              })}
            {!matches.length && <small>검색 결과가 없습니다.</small>}
            {!matches.length && !readonly && paletteMode !== "resource" && ["AWS", "Azure", "GCP"].includes(group) &&
              paletteQuery.trim().length > 0 && paletteQuery.trim().length <= 200 &&
              <button onClick={() => add("service_" + group.toLowerCase() + "__custom", undefined, undefined, undefined, paletteQuery.trim())}>
                “{paletteQuery.trim()}” 서비스 도식 추가
              </button>}

            {matches.length > paletteLimit && <button onClick={() => setPaletteLimit(limit => limit + 50)}>더 보기 ({paletteLimit}/{matches.length})</button>}
          </aside>
          <div className="arch-workspace" ref={workspacePane}>
            {mutedSelector && <style>{mutedSelector + "{opacity:0.25}"}</style>}
            <div className="arch-canvas-tools">
              {focused && <div className="focused-reference">
                <strong>{focused.label}</strong><button onClick={showSites}>Terraform 속성 보기</button>
                <button onClick={() => {setPathFocus(false);setSitesOpen(false);setSite(undefined);}}>전체 도면 보기</button>
                {sitesOpen && sites.length !== 1 && <div>{sites.length ? sites.map((s,i) => <button key={i} onClick={() => jumpToSite(s)}>{s.property} · {s.file}:{s.line}</button>) : "현재 파일에서 이 참조의 원본 위치를 확인할 수 없습니다."}</div>}
              </div>}
              <button type="button" disabled={!node} aria-pressed={focusRelated} onClick={() => setFocusRelated(!focusRelated)}>연결 집중 보기</button>
              <div className="segmented">
                {model.caseStudyId && <button aria-pressed={caseView} className={caseView ? "selected" : ""} onClick={() => setCaseView(true)}>사례 구성도</button>}
                <button
                  aria-pressed={!caseView && boundary}
                  className={!caseView && boundary ? "selected" : ""}
                  onClick={() => {setCaseView(false); setBoundary(true)}}
                >
                  경계 도면
                </button>
                <button
                  aria-pressed={!caseView && !boundary}
                  className={!caseView && !boundary ? "selected" : ""}
                  onClick={() => {setCaseView(false); setBoundary(false)}}
                >
                  자유 배치·참조선
                </button>
              </div>
              <select aria-label="도면 배율" value={viewScale} onChange={e => setViewScale(e.target.value as typeof viewScale)}>
                <option value="fit">전체 맞춤</option><option value="actual">100%</option>
                <option value="selection" disabled={!node}>선택 항목 맞춤</option>
                {viewScale==="manual" && <option value="manual">{Math.round(zoom*100)}%</option>}
              </select>
            </div>
            {caseView && model.caseStudyId ? <div className={viewScale === "actual" || viewScale === "manual" ? "case-blueprint case-enlarged" : "case-blueprint"} onClick={event => {
              const id=(event.target as Element).closest("[data-resource]")?.getAttribute("data-resource");
              const n=model.nodes.find(n=>n.id===id);
              if (!n) return;
              select(n);
              if (!connecting && n.sourceFile && Object.hasOwn(networkCases, model.caseStudyId || "")) {
                if (viewer.current) viewer.current.open = true;
                if (resourceCode.current) resourceCode.current.open = true;
              }
            }} onKeyDown={event => {
              if (event.key==="Enter" || event.key===" ") { event.preventDefault(); (event.target as Element).dispatchEvent(new MouseEvent("click",{bubbles:true})); }
            }}>
              <div dangerouslySetInnerHTML={{__html:caseDiagram(model,selected,planLabels,viewScale==="selection")}}/>
              {model.caseStudyId === firewallCase && <nav aria-label="스포크 송신 경로" className="firewall-path">
                {firewallSteps.map(([address,label]) => {
                  const target=model.nodes.find(n=>n.address===address);
                  return target && <button key={address} aria-pressed={selected===target.id} onClick={()=>{
                    openDetail(target.id);
                    if(viewer.current) viewer.current.open=true;
                    requestAnimationFrame(()=>{if(resourceCode.current){resourceCode.current.open=true;resourceCode.current.querySelector<HTMLElement>("pre")?.focus();}});
                  }}>{label}</button>;
                })}
              </nav>}
              <p>실선은 구성에 정의한 경로이고 점선 화살표는 운영자가 수행할 단계입니다. 리소스를 선택하면 속성과 원본 코드를 볼 수 있습니다.</p>
            </div> : boundary && model.nodes.length > 0 ? (
              <>
                <p className="boundary-hint">
                  {connecting
                    ? "연결할 대상 컴포넌트를 선택하세요."
                    : "항목을 선택해 속성을 편집하거나 상위 경계의 제목으로 끌어 소속을 변경하세요."}
                </p>
                <NetworkLayout focused={focused} onReference={showSites} planLabels={planLabels} focusRelated={focusRelated}
                  fit={viewScale==="fit" || viewScale==="selection"} magnify={viewScale==="selection"}
                  model={displayModel}
                  selected={selected}
                  readonly={readonly}
                  onSelect={select}
                  onView={updatePresentation}
                  onPlace={place}
                />
              </>
            ) : (
              <>
                <div className="arch-canvas-tools">
                  <span>
                    {connecting
                      ? "연결할 대상 컴포넌트를 클릭하세요."
                      : "끌어서 배치 · 컴포넌트를 선택해 속성 편집"}
                  </span>
                  <button
                    aria-label="아키텍처 축소"
                    onClick={() => {setViewScale("manual"); setZoom(Math.max(0.1, zoom - 0.1));}}
                  >
                    <ZoomOut size={15} />
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button
                    aria-label="아키텍처 확대"
                    onClick={() => {setViewScale("manual"); setZoom(Math.min(2, zoom + 0.1));}}
                  >
                    <ZoomIn size={15} />
                  </button>

                  <button
                    disabled={readonly}
                    onClick={() => change(layoutArchitecture(model))}
                  >
                    정렬
                  </button>
                </div>
                <div
                  className="arch-viewport"
                  ref={viewport}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const k = e.dataTransfer.getData(
                      "application/x-xdocs-component",
                    );
                    if (COMPONENTS[k]) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      add(
                        k,
                        Math.max(
                          0,
                          (e.clientX - rect.left + e.currentTarget.scrollLeft) /
                            zoom,
                        ),
                        Math.max(
                          0,
                          (e.clientY - rect.top + e.currentTarget.scrollTop) /
                            zoom,
                        ),
                      );
                    }
                  }}
                >
                  <div style={{ width: width * zoom, height: height * zoom }}>
                    <div
                      className="arch-canvas"
                      style={{ width, height, transform: `scale(${zoom})` }}
                      onPointerMove={(e) => {
                        if (drag)
                          setDrag({
                            ...drag,
                            x: Math.max(
                              0,
                              Math.min(
                                9000,
                                drag.originX + (e.clientX - drag.startX) / zoom,
                              ),
                            ),
                            y: Math.max(
                              0,
                              Math.min(
                                9000,
                                drag.originY + (e.clientY - drag.startY) / zoom,
                              ),
                            ),
                          });
                      }}
                      onPointerUp={() => {
                        if (drag) {
                          if (
                            drag.x !== drag.originX ||
                            drag.y !== drag.originY
                          )
                            change({
                              ...model,
                              nodes: model.nodes.map((n) =>
                                n.id === drag.id
                                  ? {
                                      ...n,
                                      x: Math.round(drag.x / 10) * 10,
                                      y: Math.round(drag.y / 10) * 10,
                                    }
                                  : n,
                              ),
                            });
                          setDrag(null);
                        }
                      }}
                      onPointerCancel={() => setDrag(null)}
                    >
                      <svg className="arch-edges" width={width} height={height}>
                        <defs>
                          <marker
                            id="arch-arrow"
                            markerWidth="8"
                            markerHeight="8"
                            refX="7"
                            refY="4"
                            orient="auto"
                          >
                            <path d="M0,0 L8,4 L0,8" />
                          </marker>
                        </defs>
                        {edges.map((e: any, i: number) => {
                          const a = model.nodes.find((n) => n.id === e.source),
                            b = model.nodes.find((n) => n.id === e.target);
                          if (!a || !b) return null;
                          return (
                            <path
                              key={i}
                              opacity={focusRelated && node && e.source !== selected && e.target !== selected ? 0.15 : 1}
                              d={architectureConnection(
                                drag?.id === a.id
                                  ? { ...a, x: drag.x, y: drag.y }
                                  : a,
                                drag?.id === b.id
                                  ? { ...b, x: drag.x, y: drag.y }
                                  : b,
                              )}
                              markerEnd="url(#arch-arrow)"
                            >
                              <title>
                                {a.label +
                                  " → " +
                                  b.label +
                                  (e.label ? " · " + e.label : "")}
                              </title>
                            </path>
                          );
                        })}
                      </svg>
                      {model.nodes.map((n) => {
                        const bad = issues.some((i) => i.id === n.id);
                        return (
                          <button
                            key={n.id}
                            data-free-id={n.id}
                            aria-label={"컴포넌트 " + n.label}
                            className={
                              "arch-node " +
                              (selected === n.id ? "selected " : "") +
                              (bad ? "invalid" : "")
                            }
                            style={{
                              left: drag?.id === n.id ? drag.x : n.x,
                              top: drag?.id === n.id ? drag.y : n.y,
                            }}
                            onClick={() => select(n)}
                            onPointerDown={(e) => {
                              if (readonly || connecting || e.button !== 0)
                                return;
                              e.currentTarget.setPointerCapture(e.pointerId);
                              setSelected(n.id);
                              setDrag({
                                id: n.id,
                                x: n.x,
                                y: n.y,
                                startX: e.clientX,
                                startY: e.clientY,
                                originX: n.x,
                                originY: n.y,
                              });
                            }}
                            onKeyDown={(e) => {
                              if (
                                readonly ||
                                ![
                                  "ArrowLeft",
                                  "ArrowRight",
                                  "ArrowUp",
                                  "ArrowDown",
                                ].includes(e.key)
                              )
                                return;
                              e.preventDefault();
                              change({
                                ...model,
                                nodes: model.nodes.map((x) =>
                                  x.id === n.id
                                    ? {
                                        ...x,
                                        x: Math.max(
                                          0,
                                          x.x +
                                            (e.key === "ArrowRight"
                                              ? 10
                                              : e.key === "ArrowLeft"
                                                ? -10
                                                : 0),
                                        ),
                                        y: Math.max(
                                          0,
                                          x.y +
                                            (e.key === "ArrowDown"
                                              ? 10
                                              : e.key === "ArrowUp"
                                                ? -10
                                                : 0),
                                        ),
                                      }
                                    : x,
                                ),
                              });
                            }}
                          >
                            <ServiceIcon kind={n.kind} size={22} />
                            <span>
                              <strong>{n.label}</strong>
                              <small>
                                {planLabels[n.id] || (n.imported
                                  ? "Terraform 원본"
                                  : COMPONENTS[n.kind]?.group)}
                              </small>
                            </span>
                            {bad && <b title="설정 필요">!</b>}
                          </button>
                        );
                      })}
                      {!model.nodes.length && (
                        <div className="arch-empty">
                          <Box size={35} />
                          <h3>아키텍처를 그려보세요</h3>
                          <p>왼쪽 컴포넌트를 클릭하거나 이곳으로 끌어오세요.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="arch-review-rail" hidden={!railOpen} data-code-only={codeOnly}>
          <aside
            className="arch-properties"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                closeDetail();
              }
            }}
          >
            {node ? (
              <>
                <header>
                  <strong>컴포넌트 속성</strong>
                  <button aria-label="속성 닫기" onClick={closeDetail}>
                    <X size={16} />
                  </button>
                  <button
                    aria-label="컴포넌트 삭제"
                    disabled={
                      readonly ||
                      node.imported ||
                      model.presentation?.locked?.includes(node.id)
                    }
                    onClick={() => {
                      change(removeComponent(model, node.id));
                      setSelected("");
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </header>
                <label>
                  표시 이름
                  <input
                    aria-label="컴포넌트 표시 이름"
                    readOnly={readonly}
                    value={node.label}
                    onChange={(e) => updateNode({ label: e.target.value })}
                  />
                </label>
                {node.label !== (node.address || node.kind) && <p className="small-text muted">{node.address || node.kind}</p>}
                {nodeCodePath && (
                  <button type="button" className="code-jump" onClick={showNodeCode}>
                    Terraform 선언 보기 <span aria-hidden="true">↗</span>
                  </button>
                )}
                {AVM_MODULES[node.kind as keyof typeof AVM_MODULES] && (
                  <p className="arch-module">
                    {AVM_MODULES[node.kind as keyof typeof AVM_MODULES].source}
                    <br />
                    고정 버전{" "}
                    {AVM_MODULES[node.kind as keyof typeof AVM_MODULES].version}
                  </p>
                )}
                {!node.imported && COMPONENTS[node.kind]?.generic && <>
                  <ResourceFields key={node.id} kind={node.kind} raw={node.props.arguments} disabled={!!readonly || !!model.presentation?.locked?.includes(node.id)} change={argumentsJson=>updateNode({props:{...node.props,arguments:argumentsJson}})}/>
                  {node.schemaFingerprint!==resourceSchema(node.kind)?.fingerprint && <details><summary>공급자 스키마 검토</summary><p>{node.schemaFingerprint?"저장 이후 스키마가 변경되었습니다.":"이전 도면에 스키마 기록이 없습니다."} 속성 폼에서 현재 값을 확인하세요.</p>
                    {migration && node.schemaFingerprint===migration.from && <p>{[["추가",migration.added],["삭제",migration.removed],["변경",migration.changed]].map(([label,fields])=>Array.isArray(fields) && fields.length?String(label)+" · "+fields.join(", "):"").filter(Boolean).join(" / ")}</p>}
                    <button disabled={readonly || model.presentation?.locked?.includes(node.id)} onClick={()=>updateNode({schemaFingerprint:resourceSchema(node.kind)?.fingerprint})}>현재 스키마 확인 기록</button></details>}
                  {connecting && refChoice && model.nodes.filter(t=>t.id===refChoice).map(target=><fieldset key={target.id}><legend>{target.label} 참조 속성</legend>
                    {compatibleFields(node.kind,target.kind).map(k=><button key={k} onClick={()=>{
                      try {const args=JSON.parse(node.props.arguments);args[k]="${"+terraformAddress(target)+"."+referenceTargets[k][1]+"}";updateNode({props:{...node.props,arguments:JSON.stringify(args,null,2)}});setConnecting(false);setRefChoice("");setError("");}catch{setError("Terraform 속성 JSON을 확인하세요.");}
                    }}>{k}</button>)}</fieldset>)}
                </>}
                {Object.entries(COMPONENTS[node.kind]?.fields || {})
                  .filter(
                    ([k]) => !node.imported || Object.hasOwn(node.props, k),
                  )
                  .map(([k, f]: [string, any]) => (
                    <label key={k}>
                      {rules[node.kind]?.[0] === k
                        ? "다른 경계로 이동 · " + f.label
                        : f.label}
                      {f.ref ? (
                        <select
                          aria-label={f.label}
                          disabled={
                            readonly ||
                            model.presentation?.locked?.includes(node.id)
                          }
                          value={node.props[k] || ""}
                          onChange={(e) => {
                            const target = model.nodes.find(
                              (n) => n.id === e.target.value,
                            );
                            if (target && rules[node.kind]?.[0] === k)
                              place(node, target);
                            else
                              updateNode({
                                props: { ...node.props, [k]: e.target.value },
                              });
                          }}
                        >
                          <option value="">연결할 대상 선택</option>
                          {model.nodes
                            .filter((n) => n.kind === f.ref)
                            .map((n) => (
                              <option value={n.id} key={n.id}>
                                {n.label} · {n.props.name}
                              </option>
                            ))}
                        </select>
                      ) : f.options ? (
                        <select
                          aria-label={f.label}
                          disabled={
                            readonly ||
                            model.presentation?.locked?.includes(node.id)
                          }
                          value={node.props[k]}
                          onChange={(e) =>
                            updateNode({
                              props: { ...node.props, [k]: e.target.value },
                            })
                          }
                        >
                          {f.options.map((o: string) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : f.json ? (
                        <textarea
                          aria-label={f.label}
                          readOnly={readonly || model.presentation?.locked?.includes(node.id)}
                          value={node.props[k]}
                          onChange={(e) =>
                            updateNode({
                              props: { ...node.props, [k]: e.target.value },
                            })
                          }
                        />
                      ) : (
                        <input
                          aria-label={f.label}
                          readOnly={readonly}
                          value={node.props[k] || ""}
                          onChange={(e) =>
                            updateNode({
                              props: { ...node.props, [k]: e.target.value },
                            })
                          }
                        />
                      )}
                    </label>
                  ))}
                {node.imported && node.placementSource && (
                  <label>
                    다른 경계로 이동 · Terraform 소속 참조
                    <select
                      aria-label="Terraform 소속 참조"
                      disabled={
                        readonly ||
                        model.presentation?.locked?.includes(node.id)
                      }
                      value={node.scopeAddress}
                      onChange={(e) => {
                        const parent = model.nodes.find(
                          (n) => n.address === e.target.value,
                        );
                        if (parent) place(node, parent);
                      }}
                    >
                      {model.nodes
                        .filter(
                          (n) =>
                            canPlace(model, node, n) ||
                            n.address === node.scopeAddress,
                        )
                        .map((n) => (
                          <option key={n.id} value={n.address}>
                            {n.label}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {node.imported &&
                  (binding || node.placementUnknown || evidence) && (
                    <section
                      aria-label="Terraform 배치 근거"
                      className="placement-evidence"
                    >
                      <strong>Terraform 배치 근거</strong>
                      <p>
                        {scope
                          ? "소속 경계 · " + scope.address
                          : indexed
                            ? "참조 선언 · " +
                              indexed.address +
                              " (each.key별 인스턴스 소속 미확정)"
                            : viaSubnet
                              ? "NIC를 통한 소속 경계 · " + viaSubnet.address
                              : "소속 미확정 · 원본 표현식을 유지합니다."}
                      </p>
                      {placementField && evidence && (
                        <code>
                          {placementField} = {evidence}
                        </code>
                      )}
                      {node.interfaceEvidence?.map((line, index) => (
                        <code key={index}>{line}</code>
                      ))}
                      {node.moduleTrace && (
                        <details key={node.id}>
                          <summary>
                            {node.moduleTrace.address} · output 선언
                          </summary>
                          <small>{node.moduleTrace.file}</small>
                          <code>value = {node.moduleTrace.expression}</code>
                          <details>
                            <summary>출력 선언 원문 보기</summary>
                            <pre>
                              {
                                model.sources.find(
                                  (f) => f.name === node.moduleTrace?.file,
                                )?.content
                              }
                            </pre>
                          </details>
                          {node.moduleTrace.targetFile ? (
                            <details>
                              <summary>{node.moduleTrace.target}</summary>
                              <small>{node.moduleTrace.targetFile}</small>
                              <pre>
                                {
                                  model.sources.find(
                                    (f) =>
                                      f.name === node.moduleTrace?.targetFile,
                                  )?.content
                                }
                              </pre>
                            </details>
                          ) : (
                            node.moduleTrace.target && (
                              <button
                                onClick={() => {
                                  const resource = model.nodes.find(
                                    (n) =>
                                      n.address === node.moduleTrace?.target,
                                  );
                                  if (resource) openDetail(resource.id);
                                }}
                              >
                                {node.moduleTrace.target}
                              </button>
                            )
                          )}
                        </details>
                      )}
                      {nic && (
                        <button onClick={() => openDetail(nic.id)}>
                          연결된 NIC · {nic.address}
                        </button>
                      )}
                      {binding && <small>{binding.file}</small>}
                      {node.placementUnknown &&
                        !nic &&
                        !evidence &&
                        !node.interfaceEvidence?.length && (
                          <small>
                            저장된 식을 표시할 수 없습니다. 가져온 Terraform
                            원문을 확인하세요.
                          </small>
                        )}
                    </section>
                  )}
                {node.imported ? (
                  <p className="small-text muted">
                    소속을 옮기면 보관된 Terraform 사본의 직접 참조가 바뀝니다.
                    단순 속성 변경은 override 파일로 추출합니다.
                  </p>
                ) : (
                  <button
                    className="button"
                    disabled={readonly}
                    onClick={() => {setRefChoice("");setConnecting(!connecting);}}
                  >
                    <Link2 size={14} />
                    {connecting ? "연결 취소" : "대상 클릭으로 연결"}
                  </button>
                )}
                {issues
                  .filter((i) => i.id === node.id)
                  .map((i, index) => (
                    <p className="arch-issue" key={index}>
                      {i.message}
                    </p>
                  ))}
                <details>
                  <summary>이 리소스를 참조하는 항목</summary>
                  {neighbours.filter(edge => edge.target === node.id).map((edge, index) =>
                    <button key={index} onClick={() => openDetail(edge.source)}>
                      {model.nodes.find(n => n.id === edge.source)?.label} · {edge.field}
                    </button>)}
                  {!neighbours.some(edge => edge.target === node.id) && <p>들어오는 참조가 없습니다.</p>}
                </details>
                <details>
                  <summary>참조하는 대상</summary>
                  {edges
                    .filter((e) => e.source === node.id)
                    .map((e: any, i: number) => (
                      <p key={i}>
                        <button onClick={() => openDetail(e.target)}>
                          {model.nodes.find((n) => n.id === e.target)?.label}
                        </button>{" "}
                        {!e.locked && (
                          <button
                            disabled={readonly}
                            onClick={() =>
                              updateNode({
                                props: { ...node.props, [e.field]: "" },
                              })
                            }
                          >
                            연결 해제
                          </button>
                        )}
                      </p>
                    ))}
                </details>
              </>
            ) : (
              <p className="muted">컴포넌트를 선택하세요.</p>
            )}
            <details className="arch-environment">
              <summary>클라우드 환경 설정</summary>
              {!model.sources.length && <details><summary>Terraform 공급자 버전</summary>
                {Object.entries(catalogVersions).map(([key,version])=><p key={key}>{key} · {model.settings["provider_"+key]||"기존 버전 범위"}{model.settings["provider_"+key]!==version && " → "+version}</p>)}
                {Object.entries(catalogVersions).some(([key,v])=>model.settings["provider_"+key]!==v) &&
                  <button disabled={readonly} onClick={()=>change({...model,settings:{...model.settings,...catalogSettings()}})}>내장 공급자 버전 적용</button>}
              </details>}
              {[
                ["aws_region", "AWS Region"],
                ["azure_subscription", "Azure Subscription ID"],
                ["gcp_project", "GCP Project ID"],
                ["gcp_region", "GCP Region"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    readOnly={readonly}
                    value={model.settings[key] || ""}
                    onChange={(e) =>
                      change({
                        ...model,
                        settings: {
                          ...model.settings,
                          [key]: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}
              <p className="small-text muted">
                인증정보는 저장하지 않습니다. 계정 ID는 예제 변수 파일에
                포함됩니다.
              </p>
            </details>
          </aside>
          <PlanReview readonly={readonly} saveReview={saveReview} selected={selected} model={model} rows={planRows} setRows={setPlanRows} onNode={openDetail} onSource={(id,file,address) => {
            setModuleFocus({file,address});
            openDetail(id); setLiveFile("terraform/"+file); setCompareFile(false);
            if(viewer.current) viewer.current.open=true;
            requestAnimationFrame(()=>viewer.current?.scrollIntoView({block:"nearest"}));
          }}/>
          <DesignFragments model={model} notes={notes} save={saveFragment} insert={change} selected={selected} readonly={readonly}/>
          {model.sources.length>0 && <details className="arch-review-issues"><summary>Terraform 편집 범위</summary>
            {model.sources.map(source=><details key={source.name}><summary>{source.name}</summary>
              {model.nodes.filter(n=>n.sourceFile===source.name).map(n=><div key={n.id}>
                <button onClick={()=>openDetail(n.id)}>{n.address}</button>
                <p>{Object.keys(n.props).length ? "편집 가능 속성 · "+Object.keys(n.props).join(", ") : "원문 보존"}
                {n.placementSource && " · 배치 참조 편집 가능"}</p>
                {(n.placementUnknown || n.unresolvedReferences?.length) ? <p>미해석 참조 · {n.unresolvedReferences?.join(", ") || n.placementValue}</p> : null}
              </div>)}
              {source.preservedDeclarations?.map(decl=><p key={decl}>원문 보존 · {decl}</p>)}
              {!source.name.includes("/") && !source.preservedDeclarations && <p>기타 선언은 원문 보존 · 다시 가져오면 선언별 목록이 표시됩니다.</p>}
              {source.name.includes("/") && <p>로컬 모듈 파일 · 원문 보존</p>}
            </details>)}</details>}
          <details className="arch-review-issues" open={impactOpen} onToggle={event => setImpactOpen(event.currentTarget.open)}>
            <summary>변경 영향</summary>
            {impactOpen && <ArchitectureImpact placement={lastPlacement} before={openingModel.current} after={model} original={initialFiles}
              files={result.files} errors={result.errors} onNode={openDetail} onFile={path => {
                setLiveFile(path); setCompareFile(true);
                if (viewer.current) { viewer.current.open = true; viewer.current.scrollIntoView({block:"nearest"}); }
              }}/>}
          </details>
          <details className="arch-review-issues">
            <summary>설계 이슈 ({issues.length})</summary>
            {api.checkTerraform && <button onClick={async()=>{
              try{const report=await api.checkTerraform!(model);if(report)setCliReport({model,message:report.tool+" validate · "+(report.valid?"통과":"확인 필요"),rows:report.diagnostics});}catch(e){setError(String(e));}
            }}>로컬 Terraform 검증</button>}
            {cliReport?.model===model && <div>{cliReport.message}{cliReport.rows.map((d,i)=><button key={i} onClick={()=>{
              const target=model.nodes.find(n=>terraformAddress(n)===d.address || (n.sourceFile===d.file && n.sourceLine===d.line));
              if(target)openDetail(target.id);else if(d.file)setLiveFile("terraform/"+d.file);
            }}>{d.file} {d.line||""} · {d.message}</button>)}</div>}
            {issues.length === 0 && <p>발견된 이슈가 없습니다.</p>}
            {issues.map((issue, i) => <button key={i} onClick={() => openDetail(issue.id)}>
              {model.nodes.find(n => n.id === issue.id)?.label} · {issue.message}
            </button>)}
          </details>
        <details open ref={viewer} className="terraform-live">
          <summary>Terraform 뷰어</summary>
          {livePath && (
            <>
              <select
                aria-label="Terraform 파일"
                value={livePath}
                onChange={(e) => setLiveFile(e.target.value)}
              >
                {terraformFiles.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              {declaration && livePath === nodeCodePath && <div className="tf-address">
                <code title={livePath+" · "+declaration.address}>{livePath} · {declaration.address}</code>
                <button type="button" aria-label="Terraform 주소 복사" title="Terraform 주소 복사" onClick={async()=>{
                  try {await navigator.clipboard.writeText(declaration.address);setStatus("Terraform 주소를 복사했습니다.");}
                  catch {setStatus("클립보드에 접근할 수 없습니다.");}
                }}><Copy size={14}/></button>
              </div>}
              {moduleFocus && livePath === "terraform/"+moduleFocus.file && <div>
                <strong>{moduleFocus.address}</strong>
                <pre aria-label="모듈 리소스 선언">{moduleDeclarationPreview(model.sources.find(s=>s.name===moduleFocus.file),moduleFocus.address)}</pre>
              </div>}
              {declarations.length > 0 && (
                <details ref={resourceCode}>
                  <summary>리소스별 코드</summary>
                  <label>
                    Terraform 선언
                    <select
                      aria-label="Terraform 선언"
                      value={declaration?.id || ""}
                      onChange={(e) => openDetail(e.target.value,model,true)}
                    >
                      <option value="" disabled>
                        리소스 선택
                      </option>
                      {declarations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.address}
                        </option>
                      ))}
                    </select>
                  </label>
                  {declaration && (
                    <button type="button" className="code-jump" onClick={() => openDetail(declaration.id)}>
                      캔버스에서 보기 <span aria-hidden="true">↗</span>
                    </button>
                  )}
                  {declaration && (
                    <pre tabIndex={-1} aria-label="선택한 Terraform 선언">
                      {typeof declaration.block === "string"
                        ? declaration.block
                        : JSON.stringify(declaration.block, null, 2)}
                    </pre>
                  )}
                </details>
              )}
              {parameters.length > 0 && (
                <details>
                  <summary>변수 · 로컬 값 · 출력 ({parameters.length})</summary>
                  {parameters.map((p) => (
                    <details key={p.kind + "." + p.name}>
                      <summary>{p.kind + "." + p.name}</summary>
                      <pre>{JSON.stringify(p.value, null, 2)}</pre>
                    </details>
                  ))}
                </details>
              )}
              <div className="live-file-actions">
                <button type="button" aria-pressed={codeOnly} onClick={()=>setCodeOnly(!codeOnly)}>{codeOnly ? "속성 함께 보기" : "코드 크게 보기"}</button>
                <button type="button" onClick={async () => {
                  try { await navigator.clipboard.writeText(result.files[livePath]); setStatus("현재 파일을 복사했습니다."); }
                  catch { setStatus("클립보드에 접근할 수 없습니다."); }
                }}>현재 파일 복사</button>
                <button type="button" aria-pressed={compareFile} onClick={() => setCompareFile(!compareFile)}>변경 줄 보기</button>
                {terraformFiles.filter(path => path !== livePath && path.endsWith("/zz_xdocs_override.tf.json")).map(path =>
                  <button key={path} onClick={() => setLiveFile(path)}>변경 오버라이드 보기</button>)}
              </div>
              {!compareFile && focused && site && sites.some(s => s.file === site.file && s.line === site.line) && livePath === "terraform/" + site.file &&
                <div className="reference-location">{site.file}:{site.line} · {site.property}</div>}
              {compareFile ? <div aria-label="페이지를 열었을 때와 비교">
                {!fileChanges ? <p>파일이 커서 변경 줄 비교 시간을 초과했습니다.</p> :
                  fileChanges.some(part => part.added || part.removed) ?
                    <pre>{fileChanges.filter(part => part.added || part.removed).map((part, i) =>
                      <span key={i} className={part.added ? "live-added" : "live-removed"}>{part.value.replace(/^./gm, line => (part.added ? "+ " : "− ") + line)}</span>)}</pre>
                    : <p>페이지를 열었을 때와 같습니다.</p>}
              </div> : <pre aria-label="Terraform 코드">
                <code>{site && focused && sites.some(s => s.file === site.file && s.line === site.line) && livePath === "terraform/" + site.file ? result.files[livePath].split("\n").map((line,i,lines) => <span key={i}>{i+1 === site.line ? <mark title={site.property}>{line}</mark> : line}{i < lines.length-1 ? "\n" : ""}</span>) : codeLines.map(part=>typeof part==="string"?part:<button type="button" key={part.number} className="declaration-line" data-declaration={part.id} aria-current={part.id===selected ? "location" : undefined}
                   title="캔버스에서 선언 선택" onClick={()=>{openDetail(part.id,model,true);focusNode(part.id);}}>{part.line}</button>)}</code>
              </pre>}
            </>
          )}
          {result.errors.map((message: string) => (
            <p key={message} role="status">
              {message}
            </p>
          ))}
          {!livePath && !result.errors.length && (
            <p>표시할 Terraform 파일이 없습니다.</p>
          )}
        </details>
          </div>
        </div>
      )}
      {tab === "code" && (
        <section className="arch-export">
          <div className="infra-actions">
            <select
              aria-label="아키텍처 추출 형식"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {[
                ["all", "전체 묶음"],
                ["terraform", "Terraform (.tf.json / 원본 .tf)"],
                ["cloudformation", "AWS CloudFormation"],
                ["manifest", "Kubernetes manifest"],
                ["helm", "Helm chart"],
              ].map(([v, t]) => (
                <option value={v} key={v}>
                  {t}
                </option>
              ))}
            </select>
            <label>
              <input
                type="checkbox"
                checked={only}
                disabled={!node}
                onChange={(e) => setOnly(e.target.checked)}
              />
              선택 컴포넌트 + 의존 대상
            </label>
            <button
              className="button primary"
              disabled={!!result.errors.length}
              onClick={() => void download()}
            >
              <Download size={15} />
              코드 ZIP 내보내기
            </button>
          </div>
          {result.errors.map((e, i) => (
            <p role="alert" key={i}>
              {e}
            </p>
          ))}
          {result.warnings.map((e, i) => (
            <p className="small-text muted" key={i}>
              {e}
            </p>
          ))}
          <p className="small-text muted">
            계획과 배포는 실행하지 않습니다. 추출 후 Terraform validate, Helm
            lint와 대상 환경 검토를 진행하세요.
          </p>
          <div className="infra-actions">
            <button
              className="button"
              aria-expanded={comparison}
              onClick={() => setComparison(!comparison)}
            >
              IaC 변경 비교
            </button>
            {comparison && (
              <>
                <small>
                  비교 기준 · {customBase ? "지정한 시점" : "페이지를 연 시점"}
                </small>
                <button
                  className="text-button"
                  disabled={!!result.errors.length}
                  onClick={() => {
                    setBaseline(model);
                    setCustomBase(true);
                  }}
                >
                  현재 설계를 기준으로 지정
                </button>
              </>
            )}
          </div>
          {comparison && (
            <IacDiff
              baseline={baseline}
              format={format}
              ids={only && node ? [node.id] : []}
              files={result.files}
              errors={result.errors}
            />
          )}
          {!comparison && activeFile && (
            <div className="arch-code">
              <nav>
                {fileNames.map((n) => (
                  <button
                    className={n === activeFile ? "active" : ""}
                    key={n}
                    onClick={() => setFile(n)}
                  >
                    {n}
                  </button>
                ))}
              </nav>
              <div>
                <header>
                  <strong>{activeFile}</strong>
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          result.files[activeFile],
                        );
                        setStatus("코드를 복사했습니다.");
                      } catch {
                        setError("클립보드에 접근할 수 없습니다.");
                      }
                    }}
                  >
                    <Copy size={14} />
                    복사
                  </button>
                </header>
                <pre aria-label="생성 코드">{result.files[activeFile]}</pre>
              </div>
            </div>
          )}
        </section>
      )}
      {tab === "review" && (
        <section className="arch-review">
          <ModuleContractReview />
          <h2>Well-Architected 설계 검토</h2>
          <p>
            AVM 사용은 전체 워크로드의 WAF 준수나 인증을 의미하지 않습니다. 자동
            합격 점수 대신 근거와 남은 검토 사항을 기록합니다.
          </p>
          {architectureReview(model).map((p) => (
            <article key={p.id}>
              <h3>{p.label}</h3>
              <p>{p.prompt}</p>
              {p.observations.map((o: string) => (
                <p className="arch-observation" key={o}>
                  {o}
                </p>
              ))}
              <textarea
                aria-label={p.label + " 검토 기록"}
                placeholder="설계 결정, 근거, 검토 담당자와 후속 작업…"
                readOnly={readonly}
                value={p.note}
                onChange={(e) =>
                  change({
                    ...model,
                    review: { ...model.review, [p.id]: e.target.value },
                  })
                }
              />
            </article>
          ))}
          <a
            href="https://learn.microsoft.com/azure/well-architected/"
            target="_blank"
            rel="noreferrer"
          >
            Microsoft Well-Architected Framework
          </a>
        </section>
      )}
    </section>
  );
}
