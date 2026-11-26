import { readXcodeDefaults } from "./XcodeDefaults";
import { chatCompletionsEndpoint, sameChatEndpoint } from "../desktop/builder-model.mjs";
import WorkspaceMaterial,{type MaterialAction} from "./WorkspaceMaterial";
import type {WorkspaceAccess} from "./workspace-input";
import { usePaneHeight } from "./usePaneHeight";
import {formInstruction, inspectForm, templateFiles} from "./office-form";
import OfficeForm from "./OfficeForm";
import SessionSettingsJson from "./SessionSettingsJson";
import ChatTimeline from "./ChatTimeline";
import { ArrowUp, ChevronRight, Ellipsis, Maximize2, Minimize2, Paperclip, SkipForward, SlidersHorizontal, Square } from "lucide-react";
import WordSelection from "./WordSelection";
import ProjectInputs from "./ProjectInputs";
import {
  fileKey, restoreFileKey, loadCheckpoint, readApplicationDraft, type ApplicationDraft,
  saveCheckpoint,
  saveProgress,
  clearCheckpoint, clearDispatch, recordDispatch,
  type Checkpoint, type QueuedPrompt,
} from "./xcode-checkpoint";
import {
  diagnosticFailure,
  testXcodeConnection,
  type Probe,
} from "./xcode-diagnostic";
import {
  acquireServer,
  serverOrigin,
  setCapacity,
  useCapacity,
} from "./xcode-queue";
import { queuePauseLabel, sessionRun, waitForRetry } from "./xcode-run";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useMemo,
  useSyncExternalStore,
  useState,
  type KeyboardEvent,
} from "react";
import { api } from "./api";
import type { ModelProfile } from "./types";
import {
  documentInput,
  jobRoles,
  roleInstruction,
  fresh,
  preset,
  templateGroups,
  validHarness,
  type Harness,
  type Session,
  type SessionSettingsDraft,
  type SessionSettingsPatch,
  type InputFile,
  type Turn,
} from "./xcode-session";

function chatErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "")
    .replace(/^\[XCODE_RETRY\] /, "");
}

async function userMessage(prompt: string, files: InputFile[]) {
  const content: unknown[] = [{ type: "text", text: prompt }];
  for (const f of files) {
    if ("text" in f) {
      content.push({ type: "text", text: f.name + "\n" + f.text + (f.sources?.length ? "\n근거를 인용할 때 [파일명#시트!셀] 또는 [파일명#문단 번호] 형식을 사용하세요. 예: ["+f.name+"#"+f.sources[0].place+"]" : "") });
      continue;
    }
    const a = await api.readAttachment!(f.path);
    if (a.data.length > 16 * 1024 * 1024)
      throw Error("이미지·PDF 첨부는 파일당 12MB 이하여야 합니다.");
    const url = "data:" + a.mime + ";base64," + a.data;
    if (f.kind === "image")
      content.push({ type: "image_url", image_url: { url } });
    else if (f.kind === "pdf")
      content.push({
        type: "file",
        file: { filename: f.name, file_data: url },
      });
    else throw Error("이 첨부는 문서·코드 파일 선택으로 불러오세요.");
  }
  return { role: "user", content: files.length ? content : prompt };
}

function RetryLimit({ label, value, max, disabled, commit }: {
  label: string; value: number; max: number; disabled: boolean; commit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return <label>{label}<input type="number" min={1} max={max} step={1}
    disabled={disabled} value={draft ?? value}
    onChange={event => {
      const input = event.target.value;
      setDraft(input);
      const number = Number(input);
      if (input.trim() && Number.isFinite(number)) {
        const next = Math.max(1, Math.min(max, Math.round(number)));
        if (next !== value) commit(next);
      }
    }}
    onBlur={() => setDraft(null)}
  /></label>;
}

export default function Xcode({
  session: s,
  local,
  scope,
  page,
  prepare,
  finish, folders, defaultFolder, savePage, access, focusTurn,appliedRecord,
  commitSettings,
  readonly,
}: {
  session: Session;
  local: boolean;
  scope: string;
  page: string;
  prepare: () => Promise<boolean>;
  finish: (t: Turn) => Promise<void>;
  access:WorkspaceAccess;
  appliedRecord?:import("./xcode-checkpoint").NoteApplication;
  focusTurn?:number;
  folders:{id:string;title:string}[];
  defaultFolder:string;
  savePage:(index:number,kind:"note"|"branch",title:string,parent:string)=>Promise<void>;
  commitSettings: (patch: SessionSettingsPatch) => Promise<boolean>;
  readonly: boolean;
}) {
  const [material,setMaterial]=useState<MaterialAction>();
  const mention=useRef<{start:number;end:number}|undefined>(undefined);
  const run = sessionRun(scope, page);
  const [settingsDraft, setSettingsDraft] = useState<SessionSettingsDraft>(() => run.settingsDraft ?? { patch: {} });
  const edited = { ...s, ...settingsDraft.patch };
  const updateDraft = (next: SessionSettingsDraft) => {
    run.settingsDraft = next;
    setSettingsDraft(next);
  };
  const dirty = !!Object.keys(settingsDraft.patch).length || !!settingsDraft.token || !!settingsDraft.capacity;
  const [jsonRevision, setJsonRevision] = useState(0);
  const [settingsTab, setSettingsTab] = useState<"connection" | "harness" | "retry" | "json">("connection");
  const { pending, busy, preview, phase, error, prompt, files, omitted, draftError, waiting, queuePaused, queueHeld, pauseReason, priorityItem, queueReady, submitting } =
    useSyncExternalStore(run.subscribe, run.snapshot);
  useEffect(()=>{if(run.snapshot().outcome)run.patch({outcome:""});},[run]);
  useEffect(()=>{void run.loadWaiting().catch(e=>run.patch({error:String(e)}));},[run]);
  const [editingItem,setEditingItem] = useState("");
  const [editedPrompt,setEditedPrompt] = useState("");
  const editedOrigin = serverOrigin(edited.endpoint);
  const endpoint = useMemo(() => {
    try { return chatCompletionsEndpoint(edited.endpoint); }
    catch { return undefined; }
  }, [edited.endpoint]);
  const editedAddress = endpoint?.href ?? "";
  const capacity = useCapacity(editedOrigin);
  const start = Math.max(
    0,
    s.turns.length - (s.harness.historyTurns ?? s.turns.length),
  );
  const candidates = s.turns.slice(start);
  const selected = (id: string) => !omitted.includes(id);
  const selectedFiles = files.filter((file) => selected(fileKey(file)));
  const selectedSkills = s.harness.skills.filter((k, i) =>
    selected("skill:" + i + ":" + k.name),
  );
  const effectiveHarness = { ...s.harness, skills: selectedSkills };
  const execution = {
    configuration: effectiveHarness,
    model: s.model,
    harness: s.harness.name,
    skills: selectedSkills.map((k) => k.name),
  };
  function inclusion(id: string, label: string) {
    return (
      <label key={id}>
        <input
          type="checkbox"
          checked={selected(id)}
          onChange={(e) =>
            run.patch({
              omitted: e.target.checked
                ? omitted.filter((k) => k !== id)
                : [...omitted, id],
            })
          }
        />
        {label}
      </label>
    );
  }
  const setPrompt = (prompt: string) => run.patch({ prompt });
  const setFiles = (fn: InputFile[] | ((v: InputFile[]) => InputFile[])) =>
    run.patch({
      files: typeof fn === "function" ? fn(run.snapshot().files) : fn,
    });
  const setError = (error: string) => run.patch({ error });
  const formHarness = ["Word 양식 작성안", "Excel 양식 입력안"].includes(s.harness.name);
  const [documentPanel, setDocumentPanel] = useState<"form" | "word" | null>(formHarness ? "form" : null);
  useEffect(() => setDocumentPanel(formHarness || run.snapshot().formReview ? "form" : null), [formHarness, s.harness.name]);
  const sessionSettingsId = useId();
  const queueMenuId = useId();
  const queueKeysId = useId();
  const queueDetails = useRef<HTMLDetailsElement>(null);
  const attachmentMenu = useRef<HTMLDivElement>(null);
  const attachmentPicker = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(
    () => !(s.connectionSource === "default" && s.turns.length === 0) &&
      localStorage.getItem("xdocs.xcode.settings") === "shown",
  );
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const settingsExpandButton = useRef<HTMLButtonElement>(null);
  const previousTranscriptTop = useRef<number | undefined>(undefined);
  const globalConnection = readXcodeDefaults();
  const baseline = globalConnection ?? fresh();
  const usesDefaults = (session: Session) => sameChatEndpoint(session.endpoint, baseline.endpoint) &&
    session.model === baseline.model && session.profile === baseline.profile;
  const matchesDefaults = usesDefaults(s);
  const connectionLabel = matchesDefaults && s.connectionSource !== "custom"
    ? globalConnection ? "기본 연결 사용" : "앱 기본 연결"
    : s.connectionSource === "default" ? "이전 기본 연결" : "세션에서 재정의";
  useLayoutEffect(() => {
    const panel = settingsDialog.current;
    if (!panel) return;
    if (!showSettings) {
      if (panel.open) panel.close();
      return;
    }
    if (panel.open && panel.matches(":modal") !== settingsExpanded) panel.close();
    if (!panel.open) {
      if (settingsExpanded) panel.showModal();
      else panel.show();
    }
    if (!settingsExpanded && previousTranscriptTop.current !== undefined) {
      const top = previousTranscriptTop.current;
      previousTranscriptTop.current = undefined;
      requestAnimationFrame(() => {
        const transcript = workbench.current?.querySelector(".chat-scroll");
        if (transcript) transcript.scrollTop = top;
        settingsExpandButton.current?.focus({ preventScroll: true });
      });
    }
  }, [showSettings, settingsExpanded]);
  const [skillQuery, setSkillQuery] = useState("");
  const draftToken = settingsDraft.token ?? run.sessionToken;
  const key = draftToken.value;
  const tokenNeedsApproval = Boolean(key && editedOrigin && draftToken.origin !== editedOrigin);
  const [savingKey, setSavingKey] = useState(false);
  const currentConnection = useRef({ session: s });
  currentConnection.current = { session: s };
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => {mounted.current = false;}; }, []);

  const [profiles, setProfiles] = useState<ModelProfile[]>([]),
    [skills, setSkills] = useState<
      { scope: string; name: string; instruction: string }[]
    >([]);
  useEffect(() => {
    api
      .builderProfiles?.()
      .then(setProfiles)
      .catch((e) => run.patch({ error: String(e) }));
  }, [run]);
  const [settingsSave, setSettingsSave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [settingsError, setSettingsError] = useState("");
  function config(patch: SessionSettingsPatch, token?: { value: string; origin: string }) {
    const current = run.settingsDraft ?? settingsDraft;
    const next = { ...current.patch, ...patch };
    if (["endpoint", "model", "profile"].some(field => Object.hasOwn(patch, field)) &&
        !patch.connectionSource) next.connectionSource = "custom";
    updateDraft({ ...current, patch: next, ...(token ? { token } : {}) });
    setSettingsSave("idle");
    setSettingsError("");
  }
  function setKey(value: string, endpoint = edited.endpoint) {
    config({}, { value, origin: serverOrigin(endpoint) });
  }
  function closeSettings() {
    previousTranscriptTop.current = undefined;
    setSettingsExpanded(false);
    setShowSettings(false);
    localStorage.setItem("xdocs.xcode.settings", "hidden");
    requestAnimationFrame(() => composerRef.current?.focus({ preventScroll: true }));
  }
  const workbench = useRef<HTMLDivElement>(null);
  usePaneHeight(workbench);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (settingsSave !== "saved") return;
    const timer = window.setTimeout(() => setSettingsSave("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [settingsSave]);
  async function saveSettings() {
    if (readonly || busy || savingKey || settingsSave === "saving") return;
    if (tokenNeedsApproval) {
      setSettingsTab("connection");
      setSettingsError("새 주소에서 사용할 토큰을 확인하세요.");
      return;
    }
    setSettingsSave("saving");
    setSettingsError("");
    const snapshot = run.settingsDraft ?? settingsDraft;
    try {
      const ok = !Object.keys(snapshot.patch).length || await commitSettings(snapshot.patch);
      if (!mounted.current) return;
      setSettingsSave(ok ? "saved" : "failed");
      if (!ok) return;
      if (snapshot.token) run.sessionToken = snapshot.token;
      if (snapshot.capacity) setCapacity(snapshot.capacity.origin, snapshot.capacity.value);
      updateDraft({ patch: {} });
      setJsonRevision(value => value + 1);
      closeSettings();
    } catch {
      if (mounted.current) setSettingsSave("failed");
    }
  }
  function cancelSettings() {
    updateDraft({ patch: {} });
    setSettingsSave("idle");
    setSettingsError("");
    setSettingsTab("connection");
    setJsonRevision(value => value + 1);
    setReport(undefined);
    closeSettings();
  }
  const savedDefaultToken = Boolean(
    globalConnection && matchesDefaults && s.connectionSource !== "custom" &&
    profiles.some(profile => profile.name === s.profile && profile.hasKey &&
      profile.model === s.model && sameChatEndpoint(profile.endpoint, s.endpoint)),
  );
  const linkedProfile = profiles.find(p => p.name === edited.profile);
  const savedProfile = linkedProfile && linkedProfile.model === edited.model && sameChatEndpoint(linkedProfile.endpoint, edited.endpoint) ? linkedProfile : undefined;
  async function rememberToken() {
    if (!api.saveXcodeProfile || !key || !editedOrigin || tokenNeedsApproval || savingKey) return;
    setSavingKey(true);
    try {
      const name = (edited.model.trim().slice(0,50) || "xcode") + " · " + crypto.randomUUID();
      const next = await api.saveXcodeProfile({
        name, endpoint: edited.endpoint, model: edited.model, key, remember: true,
      });
      if (!mounted.current) return;
      setProfiles(next);
      config({ profile: name }, { value: "", origin: editedOrigin });
    } catch (cause) {
      if (mounted.current) setSettingsError(chatErrorMessage(cause));
    } finally {
      if (mounted.current) setSavingKey(false);
    }
  }
  function tokenReady(session: Session = currentConnection.current.session) {
    const savedToken = run.sessionToken;
    if (!savedToken.value || savedToken.origin === serverOrigin(session.endpoint)) return true;
    setShowSettings(true);
    setSettingsTab("connection");
    setError("새 서버에서 사용할 토큰을 확인하고 세션 설정을 저장하세요.");
    return false;
  }
  const harness = (patch: Partial<Harness>) =>
    config({ harness: { ...edited.harness, ...patch } });
  const [search,setSearch]=useState(""), [candidate,setCandidate]=useState("");
  const matches=(value:string)=>value.toLowerCase().includes(search.trim().toLowerCase());
  const [importing, setImporting] = useState(false);
  async function attach(selected: File[]) {
    if (readonly || importing) return;
    setImporting(true);
    setError("");
    try {
      const next: InputFile[] = [];
      for (const file of selected) {
        if (/\.(png|jpe?g|webp|gif|pdf)$/i.test(file.name)) {
          if (!api.xcodeAttachment || file.size > 12 * 1024 * 1024)
            throw Error("데스크톱에서 12MB 이하 이미지 또는 PDF를 선택하세요.");
          next.push(
            await api.xcodeAttachment({
              name: file.name,
              bytes: new Uint8Array(await file.arrayBuffer()),
            }),
          );
        } else {
          const input = await documentInput(file);
          if (/\.docx$/i.test(file.name)) templateFiles.set(input,file);
          next.push(input);
        }
      }
      setFiles((v) => [...v, ...next]);
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }
  const [probe, setProbe] = useState<Probe>("text");
  const [report, setReport] = useState<{ target: "basic" | "advanced"; text: string }>();
  useEffect(() => setReport(undefined), [edited.endpoint, edited.model, edited.profile, key]);
  async function diagnose(kind: Probe, target: "basic" | "advanced") {
    if (run.snapshot().busy || !api.xcodeChat || readonly) return;
    if (tokenNeedsApproval || savingKey) {
      setReport({ target, text: savingKey ? "토큰을 저장하고 있습니다." : "인증 · 변경한 서버에서 입력한 토큰을 사용할지 선택하세요." });
      return;
    }
    const id = crypto.randomUUID();
    const controller = new AbortController();
    run.id = id;
    run.request = controller;
    run.patch({ busy: true, phase: "연결 진단", error: "" });
    setReport(undefined);
    try {
      const text = await testXcodeConnection({
        profile: edited.profile,
        endpoint: edited.endpoint,
        model: edited.model,
        key,
      }, kind, id, controller.signal);
      setReport({ target, text });
    } catch (error) {
      setReport({ target, text: controller.signal.aborted ? "연결 테스트를 중지했습니다." : diagnosticFailure(error) });
    } finally {
      run.request = null;
      run.id = "";
      run.patch({ busy: false, phase: "" });
    }
  }
  const checkpointKey = JSON.stringify([scope, page]);
  const [applicationDraft,setApplicationDraft]=useState<ApplicationDraft>();
  useEffect(()=>{
    let current=true;
    void readApplicationDraft(checkpointKey).then(draft=>{if(current)setApplicationDraft(draft);}).catch(e=>setError(String(e)));
    return ()=>{current=false;};
  },[checkpointKey]);
  function applyToNotes(answer:string,turn:number,runId?:string,citations?:string[]){
    if(applicationDraft && (applicationDraft.origin.turn!==turn || applicationDraft.origin.answer!==answer)){
      setMaterial({kind:"apply",...applicationDraft.origin});return;
    }
    setMaterial({kind:"apply",answer,turn,runId,citations});
  }
  const [recovery, setRecovery] = useState<Checkpoint>();
  const [recoveryReady, setRecoveryReady] = useState(!local);
  useEffect(() => {
    let active = true;
    if (local && !busy)
      loadCheckpoint(checkpointKey)
        .then(async checkpoint => {
          if (!active) return;
          const completed = checkpoint && s.turns.some(turn => turn.runId === checkpoint.id);
          if (completed) {
            await clearCheckpoint(checkpointKey);
            if (active && run.snapshot().pauseReason === "unconfirmed") run.patch({ pauseReason: undefined });
          }
          if (active) {
            const recoveryItem = completed ? "" : checkpoint?.id || "";
            if (run.snapshot().recoveryItem !== recoveryItem) run.patch({ recoveryItem });
            setRecovery(completed ? undefined : checkpoint);
            setRecoveryReady(true);
          }
        })
        .catch(e => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [local, checkpointKey, busy, s.turns.length, run]);
  const textBytes = useMemo(
    () =>
      new Blob([
        prompt,
        roleInstruction(s.harness.jobRole),
        ...s.harness.stages,
        ...selectedSkills.map((k) => k.instruction),
        ...selectedFiles.map((f) => ("text" in f ? f.text : "")),
        ...candidates.flatMap((t, i) =>
          selected("turn:" + (start + i))
            ? [
                t.prompt,
                t.answers.at(-1)?.text ?? "",
                ...t.files.map((f, j) =>
                  selected("prior:" + (start + i) + ":" + j) && "text" in f
                    ? f.text
                    : "",
                ),
              ]
            : [],
        ),
      ]).size,
    [prompt, s.harness, s.turns, files, omitted],
  );
  const [repair,setRepair]=useState<{id:string;skip:string[];files:number[]}|null>(null);
  const visibleQueue = waiting.filter(item => item.id !== run.activeItem);
  const interrupted = !busy && (run.snapshot().failedInput || recovery);
  const interruptedId = interrupted ? interrupted.id : undefined;
  const needsDeliveryReview = !busy && Boolean(recovery?.unconfirmed && !run.snapshot().failedInput);
  const reviewText = "서버가 이 요청을 처리했을 수 있습니다. 서버에서 결과를 확인한 뒤 다시 보내세요.";
  const retryLabel = needsDeliveryReview ? "확인 후 재시도" : "이 메시지 재시도";
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchIds, setBatchIds] = useState<Set<string>>(() => new Set());
  const selectedQueueIds = new Set(visibleQueue.filter(item => item.id !== interruptedId && batchIds.has(item.id)).map(item => item.id));
  const targetChanged = (item:QueuedPrompt) => item.model !== s.model || !sameChatEndpoint(item.endpoint, s.endpoint);
  const nextWaiting = visibleQueue.find(item => item.id !== interruptedId);
  const nextPreview = nextWaiting?.prompt.trim().split(/\r?\n/, 1)[0] || "첨부 메시지";
  const queuedFailure = Boolean(interrupted && waiting.some(item => item.id === interrupted.id));
  const queueRows = waiting.filter(item => item.id !== run.activeItem || item.id === priorityItem);
  const nextOnStop = !readonly && phase !== "연결 진단" && nextWaiting && !targetChanged(nextWaiting);
  const needsConnection = /HTTP (401|403|404|407)|인증서|프록시|API 주소|모델명|토큰을 확인/.test(error);
  const errorIssue = /사용량 또는 요청 한도|HTTP 429/.test(error) ? "사용량 또는 요청 한도에 도달함" :
    /연결이 (중단|끊겼)|연결할 수 없|도달할 수 없|응답 시간이 초과|서버 일시 오류/.test(error) ? "모델 연결이 끊김" :
    needsConnection ? "모델 연결 설정 확인 필요" : "";
  const queueIssue = nextWaiting && targetChanged(nextWaiting) ? "모델 또는 API 주소가 변경됨" :
    needsDeliveryReview ? queuePauseLabel("unconfirmed") : queuePauseLabel(pauseReason) || errorIssue;
  const canSendWaiting = (item: QueuedPrompt) =>
    recoveryReady && !readonly && !interrupted && !targetChanged(item) && editingItem !== item.id && item.id !== run.activeItem &&
    phase !== "연결 진단" && settingsSave !== "saving" && queueReady && !submitting;
  useEffect(() => {
    if (queuedFailure && queueDetails.current) queueDetails.current.open = true;
  }, [queuedFailure, interruptedId]);

  function openQueueConnection() {
    setSettingsTab("connection");
    setShowSettings(true);
  }
  function toggleQueuePause() {
    const { busy, queueHeld } = run.snapshot();
    if (!queueHeld) {
      void run.holdQueue().catch(e => setError(String(e)));
      return;
    }
    run.patch({ queueHeld: false });
    if (!busy && !interrupted) void resumeQueue().catch(e => setError(String(e)));
  }
  async function editSelectedQueue(action: "remove" | "up" | "down") {
    if (readonly || run.snapshot().submitting || !selectedQueueIds.size) return;
    await run.updateWaiting(items => {
      const locked = (item: QueuedPrompt) => item.id === run.activeItem || item.id === interruptedId;
      const selected = (item: QueuedPrompt) => !locked(item) && selectedQueueIds.has(item.id);
      if (action === "remove") return items.filter(item => !selected(item));
      const queue = [...items];
      const direction = action === "up" ? -1 : 1;
      for (let index = direction < 0 ? 1 : queue.length - 2;
          index >= 0 && index < queue.length; index -= direction) {
        const other = index + direction;
        if (!queue[other] || !selected(queue[index]) || locked(queue[other]) || selected(queue[other])) continue;
        [queue[index], queue[other]] = [queue[other], queue[index]];
      }
      return queue;
    });
    if (action === "remove") setBatchIds(new Set());
  }
  function handleQueueKeys(event: KeyboardEvent<HTMLElement>, item: QueuedPrompt) {
    const modifier = event.ctrlKey || event.metaKey;
    if (event.key === "Enter" && modifier && canSendWaiting(item)) {
      event.preventDefault();
      void sendWaitingNow(item.id).catch(e => setError(String(e)));
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const direction = event.key === "ArrowUp" ? -1 : 1;
    event.preventDefault();
    const current = event.currentTarget;
    if (modifier) {
      if (readonly) return;
      void moveWaiting(item.id, direction).then(() => {
        if (document.activeElement === document.body && current.isConnected) current.focus();
      }).catch(e => setError(String(e)));
      return;
    }
    const items = Array.from(queueDetails.current?.querySelectorAll<HTMLElement>(".queue-select") ?? []);
    items[items.indexOf(current) + direction]?.focus();
  }
  async function stopCurrent() {
    const activeId = run.id;
    if (!activeId) return;
    await run.settled();
    if (run.id !== activeId) return;
    const next = run.snapshot().waiting.find(item => item.id !== run.activeItem);
    const sendNext = !readonly && run.activeItem && next && !targetChanged(next);
    if (sendNext) run.patch({ queueHeld: false });
    run.cancel(sendNext ? "continue" : "pause");
  }
  async function sendWaitingNow(id: string) {
    if (readonly || interrupted || !recoveryReady || phase === "연결 진단" || run.snapshot().submitting ||
        settingsSave === "saving" || !queueReady) return;
    const activeId = run.id;
    let prioritized = false;
    run.patch({ submitting: true });
    try {
      await run.updateWaiting(items => {
        const next = items.find(item => item.id === id);
        if (!next || next.id === run.activeItem || targetChanged(next)) return items;
        prioritized = true;
        return [next, ...items.filter(item => item.id !== id)];
      });
    } finally {
      run.patch({ submitting: false });
    }
    if (!prioritized) return;
    run.patch({ priorityItem: run.snapshot().waiting.some(item => item.id === id) ? id : "", queueHeld: false });
    if (queueDetails.current) queueDetails.current.open = true;
    if (activeId && run.id === activeId && run.activeItem) run.cancel("continue");
    else if (!run.snapshot().busy && !run.snapshot().failedInput) await resumeQueue();
  }
  async function moveWaiting(id:string, direction:number) {
    await run.updateWaiting(items => {
      const index = items.findIndex(item => item.id === id);
      const other = index + direction;
      if (!items[index] || !items[other] || [items[index].id,items[other].id].some(key => key === run.activeItem || key === interruptedId)) return items;
      const next = [...items];
      [next[index],next[other]] = [next[other],next[index]];
      return next;
    });
  }
  function checkpointMatches(item:QueuedPrompt,saved:Checkpoint){
    const h=item.useCurrentHarness || !item.harness?s.harness:item.harness;
    const skills=h.skills.filter((k,i)=>!item.omitted.includes("skill:"+i+":"+k.name));
    return JSON.stringify({...h,skills})===JSON.stringify(saved.harness);
  }
  async function retryInterrupted() {
    if (!interrupted || readonly || run.snapshot().busy) return;
    const item = waiting.find(entry => entry.id === interrupted.id) || run.snapshot().failedInput;
    if (item && targetChanged(item)) {setError("먼저 이 메시지의 모델과 서버 주소를 확인하세요.");return;}
    const saved = recovery?.id === interrupted.id && recovery.model === s.model && sameChatEndpoint(recovery.endpoint, s.endpoint) && (!item || (item.prompt === recovery.prompt && checkpointMatches(item,recovery))) ? recovery : undefined;
    if (saved || item) await send(saved,item);
    else if (recovery) await send(recovery);
  }
  async function skipInterrupted() {
    if (!interrupted || readonly || run.snapshot().busy || run.snapshot().submitting) return;
    run.patch({ submitting: true });
    try {
      await removeWaiting(interrupted.id);
      run.patch({failedInput:undefined,error:"",pending:null,preview:""});
    } finally {run.patch({ submitting: false });}
    await resumeQueue();
  }
  const currentInput = { s, prompt, selectedFiles, execution };
  async function removeWaiting(id:string) {
    if (run.activeItem===id) return;
    if (local && !run.snapshot().busy && (recovery?.id===id || run.snapshot().failedInput?.id===id)) {
      await clearCheckpoint(checkpointKey);
      setRecovery(undefined);
    }
    await run.updateWaiting(items=>items.filter(i=>i.id!==id || run.activeItem===id));
    if (run.snapshot().failedInput?.id===id) run.patch({failedInput:undefined});
  }
  async function resumeQueue() {
    if (readonly || run.snapshot().busy) return;
    const queued=run.snapshot().waiting[0];
    if (!queued || !tokenReady()) return;
    const saved=local ? await loadCheckpoint(checkpointKey) : undefined;
    if (run.snapshot().busy || run.snapshot().waiting[0]?.id!==queued.id) return;
    if (saved?.unconfirmed && !s.turns.some(turn => turn.runId === saved.id)) {
      setRecovery(saved);
      run.patch({ queuePaused: true, pauseReason: "unconfirmed" });
      return;
    }
    run.patch({queuePaused:false,queueHeld:false,pauseReason:undefined});
    if (saved?.id===queued.id && saved.prompt===queued.prompt && saved.model===queued.model && sameChatEndpoint(saved.endpoint, queued.endpoint) && checkpointMatches(queued,saved) && !s.turns.some(t=>t.runId===queued.id))
      await send(saved,queued);
    else await drain(s);
  }
  function consumeInput(text:string, attached:InputFile[]) {
    const draft=run.snapshot();
    run.patch({prompt:draft.prompt===text ? "" : draft.prompt,
      files:draft.files.filter(file=>!attached.includes(file))});
  }
  async function submit(immediate=false) {
    if (!api.xcodeChat || readonly || importing || run.snapshot().submitting || settingsSave === "saving" ||
        !queueReady || !recoveryReady || needsDeliveryReview) return;
    if (!run.snapshot().busy && !run.snapshot().waiting.length) { void send(); return; }
    if (!run.activeItem) run.patch({queuePaused:true});
    if (!prompt.trim() && !selectedFiles.length) return;
    const item:QueuedPrompt={id:crypto.randomUUID(),prompt,files:selectedFiles,
      templates:selectedFiles.map(f=>templateFiles.get(f)),omitted:[...omitted],endpoint:s.endpoint,model:s.model,harness:structuredClone(s.harness)};
    run.patch({ submitting: true });
    try {
      const activeId=run.id;
      await run.updateWaiting(items=>immediate ? [item,...items] : [...items,item]);
      if (immediate && activeId && run.id === activeId) {
        run.patch({ queueHeld: false });
        run.cancel("continue");
      }
      consumeInput(prompt,selectedFiles);
    } catch(e) {setError("대기 메시지를 저장하지 못했습니다. "+String(e));}
    finally {run.patch({ submitting: false });}
  }
  async function drain(session:Session) {
    await run.settled();
    const state = run.snapshot();
    if (state.busy || state.queuePaused || state.queueHeld || readonly) return;
    const item=state.waiting[0];
    if (!item) return;
    if (session.turns.some(turn=>turn.runId===item.id)) {
      await run.updateWaiting(items=>items.filter(i=>i.id!==item.id));
      return drain(session);
    }
    if (!sameChatEndpoint(item.endpoint, session.endpoint) || item.model!==session.model) {
      run.patch({queuePaused:true,error:"대기 메시지를 추가할 때의 API 주소와 모델을 확인하세요."});
      return;
    }
    item.files.forEach((f,i)=>{if(item.templates[i]) templateFiles.set(f,item.templates[i]!);});
    await send(undefined,item,session);
  }
  async function send(saved?: Checkpoint,item?:QueuedPrompt,context?:Session) {
    if (!tokenReady(context || currentConnection.current.session)) {run.patch({queuePaused:true});return;}
    const requestKey = run.sessionToken.value;
    const {
      s: session,
      prompt: initialPrompt,
      selectedFiles: initialFiles,
      execution: initialExecution,
    } = currentInput;
    const base=context || session;
    const harness=saved?.harness || (!item?.useCurrentHarness && item?.harness) || currentConnection.current.session.harness;
    const s={...base,harness};
    const excluded=item?.omitted || omitted;
    const selected=(key:string)=>!excluded.includes(key);
    const start=Math.max(0,s.turns.length-(s.harness.historyTurns??s.turns.length));
    const candidates=s.turns.slice(start);
    const sourceHistory=saved ? saved.sourceHistory : candidates.flatMap((turn,i)=>
      selected("turn:"+(start+i)) ? turn.files.flatMap((file,j)=>
        "sources" in file && file.sources?.length && selected("prior:"+(start+i)+":"+j) ? [[start+i,j] as [number,number]] : []) : []);

    const selectedSkills=s.harness.skills.filter((k,i)=>selected("skill:"+i+":"+k.name));
    const prompt = saved?.prompt ?? item?.prompt ?? initialPrompt,
      selectedFiles = saved?.files ?? item?.files ?? initialFiles;
    const execution = saved
      ? {
          model: saved.model,
          harness: saved.harness.name,
          skills: saved.harness.skills.map((k) => k.name),
          configuration: saved.harness,
        }
      : item ? {...initialExecution,model:s.model,harness:s.harness.name,skills:selectedSkills.map(k=>k.name),
        configuration:{...s.harness,skills:selectedSkills}} : initialExecution;
    if (saved && (s.model !== saved.model || !sameChatEndpoint(s.endpoint, saved.endpoint))) {
      setError("복구하려면 저장 당시 모델과 서버 주소를 선택하세요.");
      return;
    }
    if (
      !api.xcodeChat ||
      run.snapshot().busy ||
      readonly ||
      (!prompt.trim() && !selectedFiles.length)
    )
      return;
    const id = saved?.id ?? item?.id ?? crypto.randomUUID();
    run.activeItem=id;
    if (!item && !saved) consumeInput(prompt,selectedFiles);
    let continuation:Session|undefined;
    run.id = id;
    run.patch({outcome:"",queuePaused:false,pauseReason:undefined,recoveryItem:"",failedInput:undefined});
    run.enabled = s.autoRetry === true;
    run.patch({
      pending: {
        prompt,
        files: selectedFiles.map((f) => f.name),
        index: s.turns.length,
      },
      busy: true,
      preview: "",
      phase: "",
      error: "",
    });
    let checkpoint: Checkpoint | undefined,
      uncertainAttempt = false,
      lastWrite = 0;
    const off = api.onXcodeDelta?.((c) => {
      if (run.id === c.id) {
        run.patch({ preview: run.snapshot().preview + c.token });
        if (checkpoint && Date.now() - lastWrite > 1000) {
          lastWrite = Date.now();
          void saveProgress(checkpointKey, {
            id: checkpoint.id,
            answers: [...checkpoint.answers],
            partial: run.snapshot().preview,
          }).catch((e) => setError(String(e)));
        }
      }
    });
    try {
      await run.draftSaved();
      if (!(await prepare())) throw Error("세션을 먼저 저장해 주세요.");
      if (!s.harness.stages.every((i) => i.trim()))
        throw Error("빈 단계에 지침을 입력하세요.");
      if (!(await api.xcodeAuthorize?.(s.endpoint)))
        throw Error("모델 서버 전송을 취소했습니다.");
      if (run.id !== id) throw Error("요청을 중지했습니다.");
      const history: unknown[] = [];
      let historyBytes = 0;
      for (const [i, t] of (saved ? [] : candidates).entries()) {
        if (!selected("turn:" + (start + i))) continue;
        if (run.id !== id) throw Error("요청을 중지했습니다.");
        const prior = await userMessage(
          t.prompt,
          t.files.filter((_, j) => selected("prior:" + (start + i) + ":" + j)),
        );
        historyBytes += new Blob([
          JSON.stringify(prior),
          t.answers.at(-1)?.text || "",
        ]).size;
        if (historyBytes > 32 * 1024 * 1024)
          throw Error("하네스에서 포함할 이전 대화 수를 줄이세요.");
        history.push(prior, {
          role: "assistant",
          content: t.answers.at(-1)?.text || "",
        });
      }
      const formRequest = /채워|채우|작성해|작성하|기입|입력해|fill|populate|complete/i.test(prompt)
        || (/양식|서식|템플릿|template|form/i.test(prompt) && !/요약|번역|summari[sz]e|translate/i.test(prompt));
      let form = !item && !saved && documentPanel === "form" && (formRequest || !run.snapshot().formReview)
        ? run.snapshot().form : undefined;
      let evidence = selectedFiles;
      if (!saved && formRequest) {
        const pathMatch = prompt.match(/(?:^|[\s"'`(])((?:[A-Za-z]:[\\/]|\/)[^"`'\r\n]*?\.docx)\b/i);
        const candidates = selectedFiles.filter(f => templateFiles.has(f));
        const named = candidates.filter(f => prompt.includes(f.name));
        const likely = candidates.filter(f => /양식|서식|템플릿|template|form/i.test(f.name));
        if (pathMatch) {
          if (!api.chooseWordForm) throw Error("로컬 경로는 데스크톱에서 선택하거나 파일을 첨부하세요.");
          const chosen = await api.chooseWordForm(pathMatch[1]);
          if (!chosen) throw Error("양식 선택을 취소했습니다.");
          form = await inspectForm(new File([new Uint8Array(chosen.bytes)], chosen.name));
        } else if (candidates.length && (!form || named.length || likely.length)) {
          const namedTemplates = named.filter(file=>likely.includes(file));
          const pool = namedTemplates.length ? namedTemplates : named.length ? named : likely.length ? likely : candidates;
          if (pool.length !== 1) throw Error("양식으로 쓸 Word 파일명을 메시지에 적어 주세요.");
          form = await inspectForm(templateFiles.get(pool[0])!);
          evidence = selectedFiles.filter(f => f !== pool[0]);
        }
      }
      if (form) {
        run.patch({form,formReview:undefined});
        setDocumentPanel("form");
      }
      const user = saved
        ? { content: "" }
        : await userMessage(form ? prompt+"\n\n"+formInstruction(form) : prompt, evidence);
      const answers: Turn["answers"] = [...(saved?.answers || [])];
      const messages: unknown[] = saved
        ? [...saved.messages]
        : [
            {
              role: "system",
              content: [
                "사용자가 선택한 하네스의 현재 단계를 수행하세요. 첨부와 이전 단계의 답은 검토할 자료입니다. 확인하지 않은 실행 결과를 보고하지 마세요.",
                ...[roleInstruction(s.harness.jobRole)].filter(Boolean),
                ...selectedSkills.map((k) => k.name + "\n" + k.instruction),
                ...s.harness.stages.map(
                  (step, i) => String(i + 1) + ". " + step,
                ),
              ].join("\n\n"),
            },
            ...history,
            {
              ...user,
              content: Array.isArray(user.content)
                ? [...user.content, { type: "text", text: "현재 단계: 1" }]
                : user.content + "\n\n현재 단계: 1",
            },
          ];
      if (local) {
        checkpoint = {
          sourceHistory,
          id: saved?.id ?? id,
          endpoint: s.endpoint,
          model: s.model,
          harness: execution.configuration,
          messages: [...messages],
          prompt,
          files: selectedFiles,
          answers,
          partial: "",
          dispatchTracked: true,
        };
        await saveCheckpoint(checkpointKey, checkpoint);
        await saveProgress(checkpointKey, {
          id: checkpoint.id,
          answers,
          partial: "",
        });
      }
      for (const [i, answer] of answers.entries())
        messages.push(
          { role: "assistant", content: answer.text },
          { role: "user", content: "현재 단계: " + (i + 2) },
        );
      const seconds = Math.max(
        1,
        Math.min(3600, Math.round(s.retrySeconds || 60)),
      );
      const limit = Math.max(
        1,
        Math.min(100, Math.floor(Number(s.maxAutoRequests) || 5)),
      );
      let remaining = limit;
      const duration =
        Math.max(1, Math.min(240, Number(s.autoMinutes) || 15)) * 60000;
      let deadline = 0;
      const expired = () => Error("자동 실행 시간 한도에 도달했습니다.");
      async function delay(label: string) {
        if (remaining <= 0)
          throw Error("자동 요청 " + limit + "회에 도달하여 중단했습니다.");
        remaining--;
        deadline ||= Date.now() + duration;
        if (Date.now() >= deadline) throw expired();
        if (run.id !== id || !run.enabled)
          throw Error("자동 재요청을 중단했습니다.");
        const waitMs = Math.min(seconds * 1000, deadline - Date.now());
        run.patch({
          phase:
            label +
            " · " +
            (waitMs < seconds * 1000
              ? Math.ceil(waitMs / 1000) + "초 후 시간 한도 도달"
              : seconds + "초 후 계속해주세요"),
        });
        run.wait = new AbortController();
        try {
          await waitForRetry(waitMs, run.wait.signal);
          if (Date.now() >= deadline) throw expired();
        } finally {
          run.wait = null;
        }
        if (!run.enabled || run.id !== id)
          throw Error("자동 재요청을 중단했습니다.");
      }
      async function ask(stage: string, i: number, automatic = false) {
        lastWrite = 0;
        run.patch({ preview: "", phase: stage });
        const effort = s.harness.stageEfforts?.[i] || s.harness.effort;
        let resume = "",
          retries = 0;
        for (;;) {
          if (run.id !== id) throw Error("요청을 중지했습니다.");
          const requestMessages = [...messages];
          if (retries && resume)
            requestMessages.push(
              { role: "assistant", content: resume },
              { role: "user", content: "계속해주세요" },
            );
          else if (retries) {
            const last = requestMessages.pop() as {
              role: string;
              content: unknown[] | string;
            };
            requestMessages.push({
              ...last,
              content:
                typeof last.content === "string"
                  ? last.content + "\n\n계속해주세요"
                  : [...last.content, { type: "text", text: "계속해주세요" }],
            });
          }
          const request = new AbortController();
          const timed = automatic || retries > 0;
          if (timed && Date.now() >= deadline) throw expired();
          run.request = request;
          run.automatic = timed;
          const timer = timed
            ? setTimeout(() => {
                request.abort(expired());
                void api.xcodeCancel?.(id);
              }, deadline - Date.now())
            : undefined;
          let release: (() => void) | undefined;
          try {
            run.patch({ phase: "서버 대기열 · " + stage });
            release = await acquireServer(serverOrigin(s.endpoint), request.signal);
            request.signal.throwIfAborted();
            if (checkpoint) await recordDispatch(checkpointKey, id, i);
            request.signal.throwIfAborted();
            run.patch({ phase: "실행 중 · " + stage });
            const answer = await api.xcodeChat!({
              id,
              key: requestKey,
              profile: s.profile,
              endpoint: s.endpoint,
              model: s.model,
              effort: effort === "server" ? undefined : effort,
              messages: requestMessages,
            });
            if (run.id !== id) throw Error("요청을 중지했습니다.");
            request.signal.throwIfAborted();
            return {
              text: resume + answer,
              effort: effort || "server",
              retries,
            };
          } catch (e) {
            request.signal.throwIfAborted();
            if (
              run.id !== id ||
              !run.enabled ||
              !String(e).includes("[XCODE_RETRY]")
            )
              throw e;
            uncertainAttempt = true;
            resume = run.snapshot().preview;
            release?.();
            release = undefined;
            clearTimeout(timer);
            await delay(stage);
            run.patch({ phase: stage + " · 이어서 요청 중" });
            retries++;
          } finally {
            release?.();
            clearTimeout(timer);
            run.request = null;
            run.automatic = false;
          }
        }
      }
      for (const [i, instruction] of s.harness.stages.entries()) {
        if (i < answers.length) continue;
        const started = performance.now();
        const result = await ask(
          "단계 " + (i + 1) + " / " + s.harness.stages.length,
          i,
        );
        messages.push(
          { role: "assistant", content: result.text },
          { role: "user", content: "현재 단계: " + (i + 2) },
        );
        answers.push({
          stage: instruction,
          ...result,
          elapsedMs: Math.round(performance.now() - started),
        });
        if (checkpoint)
          await saveProgress(checkpointKey, {
            id: checkpoint.id,
            answers,
            partial: "",
          });
        uncertainAttempt = false;
      }
      const next = {
        ...s,
        turns: [
          ...s.turns,
          { prompt, files: selectedFiles, answers, execution,sourceHistory },
        ],
      };
      if (new Blob([JSON.stringify(next)]).size > 4800000)
        throw Error("세션 저장 한도에 도달했습니다. 새 세션으로 이어가세요.");
      await finish({
        runId: checkpoint?.id ?? id, sourceHistory,
        prompt,
        files: selectedFiles,
        answers,
        execution,
      });
      if (checkpoint) {
        checkpoint = undefined;
        await clearCheckpoint(checkpointKey);
        setRecovery(undefined);
      }
      if (form && answers.length) run.patch({formReview:{id,text:answers[answers.length-1].text,
        files:[...(sourceHistory || []).flatMap(([ti,fi])=>s.turns[ti]?.files[fi] || []),...evidence]}});
      continuation={...base,turns:next.turns};
      if (run.snapshot().waiting.some(q=>q.id===id))
        await run.updateWaiting(items=>items.filter(q=>q.id!==id));
      if (saved && run.snapshot().prompt===saved.prompt) consumeInput(saved.prompt,saved.files);

      run.patch({ pending: null, preview: "" });
      const repeatSources=sourceHistory && [...sourceHistory,...selectedFiles.flatMap((f,j)=>
        "sources" in f && f.sources?.length ? [[s.turns.length,j] as [number,number]]:[])];
      let completed = s.turns.length + 1;
      messages.pop(); // No next harness stage after the final answer.
      while (run.id === id && run.enabled && s.repeatCompleted && !run.snapshot().waiting.length) {
        await delay("다음 대화 대기");
        if (run.snapshot().waiting.length) break;
        run.patch({
          pending: { prompt: "계속해주세요", files: [], index: completed },
        });
        messages.push({ role: "user", content: "계속해주세요" });
        const started = performance.now();
        const result = await ask(
          "자동 이어쓰기",
          s.harness.stages.length - 1,
          true,
        );
        await finish({
          execution,
          prompt: "계속해주세요",
          sourceHistory:repeatSources,
          files: [],
          answers: [
            {
              stage: "자동 이어쓰기",
              ...result,
              elapsedMs: Math.round(performance.now() - started),
            },
          ],
        });
        continuation.turns.push({prompt:"계속해주세요",sourceHistory:repeatSources,files:[],execution,answers:[{stage:"자동 이어쓰기",...result}]});
        completed++;
        messages.push({ role: "assistant", content: result.text });
        run.patch({ pending: null, preview: "" });
      }
    } catch (e) {
      if (run.steering===id) {
        const snap=run.snapshot();
        const partial=snap.preview;
        const partialTurn:Turn={runId:id,sourceHistory,prompt,files:selectedFiles,execution,
          answers:[...(checkpoint?.answers || []),{stage:"사용자가 이어서 요청",text:partial || "응답 수신 전 중단됨"}]};
        try {
          if(!continuation) await finish(partialTurn);
          if(local) await clearCheckpoint(checkpointKey);
          await run.updateWaiting(items=>items.filter(entry=>entry.id!==id));
          continuation=continuation || {...s,turns:[...s.turns,partialTurn]};
          setRecovery(undefined);
          run.patch({queuePaused:run.steering !== id,pauseReason:undefined,failedInput:undefined,pending:null,preview:"",error:""});
        } catch(saveError) {run.patch({queuePaused:true,error:String(saveError)});}
      } else {
        run.patch({queuePaused:true,failedInput:continuation ? undefined : item || {
          id,prompt,files:selectedFiles,templates:selectedFiles.map(f=>templateFiles.get(f)),
          omitted:[...excluded],model:s.model,endpoint:s.endpoint
        }});
        if (!continuation && !item && !saved && !run.snapshot().prompt && !run.snapshot().files.length)
          run.patch({prompt,files:selectedFiles});
        const message = chatErrorMessage(e);
        const quota = /사용량 또는 요청 한도|HTTP 429/.test(message);
        const disconnected = /연결이 (중단|끊겼)|연결할 수 없|도달할 수 없|응답 시간이 초과|서버 일시 오류/.test(message);
        if (quota && checkpoint && !uncertainAttempt) await clearDispatch(checkpointKey).catch(() => {});
        run.patch({
          pauseReason: quota ? "quota" : run.id !== id ? "stopped" : disconnected ? "connection" : undefined,
        });
        await run.controlSaved().catch(() => {});
        setError(run.id === id ? message : "요청을 중지했습니다.");
      }
    } finally {
      if(run.steering===id) run.steering="";
      run.patch({outcome:mounted.current || run.id!==id ? "" : run.snapshot().error ? "failed" : "complete"});
      off?.();
      await run.settled();
      run.activeItem="";
      run.patch({ busy: false, phase: "" });
      run.id = "";
      if (continuation && !run.snapshot().queuePaused)
        void drain(continuation).catch(e=>run.patch({queuePaused:true,error:String(e)}));
    }
  }
  return (
    <section
      className="builder-panel xcode"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          void attach(Array.from(e.dataTransfer.files));
        }
      }}
      onPaste={(e) => {
        const list = Array.from(e.clipboardData.files);
        if (list.length) {
          e.preventDefault();
          void attach(list);
        }
      }}
    >
      <header className="chat-header">
        <h2>xcode</h2>
        <span title={[s.model, s.endpoint].filter(Boolean).join(" · ")}>{s.model}</span>
        <small className="connection-source" title={s.endpoint}>
          {connectionLabel}{savedDefaultToken && " · 저장된 토큰 사용"}
        </small>
        {settingsSave === "saved" && <small aria-live="polite">세션 설정을 저장했습니다.</small>}
        <button
          className="chat-settings-toggle"
          aria-expanded={showSettings}
          aria-controls={sessionSettingsId}
          onClick={() => {
            setShowSettings(!showSettings);
            localStorage.setItem(
              "xdocs.xcode.settings",
              showSettings ? "hidden" : "shown",
            );
          }}
        >
          <SlidersHorizontal size={15} />
          {showSettings ? "세션 설정 접기" : "세션 설정 펼치기"}
        </button>
      </header>
      {local && recovery && !busy && !run.snapshot().failedInput && !waiting.length && (
        <fieldset disabled={readonly} className="recovery-review">
          <legend>{needsDeliveryReview ? "전송 결과 확인 필요" : "중단된 실행 복구"}</legend>
          {needsDeliveryReview && <p>{reviewText}</p>}
          <p>
            {recovery.prompt} · 완료 {recovery.answers.length}/
            {recovery.harness.stages.length}단계 · {recovery.model}
          </p>
          {recovery.partial && (
            <details>
              <summary>마지막 부분 응답</summary>
              <pre>{recovery.partial}</pre>
            </details>
          )}
          <button onClick={() => void send(recovery)}>
            {recovery.answers.length === recovery.harness.stages.length
              ? "완료 결과 저장"
              : needsDeliveryReview ? "확인 후 미완료 단계 재실행" : "미완료 단계부터 재실행"}
          </button>
          <button
            onClick={() =>
              void clearCheckpoint(checkpointKey)
                .then(() => {
                  setRecovery(undefined);
                  run.patch({ pauseReason: undefined, recoveryItem: "" });
                })
                .catch((e) => setError(String(e)))
            }
          >
            복구 기록 삭제
          </button>
        </fieldset>
      )}
      {run.snapshot().form && documentPanel!=="form" && !readonly && <button className="application-resume" onClick={()=>setDocumentPanel("form")}>Office 검토 초안 열기</button>}
      <div hidden={documentPanel !== "form"}><OfficeForm sessionKey={checkpointKey} form={run.snapshot().form} review={run.snapshot().formReview} setForm={form=>run.patch({form,formReview:undefined})} close={()=>setDocumentPanel(null)} disabled={busy||readonly} answer={s.turns.at(-1)?.answers.at(-1)?.text||""}
        answerFiles={[...(s.turns.at(-1)?.sourceHistory || []).flatMap(([ti,fi])=>s.turns[ti]?.files[fi] || []),...(s.turns.at(-1)?.files || [])]} prepare={text=>setPrompt([prompt,text].filter(Boolean).join("\n\n"))}/></div>
      {local && api.wordCapture && <div hidden={documentPanel !== "word"}>
        <WordSelection close={()=>setDocumentPanel(null)} disabled={busy || readonly}
          answer={s.turns.at(-1)?.answers.at(-1)?.text || ""}
          attach={(name,text)=>setFiles(previous=>[...previous,{name,text}])}/>
      </div>}
      <div className="chat-layout" data-settings={showSettings && !settingsExpanded}>
        <dialog id={sessionSettingsId} className="chat-settings-panel" ref={settingsDialog} aria-label="세션 설정"
          onKeyDown={event => { if (settingsExpanded && event.key === "Escape") event.stopPropagation(); }}
          onCancel={event => { event.preventDefault(); setSettingsExpanded(false); }}>
          <nav className="session-settings-nav" aria-label="세션 설정 항목">
            {([
              ["connection", "연결"], ["harness", "하네스·스킬"], ["retry", "자동 요청"], ["json", "JSON"],
            ] as const).map(([id, label]) => (
              <button type="button" key={id} aria-pressed={settingsTab === id} onClick={() => {
                setSettingsTab(id);
                settingsDialog.current?.querySelector(".chat-settings-fields")?.scrollTo(0, 0);
              }}>{label}</button>
            ))}
          </nav>
          <div className="chat-settings-fields" inert={settingsSave === "saving"}>
            <div hidden={settingsTab !== "connection"}>
        <fieldset className="chat-basic-settings" disabled={busy || readonly || savingKey}>
          <legend>모델 연결</legend>
          {globalConnection && !usesDefaults(edited) && <button type="button" className="button small" onClick={() => {
            setKey("");
            setError("");
            config({ ...globalConnection, connectionSource: "default" });
          }}>기본 연결로 되돌리기</button>}
          <label>
            API 주소
            <input
              placeholder="https://server.example/v1/chat/completions"
              value={edited.endpoint}
              onChange={e => config({endpoint:e.target.value})}
            />
            {editedAddress && editedAddress !== edited.endpoint.trim() && (
              <small>실제 요청 주소 · {editedAddress}</small>
            )}
          </label>
          <label>
            API 토큰 (선택)
            <input
              type="password"
              autoComplete="off"
              value={key}
              placeholder={savedProfile?.hasKey ? "이 기기에 저장된 토큰 사용" : undefined}
              onChange={(e) => setKey(e.target.value)}
            />
            <small className="token-status" aria-live="polite">{tokenNeedsApproval ? "새 주소에서 사용 승인 필요" : key ? "이번 세션에서만 사용" : savedProfile?.hasKey ? "이 기기에 저장됨" : linkedProfile?.hasKey ? "저장된 토큰은 기존 주소와 모델에 연결되어 있습니다." : "저장된 토큰 없음"}</small>
          </label>
          <label>
            모델명
            <input
              value={edited.model}
              onChange={e => config({model:e.target.value})}
            />
          </label>
          <div className="token-storage">
            {tokenNeedsApproval && editedOrigin && <button type="button" onClick={() => {setKey(key);setError("");}}>
              {editedOrigin}에서 이 토큰 사용
            </button>}
            {key && api.saveXcodeProfile && <button type="button" disabled={tokenNeedsApproval || !editedOrigin || !edited.model.trim()} onClick={() => void rememberToken()}>
              이 기기에 토큰 저장
            </button>}
          </div>
          {api.xcodeChat && <div className="basic-connection-test">
            <button type="button" onClick={() => void diagnose("text", "basic")}>연결 테스트</button>
            {report?.target === "basic" && <small role="status">{report.text}</small>}
          </div>}
        </fieldset>
              <details className="chat-connection-options">
                <summary>연결 옵션</summary>
          <fieldset disabled={busy || readonly}>
            <legend>연결 옵션</legend>
            {profiles.length > 0 && (
              <label>
                저장된 모델
                <select
                  value={savedProfile?.name || ""}
                  onChange={(e) => {
                    const p = profiles.find((x) => x.name === e.target.value);
                    setKey("");
                    config(
                      p
                        ? {
                            profile: p.name,
                            model: p.model,
                            endpoint: p.endpoint,
                          }
                        : { profile: "" },
                    );
                  }}
                >
                  <option value="">직접 입력</option>
                  {profiles.map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              서버 동시 요청 수
              <select
                disabled={!editedOrigin}
                value={settingsDraft.capacity?.origin === editedOrigin ? settingsDraft.capacity.value : capacity}
                onChange={(e) => updateDraft({ ...settingsDraft, capacity: { origin: editedOrigin, value: Number(e.target.value) } })}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              연결 진단 입력
              <select
                value={probe}
                onChange={(e) => { setProbe(e.target.value as Probe); setReport(undefined); }}
              >
                <option value="text">짧은 텍스트</option>
                <option value="image">샘플 이미지</option>
                <option value="pdf">샘플 PDF</option>
              </select>
            </label>
            <button
              disabled={!api.xcodeChat || !edited.model.trim() || !editedOrigin}
              onClick={() => void diagnose(probe, "advanced")}
            >
              연결 진단 실행
            </button>
            {report?.target === "advanced" && <p role="status">{report.text}</p>}
          </fieldset>
              </details>
            </div>
            <div hidden={settingsTab !== "harness"}>
            <fieldset disabled={busy || readonly}>
              <legend>직무 역할 · 단계 및 스킬</legend>
              <label>역할 또는 템플릿 찾기<input type="search" placeholder="백엔드, 장애 회고 등" value={search} onChange={e=>{setSearch(e.target.value);setCandidate("");}}/></label>
              {search.trim() && <small aria-live="polite">검색 결과 · 역할 {jobRoles.filter(role=>matches(role.group+" "+role.name)).length}개 · 템플릿 {Object.entries(templateGroups).reduce((count,[group,items])=>count+Object.keys(items).filter(name=>matches(group+" "+name)).length,0)}개</small>}
              <label>
                직무 역할
                <select
                  aria-label="직무 역할"
                  value={edited.harness.jobRole ?? ""}
                  onChange={(e) => harness({ jobRole: jobRoles.find((role) => role.name === e.target.value)?.name })}
                >
                  <option value="">역할 없음</option>
                  {[...new Set(jobRoles.map((role) => role.group))].map((group) => (
                    <optgroup key={group} label={group}>
                      {jobRoles.filter((role) => role.group === group && (role.name===edited.harness.jobRole || matches(group+" "+role.name))).map((role) => (
                        <option key={role.name}>{role.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {edited.harness.jobRole && <p>{jobRoles.find((role) => role.name === edited.harness.jobRole)?.instruction}</p>}
              <label>
                템플릿 적용
                <select
                  value={candidate}
                  onChange={(e) => setCandidate(e.target.value)}
                >
                  <option value="" disabled>
                    템플릿 선택
                  </option>
                  {Object.entries(templateGroups).map(([group, items]) => (
                    <optgroup key={group} label={group}>
                      {Object.entries(items).filter(([name])=>name===candidate||matches(group+" "+name)).map(([name, stages]) => (
                        <option key={name} value={name}>{name} · {stages.length}단계</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {candidate&&<div className="harness-preview"><strong>{candidate}</strong><ol>{preset(candidate).stages.map(step=><li key={step}>{step}</li>)}</ol><button onClick={()=>{config({harness:{...preset(candidate),jobRole:edited.harness.jobRole}});setCandidate("");}}>전체 단계 적용</button></div>}
              <label>
                하네스 이름
                <input
                  value={edited.harness.name}
                  onChange={(e) => harness({ name: e.target.value })}
                />
              </label>
              <label>
                추론 강도
                <select
                  value={edited.harness.effort || ""}
                  onChange={(e) => harness({ effort: e.target.value })}
                >
                  <option value="">서버 기본값</option>
                  {["low", "medium", "high", "xhigh", "max"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                포함할 이전 대화 수
                <select
                  value={edited.harness.historyTurns ?? "all"}
                  onChange={(e) =>
                    harness({
                      historyTurns:
                        e.target.value === "all"
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                >
                  <option value="all">전체 대화</option>
                  {[0, 2, 5, 10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}개
                    </option>
                  ))}
                </select>
              </label>
              {edited.harness.stages.map((stage, i) => (
                <div key={i}>
                  <label>
                    단계 {i + 1}
                    <textarea
                      value={stage}
                      onChange={(e) =>
                        harness({
                          stages: edited.harness.stages.map((v, j) =>
                            j === i ? e.target.value : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    단계 {i + 1} 추론 설정
                    <select
                      value={edited.harness.stageEfforts?.[i] || ""}
                      onChange={(e) =>
                        harness({
                          stageEfforts: edited.harness.stages.map((_, j) =>
                            i === j
                              ? e.target.value
                              : edited.harness.stageEfforts?.[j] || "",
                          ),
                        })
                      }
                    >
                      <option value="">하네스 설정 사용</option>
                      <option value="server">서버 기본값</option>
                      {["low", "medium", "high", "xhigh", "max"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={!i}
                    onClick={() => {
                      const stages = [...edited.harness.stages];
                      [stages[i - 1], stages[i]] = [stages[i], stages[i - 1]];
                      const efforts = [
                        ...(edited.harness.stageEfforts || stages.map(() => "")),
                      ];
                      [efforts[i - 1], efforts[i]] = [
                        efforts[i],
                        efforts[i - 1],
                      ];
                      harness({ stages, stageEfforts: efforts });
                    }}
                  >
                    위로
                  </button>
                  <button
                    disabled={edited.harness.stages.length === 1}
                    onClick={() =>
                      harness({
                        stages: edited.harness.stages.filter((_, j) => j !== i),
                        stageEfforts: edited.harness.stageEfforts?.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                  >
                    단계 삭제
                  </button>
                </div>
              ))}
              <button
                disabled={edited.harness.stages.length >= 12}
                onClick={() =>
                  harness({
                    stages: [...edited.harness.stages, ""],
                    stageEfforts: edited.harness.stageEfforts && [
                      ...edited.harness.stageEfforts,
                      "",
                    ],
                  })
                }
              >
                단계 추가
              </button>
              <button
                onClick={async () => {
                  try {
                    const list = (await api.xcodeSkills?.()) || [];
                    setSkills(list);
                    setError(
                      list.length
                        ? ""
                        : "사용자·워크스페이스의 .claude/skills에서 SKILL.md를 찾지 못했습니다.",
                    );
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                .claude 스킬 찾기
              </button>
              {skills.length > 0 && (
                <label>
                  스킬 검색
                  <input
                    value={skillQuery}
                    onChange={(e) => setSkillQuery(e.target.value)}
                  />
                </label>
              )}
              {skills
                .filter((k) =>
                  (k.scope + " " + k.name + " " + k.instruction)
                    .toLowerCase()
                    .includes(skillQuery.toLowerCase()),
                )
                .map((k) => (
                  <button
                    key={k.scope + k.name}
                    disabled={edited.harness.skills.some(
                      (x) =>
                        x.name === k.name && x.instruction === k.instruction,
                    )}
                    onClick={() =>
                      harness({
                        skills: [
                          ...edited.harness.skills,
                          { name: k.name, instruction: k.instruction },
                        ],
                      })
                    }
                  >
                    {k.scope} · {k.name} 추가
                  </button>
                ))}
              {edited.harness.skills.map((k, i) => (
                <button
                  key={i}
                  onClick={() =>
                    harness({
                      skills: edited.harness.skills.filter((_, j) => i !== j),
                    })
                  }
                >
                  {k.name} 제거
                </button>
              ))}
              <button
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(edited.harness, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "xcode-harness.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                하네스 내보내기
              </button>
              <label>
                하네스 가져오기
                <input
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    try {
                      if (!f) return;
                      if (f.size > 200000)
                        throw Error("200KB 이하 파일을 선택하세요.");
                      const h = JSON.parse(await f.text());
                      if (!validHarness(h))
                        throw Error("하네스 형식이 올바르지 않습니다.");
                      config({ harness: h });
                    } catch (err) {
                      setError(String(err));
                    }
                  }}
                />
              </label>
            </fieldset>
            </div>
            <div hidden={settingsTab !== "retry"}>
          <fieldset disabled={readonly || busy}>
            <legend>자동 재요청</legend>
            <label className="retry-toggle">
              <input
                type="checkbox"
                checked={edited.autoRetry === true}
                onChange={(e) => config({ autoRetry: e.target.checked })}
              />
              자동 재요청 켜기
            </label>
            {edited.autoRetry && <>
            <label>
              재요청 방식
              <select
                disabled={busy}
                value={edited.repeatCompleted ? "repeat" : "failure"}
                onChange={(e) =>
                  config({ repeatCompleted: e.target.value === "repeat" })
                }
              >
                <option value="failure">중단된 응답만 이어받기</option>
                <option value="repeat">정상 완료 후에도 계속 요청</option>
              </select>
            </label>
            <RetryLimit label="자동 실행 한도(분)" value={edited.autoMinutes ?? 15} max={240} disabled={busy} commit={autoMinutes=>config({autoMinutes})}/>
            <RetryLimit label="자동 요청 한도(회)" value={edited.maxAutoRequests ?? 5} max={100} disabled={busy} commit={maxAutoRequests=>config({maxAutoRequests})}/>
            <RetryLimit label="재요청 간격(초)" value={edited.retrySeconds ?? 60} max={3600} disabled={busy} commit={retrySeconds=>config({retrySeconds})}/>
            </>}
          </fieldset>
            </div>
            <div hidden={settingsTab !== "json"}>
        <SessionSettingsJson
          key={jsonRevision}
          session={edited}
          disabled={busy || readonly}
          apply={(settings, token) => config(
            { ...settings, ...(token === undefined ? {} : { profile: "" }) },
            token === undefined ? undefined : { value: token, origin: serverOrigin(settings.endpoint) },
          )}
        />
            </div>
          </div>
        <div className="session-settings-save">
          <button type="button" className="settings-expand" ref={settingsExpandButton}
            aria-label={settingsExpanded ? "확대 설정 닫기" : "세션 설정 크게 보기"}
            title={settingsExpanded ? "확대 설정 닫기" : "세션 설정 크게 보기"}
            onClick={() => {
              if (!settingsExpanded)
                previousTranscriptTop.current = workbench.current?.querySelector(".chat-scroll")?.scrollTop;
              setSettingsExpanded(!settingsExpanded);
            }}>
            {settingsExpanded ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
          </button>
          <small className="settings-draft-state" aria-live="polite">{dirty ? "저장하지 않은 변경" : ""}</small>
          <button type="button" disabled={savingKey || settingsSave === "saving"} onClick={cancelSettings}>설정 취소</button>
          <button type="button" disabled={busy || readonly || savingKey || settingsSave === "saving" || !dirty} onClick={() => void saveSettings()}>
            {settingsSave === "saving" ? "저장 중…" : "설정 저장"}
          </button>
          {(settingsError || settingsSave === "failed") && <small role="alert">
            {settingsError || "세션 설정을 저장하지 못했습니다. 다시 시도하세요."}
          </small>}
        </div>
        </dialog>
      <div className="chat-workbench" ref={workbench}>
        {busy && s.autoRetry && run.enabled && phase !== "연결 진단" && <button className="button small stop-automatic"
          type="button" onClick={() => {
            run.enabled = false;
            run.wait?.abort();
            if (run.automatic) {
              run.request?.abort(Error("자동 요청을 중지했습니다."));
              void api.xcodeCancel?.(run.id);
            }
            run.patch({ phase: "자동 요청 중지 중" });
          }}>자동 요청 중지</button>}
        <ChatTimeline
          focusTurn={focusTurn} appliedRecord={appliedRecord} workspacePages={access.notes}
          applyAnswer={applyToNotes}
          openHistory={()=>setMaterial({kind:"history"})}
          openOriginal={(origin,cited)=>void access.open(origin,cited).catch(e=>setError(String(e)))}
          reviewInput={file=>setMaterial({kind:"compare",file})}
          folders={folders} defaultFolder={defaultFolder} savePage={savePage}
          onQuote={text=>{setPrompt([prompt,text.split("\n").map(line=>"> "+line).join("\n")+"\n\n"].filter(Boolean).join("\n\n"));composerRef.current?.focus();}}
          reading={run.reading}
          turns={s.turns}
          preview={preview}
          phase={phase}
          pending={pending}
          error={error}
          busy={busy}
          readonly={readonly}
          applyHarness={h => {
            config({ harness: h });
            setSettingsTab("harness");
            setShowSettings(true);
          }}
        />
        {interrupted && !queuedFailure && (waiting.length > 0 || run.snapshot().failedInput) && <div className="queue-recovery" tabIndex={-1}>
          <strong>{needsDeliveryReview ? "전송 결과 확인 필요" : "중단된 메시지"}</strong><span>{interrupted.prompt}</span>
          {needsDeliveryReview && <small className="queue-review-note">{reviewText}</small>}
          {needsConnection && !nextWaiting && <button type="button" onClick={openQueueConnection}>설정 확인</button>}
          <button disabled={readonly} onClick={()=>void retryInterrupted().catch(e=>setError(String(e)))}>{retryLabel}</button>
          <button disabled={readonly} onClick={()=>void skipInterrupted().catch(e=>setError(String(e)))}>{visibleQueue.some(q=>q.id!==interrupted.id) ? "건너뛰고 다음 전송" : "건너뛰기"}</button>
        </div>}
        {applicationDraft && !readonly && <button className="application-resume" onClick={()=>setMaterial({kind:"apply",...applicationDraft.origin})}>노트 반영 초안 이어서 검토</button>}
        {material && <WorkspaceMaterial sessionKey={checkpointKey} resumeDraft={material.kind==="apply"?applicationDraft:undefined}
          draftChanged={setApplicationDraft} access={access} action={material} close={()=>{setMaterial(undefined);mention.current=undefined;}} attach={(file,original)=>{
          const draft=run.snapshot();
          const index=original?draft.files.indexOf(original):-1;
          const history:string[]=[];
          if(original && index>=0) restoreFileKey(file,fileKey(original));
          if(original?.workspace) s.turns.forEach((turn,i)=>turn.files.forEach((f,j)=>{
            if("workspace" in f && f.workspace?.page===original.workspace!.page &&
               JSON.stringify(f.workspace.selection)===JSON.stringify(original.workspace!.selection)) history.push("prior:"+i+":"+j);
          }));
          const token=mention.current;
          run.patch({files:index<0?[...draft.files,file]:draft.files.map((f,i)=>i===index?file:f),
            omitted:[...new Set([...draft.omitted,...history])],
            ...(token && draft.prompt.slice(token.start,token.end)==="@"?{prompt:draft.prompt.slice(0,token.start)+draft.prompt.slice(token.end)}:{})});
          requestAnimationFrame(()=>composerRef.current?.focus());
        }}/>}
        {queueRows.length > 0 && <details className="chat-waiting" ref={queueDetails}>
          <summary>
            <ChevronRight className="queue-chevron" size={13} aria-hidden="true" />
            <span>대기 메시지 {visibleQueue.length}개</span>
            {nextWaiting && <span className="queue-preview" title={nextPreview}>
              다음 · {nextPreview}
            </span>}
            {nextWaiting && nextWaiting.files.length > 0 && <small>첨부 {nextWaiting.files.length}개</small>}
            {queueHeld && <small>일시정지</small>}
          </summary>
          <small className="queue-keys" id={queueKeysId}>↑↓ 선택 · Ctrl/⌘+↑↓ 순서 변경 · Ctrl/⌘+Enter 전송</small>
          {!readonly && (visibleQueue.some(item => item.id !== interruptedId) || batchOpen) &&
            <section className="queue-batch" aria-label="대기 메시지 일괄 조작">
              <button type="button" aria-pressed={batchOpen} onClick={() => {
                setBatchOpen(!batchOpen);
                setBatchIds(new Set());
              }}>{batchOpen ? "선택 끝내기" : "여러 항목 선택"}</button>
              {batchOpen && <>
                <small>{selectedQueueIds.size}개 선택</small>
                {([["up", "선택 항목 위로"], ["down", "선택 항목 아래로"], ["remove", "선택 항목 취소"]] as const).map(([action, label]) =>
                  <button type="button" key={action} disabled={submitting || !selectedQueueIds.size}
                    onClick={() => void editSelectedQueue(action).catch(e => setError(String(e)))}>{label}</button>)}
              </>}
            </section>}
          {queueRows.map(q => {
            const index = visibleQueue.findIndex(item => item.id === q.id);
            const sending = busy && q.id === run.activeItem;
            const failed = q.id === interruptedId;
            return <div key={q.id} className={failed ? "queue-recovery" : undefined} tabIndex={failed ? -1 : undefined}>
            {batchOpen && !sending && !failed && <input type="checkbox" aria-label={(q.prompt.trim().slice(0, 60) || "첨부 메시지") + " 선택"}
              checked={selectedQueueIds.has(q.id)} onChange={event => {
                const selected = new Set(batchIds);
                if (event.target.checked) selected.add(q.id);
                else selected.delete(q.id);
                setBatchIds(selected);
              }} />}
            {editingItem===q.id ? <textarea aria-label="대기 메시지 수정" value={editedPrompt} onChange={e=>setEditedPrompt(e.target.value)}/>
              : <span className="queue-select" tabIndex={0} aria-describedby={queueKeysId}
                  onKeyDown={event => handleQueueKeys(event, q)}>{q.prompt || "첨부 메시지"}</span>}
            {q.files.length>0 && <small>{q.files.map(f=>f.name).join(" · ")}</small>}
            {sending ? <small aria-live="polite">전송 중</small> : <>
            {failed ? <small aria-live="polite">{needsDeliveryReview ? "전송 결과 확인 필요" : targetChanged(q)
              ? "모델 또는 API 주소가 변경됨" : queuePauseLabel(pauseReason) || errorIssue || "중단된 메시지"}</small> :
              priorityItem === q.id && busy && <small aria-live="polite">전송 준비 중</small>}
            <details className="queue-harness"><summary>실행 설정</summary>
              <small>{q.model}</small><label>하네스 <select disabled={readonly} aria-label="대기 메시지 하네스" value={q.harness && !q.useCurrentHarness?"saved":"current"} onChange={e=>{
                const current=e.target.value==="current";
                void run.updateWaiting(items=>items.map(i=>i.id===q.id && i.id!==run.activeItem?
                  {...i,harness:i.harness || structuredClone(s.harness),useCurrentHarness:current}:i)).catch(err=>setError(String(err)));
              }}><option value="saved">{q.harness?"등록 시 설정":"현재 구성 고정"}</option><option value="current">실행 시 세션 설정</option></select></label>
              {(()=>{const h=q.useCurrentHarness || !q.harness?s.harness:q.harness;return <><strong>{h.name} · {h.jobRole || "역할 미지정"}</strong><ol>{h.stages.map((stage,i)=><li key={i}>{stage}</li>)}</ol></>;})()}
            </details>
            {targetChanged(q) && <div className="queue-target">
              <span>등록 당시 {q.model} · {q.endpoint}</span>
              <span>현재 설정 {s.model} · {s.endpoint}</span>
              <button disabled={readonly || busy} onClick={()=>void run.updateWaiting(items=>items.map(i=>
                i.id===q.id && i.id!==run.activeItem ? {...i,model:s.model,endpoint:s.endpoint} : i
              )).catch(e=>setError(String(e)))}>이 메시지에 현재 설정 적용</button>
            </div>}
            {visibleQueue.length > 1 && <>
              <button aria-label="위로 이동" disabled={readonly || !index || q.id===interruptedId || visibleQueue[index-1]?.id===interruptedId} onClick={()=>void moveWaiting(q.id,-1).catch(e=>setError(String(e)))}>↑</button>
              <button aria-label="아래로 이동" disabled={readonly || index===visibleQueue.length-1 || q.id===interruptedId || visibleQueue[index+1]?.id===interruptedId} onClick={()=>void moveWaiting(q.id,1).catch(e=>setError(String(e)))}>↓</button>
            </>}
            <button disabled={readonly || (editingItem===q.id && !editedPrompt.trim() && !q.files.length)} onClick={()=>{
              if(editingItem!==q.id){setEditingItem(q.id);setEditedPrompt(q.prompt);return;}
              void run.updateWaiting(items=>items.map(i=>i.id===q.id && run.activeItem!==q.id ? {...i,prompt:editedPrompt}:i))
                .then(()=>setEditingItem("")).catch(e=>setError(String(e)));
            }}>{editingItem===q.id ? "수정 저장" : "수정"}</button>
            {failed ? <>
              {needsDeliveryReview && <small className="queue-review-note">{reviewText}</small>}
              {(needsConnection || targetChanged(q)) && !nextWaiting &&
                <button type="button" onClick={openQueueConnection}>설정 확인</button>}
              <button disabled={readonly || targetChanged(q)} onClick={() => void retryInterrupted().catch(e => setError(String(e)))}>{retryLabel}</button>
              <button disabled={readonly} onClick={() => void skipInterrupted().catch(e => setError(String(e)))}>{nextWaiting ? "건너뛰고 다음 전송" : "건너뛰기"}</button>
            </> : <>
              <button type="button" disabled={!canSendWaiting(q)}
                title={busy ? "현재 응답을 중지하고 이 메시지 전송" : "이 대기 메시지 전송"}
                onClick={() => void sendWaitingNow(q.id).catch(e => setError(String(e)))}>지금 보내기</button>
              <button disabled={readonly} onClick={() => void removeWaiting(q.id).catch(e => setError(String(e)))}>취소</button>
            </>}
            </>}
          </div>;
          })}
        </details>}
        {nextWaiting && (queueHeld || !busy && queuePaused) && <div className="queue-actions">
          {!busy && queueIssue && <small aria-live="polite">{queueIssue}</small>}
          {!busy && (needsConnection || targetChanged(nextWaiting)) &&
            <button type="button" onClick={openQueueConnection}>설정 확인</button>}
          {!interrupted && <button type="button" disabled={readonly} onClick={() => {
            if (busy) run.patch({ queueHeld: false });
            else void resumeQueue().catch(e => setError(String(e)));
          }}>대기열 재개</button>}
        </div>}
        {interrupted && /context|입력.{0,8}한도|토큰.{0,8}(한도|초과)|413|32MB|too (large|long)|maximum.{0,12}length|이전 대화 수/i.test(error) &&
          <details className="input-repair" onToggle={e=>{if(e.currentTarget.open && repair?.id!==interrupted.id)
            setRepair({id:interrupted.id,skip:[...(run.snapshot().failedInput?.omitted || [])],files:[]});}}>
            <summary>전송 범위 줄이기</summary>
            {repair?.id===interrupted.id && <>
              {candidates.map((t,i)=>{const key="turn:"+(start+i);return <label key={key}><input type="checkbox" checked={!repair.skip.includes(key)}
                onChange={e=>setRepair({...repair,skip:e.target.checked?repair.skip.filter(k=>k!==key):[...repair.skip,key]})}/>{t.prompt.slice(0,70)}</label>;})}
              {interrupted.files.map((f,i)=><label key={i}><input type="checkbox" checked={!repair.files.includes(i)}
                onChange={e=>setRepair({...repair,files:e.target.checked?repair.files.filter(k=>k!==i):[...repair.files,i]})}/>{f.name}</label>)}
              <button disabled={readonly || (!interrupted.prompt.trim() && repair.files.length===interrupted.files.length)} onClick={()=>{
                const original=waiting.find(q=>q.id===interrupted.id) || run.snapshot().failedInput;
                const item:QueuedPrompt={id:interrupted.id,prompt:interrupted.prompt,files:interrupted.files.filter((_,i)=>!repair.files.includes(i)),
                  templates:interrupted.files.map((f,i)=>original?.templates[i] || templateFiles.get(f)).filter((_,i)=>!repair.files.includes(i)),
                  harness:original?.harness,useCurrentHarness:original?.useCurrentHarness,omitted:repair.skip,endpoint:original?.endpoint || interrupted.endpoint,model:original?.model || interrupted.model};
                if(targetChanged(item)){setError("먼저 저장 당시 모델과 서버 주소를 선택하세요.");return;}
                void run.updateWaiting(items=>[item,...items.filter(q=>q.id!==item.id)]).then(async()=>{
                  if(local) await clearCheckpoint(checkpointKey);setRecovery(undefined);setRepair(null);
                  await send(undefined,item);
                }).catch(e=>setError(String(e)));
              }}>선택한 범위로 재시도</button>
            </>}
          </details>}
        <div className="chat-composer">
          {draftError && <small className="chat-keys" role="alert">{draftError}</small>}
          <textarea
            ref={composerRef}
            aria-label="xcode 메시지"
            placeholder="메시지를 입력하세요"
            rows={2}
            disabled={readonly}
            value={prompt}
            onChange={e=>{
              const value=e.target.value,end=e.target.selectionStart;
              setPrompt(value);
              if(value.length===prompt.length+1 && /(?:^|\s)@$/.test(value.slice(0,end))){
                mention.current={start:end-1,end};setMaterial({kind:"attach"});
              }
            }}
            onKeyDown={(e) => {
              if (
                e.key !== "Enter" ||
                e.shiftKey ||
                e.nativeEvent.isComposing ||
                e.nativeEvent.keyCode === 229
              )
                return;
              e.preventDefault();
              if (!e.repeat) void submit();
            }}
          />
            {busy && (
              <div className="chat-run-controls">
                <button type="button" className="chat-stop"
                  aria-label={nextOnStop ? "중지하고 다음 보내기" : "중지"}
                  title={nextOnStop ? "중지하고 다음 대기 메시지 전송" : "중지"}
                  onClick={() => void stopCurrent()}>
                  {nextOnStop ? <><SkipForward size={14} /> <span>다음 보내기</span></> : <Square size={14} />}
                </button>
                {!readonly && nextWaiting && phase !== "연결 진단" && <>
                  <button type="button" className="chat-queue-menu-toggle"
                    aria-label="응답 제어 메뉴" title="응답 제어 메뉴" popoverTarget={queueMenuId}><Ellipsis size={15} /></button>
                  <div id={queueMenuId} className="chat-queue-menu" popover="auto">
                    <button type="button" onClick={event => {
                      event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
                      toggleQueuePause();
                    }}>{queueHeld ? "이 세션 대기열 재개" : "이 세션 대기열 일시정지"}</button>
                  </div>
                </>}
              </div>
            )}
            {(!busy || prompt.trim() || selectedFiles.length>0) && (
              <button
                className="chat-submit"
                aria-label={busy || waiting.length ? "대기열에 추가" : "전송"}
                title={busy || waiting.length ? "대기열에 추가 (Enter)" : "전송 (Enter)"}
                disabled={
                  readonly ||
                  importing ||
                  settingsSave === "saving" ||
                  !queueReady ||
                  submitting ||
                  !recoveryReady ||
                  needsDeliveryReview ||
                  !api.xcodeChat ||
                  (!prompt.trim() && !selectedFiles.length)
                }
                onClick={() => void submit()}
              >
                <ArrowUp size={18} />
              </button>
            )}
          <div className="chat-options">
          <div className="chat-toolbar">
            {busy && (prompt.trim() || selectedFiles.length>0) && <details><summary>전송 옵션</summary>
              <button disabled={readonly || importing} onClick={()=>void submit(true)}>지금 이어서 요청</button>
            </details>}
            <button
              className="chat-attach"
              aria-label="파일 첨부"
              title="첨부 옵션"
              disabled={readonly || importing}
              popoverTarget="xcode-attachment-menu"
            >
              <Paperclip size={16} />
            </button>
            <div id="xcode-attachment-menu" popover="auto" ref={attachmentMenu} className="chat-attachment-menu">
              <button disabled={readonly} onClick={()=>{attachmentMenu.current?.hidePopover();setMaterial({kind:"attach"});}}>워크스페이스 페이지</button>
              <button disabled={readonly || importing} onClick={() => {
                attachmentMenu.current?.hidePopover();
                attachmentPicker.current?.click();
              }}>파일 첨부</button>
              <button disabled={busy || readonly} onClick={() => {
                attachmentMenu.current?.hidePopover();
                setDocumentPanel("form");
                requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".office-form input[type=file]")?.focus());
              }}>Word·Excel 양식 채우기</button>
              {local && api.wordCapture && <button disabled={busy || readonly} onClick={()=>{
                attachmentMenu.current?.hidePopover();
                setDocumentPanel("word");
                requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(".word-selection fieldset button")?.focus());
              }}>Word 선택 영역</button>}
            </div>
            <input
              ref={attachmentPicker}
              hidden
              aria-label="파일 첨부 선택"
              type="file"
              multiple
              disabled={importing}
              onChange={(e) => {
                const list = Array.from(e.target.files || []);
                e.target.value = "";
                void attach(list);
              }}
            />
            <fieldset disabled={busy || readonly} className="chat-project">
              <ProjectInputs
                onAdd={(added) => setFiles((v) => [...v, ...added])}
              />
            </fieldset>
            <details>
              <summary>전송 미리보기</summary>
              <p>
                선택 텍스트 {textBytes.toLocaleString()} 바이트 · 이미지·PDF
                전송량 별도
              </p>
              <p>
                {s.model} · {s.endpoint}
              </p>
              <p>
                이전 대화{" "}
                {
                  candidates.filter((_, i) => selected("turn:" + (start + i)))
                    .length
                }
                개 · 새 첨부 {selectedFiles.length}개 · 스킬{" "}
                {selectedSkills.length}개
              </p>
              {candidates.map((t, i) => (
                <div key={i}>
                  {inclusion(
                    "turn:" + (start + i),
                    "이전 요청 " +
                      (start + i + 1) +
                      " · " +
                      t.prompt.slice(0, 80),
                  )}
                  {selected("turn:" + (start + i)) &&
                    t.files.map((f, j) =>
                      inclusion(
                        "prior:" + (start + i) + ":" + j,
                        "이전 첨부 · " + f.name,
                      ),
                    )}
                </div>
              ))}
              {files.map((f) => inclusion(fileKey(f), "새 첨부 · " + f.name))}
              {s.harness.skills.map((k, i) =>
                inclusion("skill:" + i + ":" + k.name, "스킬 · " + k.name),
              )}
            </details>
          </div>
          {files.length > 0 && (
            <div className="chat-files">
              {" "}
              {files.map((f,i)=> "workspace" in f && f.workspace && <button key={"review"+i} disabled={readonly} onClick={()=>setMaterial({kind:"compare",file:f})}>{f.name} · {access.notes.find(n=>n.id===f.workspace!.page)?.revision!==f.workspace.revision?"원본 변경됨":"버전 비교"}</button>)}
              {files.map((f, i) => (
                <button
                  key={i}
                  disabled={readonly}
                  onClick={() => setFiles((v) => v.filter((_, j) => j !== i))}
                >
                  {f.name} 제거
                </button>
              ))}
            </div>
          )}
          </div>
          <small className="chat-keys">Enter {busy || waiting.length ? "대기열에 추가" : "전송"} · Shift+Enter 줄바꿈</small>
        </div>
      </div>
      </div>
      {!api.xcodeChat && <p>모델 연결은 데스크톱 앱에서 사용할 수 있습니다.</p>}
    </section>
  );
}
