import { usePaneHeight } from "./usePaneHeight";
import {formInstruction, inspectForm, templateFiles} from "./office-form";
import OfficeForm from "./OfficeForm";
import SessionSettingsJson from "./SessionSettingsJson";
import ChatTimeline from "./ChatTimeline";
import { ArrowUp, Paperclip, SlidersHorizontal, Square } from "lucide-react";
import WordSelection from "./WordSelection";
import ProjectInputs from "./ProjectInputs";
import {
  loadCheckpoint,
  saveCheckpoint,
  saveProgress,
  clearCheckpoint,
  type Checkpoint, type QueuedPrompt,
} from "./xcode-checkpoint";
import {
  diagnosticInput,
  diagnosticResult,
  type Probe,
} from "./xcode-diagnostic";
import {
  acquireServer,
  serverOrigin,
  setCapacity,
  useCapacity,
} from "./xcode-queue";
import { sessionRun, waitForRetry } from "./xcode-run";
import {
  useEffect,
  useRef,
  useMemo,
  useSyncExternalStore,
  useState,
} from "react";
import { api } from "./api";
import type { ModelProfile } from "./types";
import {
  documentInput,
  jobRoles,
  roleInstruction,
  preset,
  templateGroups,
  validHarness,
  type Harness,
  type Session,
  type InputFile,
  type Turn,
} from "./xcode-session";

const draftKeys = new WeakMap<InputFile, string>();
function fileKey(file: InputFile) {
  let key = draftKeys.get(file);
  if (!key) {
    key = crypto.randomUUID();
    draftKeys.set(file, key);
  }
  return key;
}

async function userMessage(prompt: string, files: InputFile[]) {
  const content: unknown[] = [{ type: "text", text: prompt }];
  for (const f of files) {
    if ("text" in f) {
      content.push({ type: "text", text: f.name + "\n" + f.text });
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
    onChange={event=>setDraft(event.target.value)}
    onBlur={()=>{
      if (draft === null) return;
      const number = Number(draft);
      if (draft.trim() && Number.isFinite(number)) {
        const next = Math.max(1, Math.min(max, Math.round(number)));
        if (next !== value) commit(next);
      }
      setDraft(null);
    }}
  /></label>;
}

export default function Xcode({
  session: s,
  local,
  scope,
  page,
  prepare,
  finish,
  change,
  readonly,
}: {
  session: Session;
  local: boolean;
  scope: string;
  page: string;
  prepare: () => Promise<boolean>;
  finish: (t: Turn) => Promise<void>;
  change: (s: Session) => void;
  readonly: boolean;
}) {
  const run = sessionRun(scope, page);
  const { pending, busy, preview, phase, error, prompt, files, omitted, draftError, waiting, queuePaused, queueReady } =
    useSyncExternalStore(run.subscribe, run.snapshot);
  useEffect(()=>{if(run.snapshot().outcome)run.patch({outcome:""});},[run]);
  useEffect(()=>{void run.loadWaiting().catch(e=>run.patch({error:String(e)}));},[run]);
  const [editingItem,setEditingItem] = useState("");
  const [editedPrompt,setEditedPrompt] = useState("");
  const origin = serverOrigin(s.endpoint);
  const capacity = useCapacity(origin);
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
  const attachmentMenu = useRef<HTMLDivElement>(null);
  const attachmentPicker = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(
    () => localStorage.getItem("xdocs.xcode.settings") === "shown",
  );
  const [skillQuery, setSkillQuery] = useState("");
  const [draftToken, setDraftToken] = useState({value:"", origin:""});
  const key = draftToken.value;
  const tokenNeedsApproval = Boolean(key && draftToken.origin !== origin);
  const setKey = (value:string, endpoint = s.endpoint) =>
    setDraftToken({value, origin:serverOrigin(endpoint)});
  const [savingKey, setSavingKey] = useState(false);
  const currentConnection = useRef({session:s,change,key});
  currentConnection.current = {session:s,change,key};
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
  const config = (patch: Partial<Session>) => {
    setSettingsSave("idle");
    change({ ...s, ...patch });
  };
  const workbench = useRef<HTMLDivElement>(null);
  usePaneHeight(workbench);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (settingsSave !== "saved") return;
    const timer = window.setTimeout(() => setSettingsSave("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [settingsSave]);
  async function saveSettings() {
    setSettingsSave("saving");
    try {
      const ok = await prepare();
      if (!mounted.current) return;
      setSettingsSave(ok ? "saved" : "failed");
      if (ok) {
        setShowSettings(false);
        localStorage.setItem("xdocs.xcode.settings", "hidden");
        requestAnimationFrame(() => composerRef.current?.focus());
      }
    } catch {
      if (mounted.current) setSettingsSave("failed");
    }
  }
  const linkedProfile = profiles.find(p => p.name === s.profile);
  const savedProfile = linkedProfile?.endpoint === s.endpoint && linkedProfile.model === s.model ? linkedProfile : undefined;
  async function rememberToken() {
    if (!api.saveBuilderProfile || !key || !origin || tokenNeedsApproval || savingKey) return;
    setSavingKey(true);
    try {
      const name = (s.model.trim().slice(0,50) || "xcode") + " · " + crypto.randomUUID();
      const next = await api.saveBuilderProfile({name,endpoint:s.endpoint,model:s.model,key,remember:true});
      if (!mounted.current) return;
      setProfiles(next);
      const latest = currentConnection.current;
      if (latest.session.endpoint === s.endpoint && latest.session.model === s.model && latest.key === key) {
        latest.change({...latest.session,profile:name});
        setKey("");
      }
    } catch (error) {
      if (mounted.current) setError(String(error));
    } finally {
      if (mounted.current) setSavingKey(false);
    }
  }
  function tokenReady() {
    if (!tokenNeedsApproval && !savingKey) return true;
    setShowSettings(true);
    setError(savingKey ? "토큰을 저장하고 있습니다." : "변경한 서버에서 입력한 토큰을 사용할지 선택하세요.");
    return false;
  }
  const harness = (patch: Partial<Harness>) =>
    config({ harness: { ...s.harness, ...patch } });
  const [search,setSearch]=useState(""), [candidate,setCandidate]=useState("");
  const matches=(value:string)=>value.toLowerCase().includes(search.trim().toLowerCase());
  const cancel = () => run.cancel();
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
  const [report, setReport] = useState("");
  useEffect(() => setReport(""), [s.endpoint, s.model, key, probe]);
  async function diagnose() {
    if (run.snapshot().busy || !api.xcodeChat || readonly || !tokenReady()) return;
    const id = crypto.randomUUID();
    const controller = new AbortController();
    let release: (() => void) | undefined;
    run.id = id;
    run.request = controller;
    run.patch({ busy: true, phase: "연결 진단", error: "" });
    setReport("");
    try {
      if (!(await api.xcodeAuthorize?.(s.endpoint)))
        throw Error("서버 전송을 취소했습니다.");
      release = await acquireServer(origin, controller.signal);
      controller.signal.throwIfAborted();
      const answer = await api.xcodeChat({
        id,
        profile: s.profile,
        endpoint: s.endpoint,
        model: s.model,
        key,
        messages: [{ role: "user", content: diagnosticInput(probe) }],
      });
      controller.signal.throwIfAborted();
      setReport(diagnosticResult(probe, answer));
    } catch (error) {
      const detail = String(error).replace("[XCODE_RETRY] ", "");
      setReport(
        controller.signal.aborted
          ? "연결 진단을 중지했습니다."
          : /HTTP (401|403)/.test(detail)
            ? "인증이 거부되었습니다. API 키와 권한을 확인하세요."
            : /HTTP 404/.test(detail)
              ? "주소 또는 모델을 찾을 수 없습니다. 모델 ID와 경로를 확인하세요."
              : detail,
      );
    } finally {
      release?.();
      run.request = null;
      run.id = "";
      run.patch({ busy: false, phase: "" });
    }
  }
  const checkpointKey = JSON.stringify([scope, page]);
  const [recovery, setRecovery] = useState<Checkpoint>();
  useEffect(() => {
    let active = true;
    if (local && !busy)
      loadCheckpoint(checkpointKey)
        .then((c) => {
          if (active)
            setRecovery(
              c && !s.turns.some((t) => t.runId === c.id) ? c : undefined,
            );
        })
        .catch((e) => active && setError(String(e)));
    return () => {
      active = false;
    };
  }, [local, checkpointKey, busy, s.turns.length]);
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
  const visibleQueue = waiting.filter(item => item.id !== run.activeItem);
  const interrupted = !busy && (run.snapshot().failedInput || recovery);
  const interruptedId = interrupted ? interrupted.id : undefined;
  const targetChanged = (item:QueuedPrompt) => item.model !== s.model || item.endpoint !== s.endpoint;
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
  async function retryInterrupted() {
    if (!interrupted || readonly || run.snapshot().busy) return;
    const item = waiting.find(entry => entry.id === interrupted.id) || run.snapshot().failedInput;
    if (item && targetChanged(item)) {setError("먼저 이 메시지의 모델과 서버 주소를 확인하세요.");return;}
    const saved = recovery?.id === interrupted.id && recovery.model === s.model && recovery.endpoint === s.endpoint && (!item || item.prompt === recovery.prompt) ? recovery : undefined;
    if (saved || item) await send(saved,item);
    else if (recovery) await send(recovery);
  }
  async function skipInterrupted() {
    if (!interrupted || readonly || run.snapshot().busy || run.submitting) return;
    run.submitting=true;
    try {
      await removeWaiting(interrupted.id);
      run.patch({failedInput:undefined,error:"",pending:null,preview:""});
    } finally {run.submitting=false;}
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
    run.patch({queuePaused:false});
    if (saved?.id===queued.id && saved.prompt===queued.prompt && saved.model===queued.model && saved.endpoint===queued.endpoint && !s.turns.some(t=>t.runId===queued.id))
      await send(saved,queued);
    else await drain(s);
  }
  function consumeInput(text:string, attached:InputFile[]) {
    const draft=run.snapshot();
    run.patch({prompt:draft.prompt===text ? "" : draft.prompt,
      files:draft.files.filter(file=>!attached.includes(file))});
  }
  async function submit() {
    if (!api.xcodeChat || readonly || importing || run.submitting || !queueReady) return;
    if (!run.snapshot().busy && !run.snapshot().waiting.length) { void send(); return; }
    if (!run.activeItem) run.patch({queuePaused:true});
    if (!prompt.trim() && !selectedFiles.length) return;
    const item:QueuedPrompt={id:crypto.randomUUID(),prompt,files:selectedFiles,
      templates:selectedFiles.map(f=>templateFiles.get(f)),omitted:[...omitted],endpoint:s.endpoint,model:s.model};
    run.submitting=true;
    try {
      await run.updateWaiting(items=>[...items,item]);
      consumeInput(prompt,selectedFiles);
    } catch(e) {setError("대기 메시지를 저장하지 못했습니다. "+String(e));}
    finally {run.submitting=false;}
  }
  async function drain(session:Session) {
    await run.settled();
    if (run.snapshot().busy || run.snapshot().queuePaused || readonly) return;
    const item=run.snapshot().waiting[0];
    if (!item) return;
    if (session.turns.some(turn=>turn.runId===item.id)) {
      await run.updateWaiting(items=>items.filter(i=>i.id!==item.id));
      return drain(session);
    }
    if (item.endpoint!==session.endpoint || item.model!==session.model) {
      run.patch({queuePaused:true,error:"대기 메시지를 추가할 때의 API 주소와 모델을 확인하세요."});
      return;
    }
    item.files.forEach((f,i)=>{if(item.templates[i]) templateFiles.set(f,item.templates[i]!);});
    await send(undefined,item,session);
  }
  async function send(saved?: Checkpoint,item?:QueuedPrompt,context?:Session) {
    if (!tokenReady()) {run.patch({queuePaused:true});return;}
    const {
      s: session,
      prompt: initialPrompt,
      selectedFiles: initialFiles,
      execution: initialExecution,
    } = currentInput;
    const s = saved ? { ...session, harness: saved.harness } : context || session;
    const excluded=item?.omitted || omitted;
    const selected=(key:string)=>!excluded.includes(key);
    const start=Math.max(0,s.turns.length-(s.harness.historyTurns??s.turns.length));
    const candidates=s.turns.slice(start);
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
    if (saved && (s.model !== saved.model || s.endpoint !== saved.endpoint)) {
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
    run.patch({outcome:"",queuePaused:false,failedInput:undefined});
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
          id: saved?.id ?? id,
          endpoint: s.endpoint,
          model: s.model,
          harness: execution.configuration,
          messages: [...messages],
          prompt,
          files: selectedFiles,
          answers,
          partial: "",
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
            release = await acquireServer(origin, request.signal);
            request.signal.throwIfAborted();
            run.patch({ phase: "실행 중 · " + stage });
            const answer = await api.xcodeChat!({
              id,
              key,
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
      }
      const next = {
        ...s,
        turns: [
          ...s.turns,
          { prompt, files: selectedFiles, answers, execution },
        ],
      };
      if (new Blob([JSON.stringify(next)]).size > 4800000)
        throw Error("세션 저장 한도에 도달했습니다. 새 세션으로 이어가세요.");
      await finish({
        runId: checkpoint?.id ?? id,
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
      if (form && answers.length) run.patch({formReview:{id,text:answers[answers.length-1].text}});
      continuation=next;
      if (run.snapshot().waiting.some(q=>q.id===id))
        await run.updateWaiting(items=>items.filter(q=>q.id!==id));
      if (saved && run.snapshot().prompt===saved.prompt) consumeInput(saved.prompt,saved.files);

      run.patch({ pending: null, preview: "" });
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
          files: [],
          answers: [
            {
              stage: "자동 이어쓰기",
              ...result,
              elapsedMs: Math.round(performance.now() - started),
            },
          ],
        });
        continuation.turns.push({prompt:"계속해주세요",files:[],execution,answers:[{stage:"자동 이어쓰기",...result}]});
        completed++;
        messages.push({ role: "assistant", content: result.text });
        run.patch({ pending: null, preview: "" });
      }
    } catch (e) {
      run.patch({queuePaused:true,failedInput:continuation ? undefined : item || {
        id,prompt,files:selectedFiles,templates:selectedFiles.map(f=>templateFiles.get(f)),
        omitted:[...excluded],model:s.model,endpoint:s.endpoint
      }});
      if (!continuation && !item && !saved && !run.snapshot().prompt && !run.snapshot().files.length)
        run.patch({prompt,files:selectedFiles});
      setError(
        run.id === id
          ? String(e).replace("[XCODE_RETRY] ", "")
          : "요청을 중지했습니다.",
      );
    } finally {
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
        <span title={s.model}>{s.model}</span>
        {settingsSave === "saved" && <small aria-live="polite">세션 설정을 저장했습니다.</small>}
        <button
          className="chat-settings-toggle"
          aria-expanded={showSettings}
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
        <fieldset disabled={readonly}>
          <legend>중단된 실행 복구</legend>
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
              : "미완료 단계부터 재실행"}
          </button>
          <button
            onClick={() =>
              void clearCheckpoint(checkpointKey)
                .then(() => setRecovery(undefined))
                .catch((e) => setError(String(e)))
            }
          >
            복구 기록 삭제
          </button>
        </fieldset>
      )}
      <div hidden={!showSettings}>
        <fieldset className="chat-basic-settings" disabled={busy || readonly || savingKey}>
          <legend>모델 연결</legend>
          <label>
            API 주소
            <input
              placeholder="https://server.example/v1/chat/completions"
              value={s.endpoint}
              onChange={e => config({endpoint:e.target.value})}
            />
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
          </label>
          <label>
            모델명
            <input
              value={s.model}
              onChange={e => config({model:e.target.value})}
            />
          </label>
          <div className="token-storage">
            {tokenNeedsApproval && origin && <button type="button" onClick={() => {setKey(key);setError("");}}>
              {origin}에서 이 토큰 사용
            </button>}
            {key && api.saveBuilderProfile && <button type="button" disabled={tokenNeedsApproval || !origin || !s.model.trim()} onClick={() => void rememberToken()}>
              이 기기에 토큰 저장
            </button>}
            <small>{key ? "입력한 토큰은 현재 화면에서만 유지됩니다." : savedProfile?.hasKey ? "이 기기에 저장된 토큰을 사용합니다." : linkedProfile?.hasKey ? "저장된 토큰은 원래 API 주소와 모델명으로 돌아가면 다시 사용됩니다." : "서버 인증이 필요하면 토큰을 입력하세요."}</small>
          </div>
        </fieldset>
        <SessionSettingsJson
          session={s}
          disabled={busy || readonly}
          apply={(settings, token) => {
            if (token !== undefined) setKey(token,settings.endpoint);
            config({...settings, profile:token === undefined ? s.profile : ""});
          }}
        />
        <details className="chat-advanced">
          <summary>고급 설정</summary>
          <details>
            <summary>하네스 구성 · {s.harness.name}{s.harness.jobRole && ` · ${s.harness.jobRole}`}</summary>
            <fieldset disabled={busy || readonly}>
              <legend>직무 역할 · 단계 및 스킬</legend>
              <label>역할 또는 템플릿 찾기<input type="search" placeholder="백엔드, 장애 회고 등" value={search} onChange={e=>{setSearch(e.target.value);setCandidate("");}}/></label>
              {search.trim() && <small aria-live="polite">검색 결과 · 역할 {jobRoles.filter(role=>matches(role.group+" "+role.name)).length}개 · 템플릿 {Object.entries(templateGroups).reduce((count,[group,items])=>count+Object.keys(items).filter(name=>matches(group+" "+name)).length,0)}개</small>}
              <label>
                직무 역할
                <select
                  aria-label="직무 역할"
                  value={s.harness.jobRole ?? ""}
                  onChange={(e) => harness({ jobRole: jobRoles.find((role) => role.name === e.target.value)?.name })}
                >
                  <option value="">역할 없음</option>
                  {[...new Set(jobRoles.map((role) => role.group))].map((group) => (
                    <optgroup key={group} label={group}>
                      {jobRoles.filter((role) => role.group === group && (role.name===s.harness.jobRole || matches(group+" "+role.name))).map((role) => (
                        <option key={role.name}>{role.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {s.harness.jobRole && <p>{jobRoles.find((role) => role.name === s.harness.jobRole)?.instruction}</p>}
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
              {candidate&&<div className="harness-preview"><strong>{candidate}</strong><ol>{preset(candidate).stages.map(step=><li key={step}>{step}</li>)}</ol><button onClick={()=>{config({harness:{...preset(candidate),jobRole:s.harness.jobRole}});setCandidate("");}}>전체 단계 적용</button></div>}
              <label>
                하네스 이름
                <input
                  value={s.harness.name}
                  onChange={(e) => harness({ name: e.target.value })}
                />
              </label>
              <label>
                추론 강도
                <select
                  value={s.harness.effort || ""}
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
                  value={s.harness.historyTurns ?? "all"}
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
              {s.harness.stages.map((stage, i) => (
                <div key={i}>
                  <label>
                    단계 {i + 1}
                    <textarea
                      value={stage}
                      onChange={(e) =>
                        harness({
                          stages: s.harness.stages.map((v, j) =>
                            j === i ? e.target.value : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    단계 {i + 1} 추론 설정
                    <select
                      value={s.harness.stageEfforts?.[i] || ""}
                      onChange={(e) =>
                        harness({
                          stageEfforts: s.harness.stages.map((_, j) =>
                            i === j
                              ? e.target.value
                              : s.harness.stageEfforts?.[j] || "",
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
                      const stages = [...s.harness.stages];
                      [stages[i - 1], stages[i]] = [stages[i], stages[i - 1]];
                      const efforts = [
                        ...(s.harness.stageEfforts || stages.map(() => "")),
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
                    disabled={s.harness.stages.length === 1}
                    onClick={() =>
                      harness({
                        stages: s.harness.stages.filter((_, j) => j !== i),
                        stageEfforts: s.harness.stageEfforts?.filter(
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
                disabled={s.harness.stages.length >= 12}
                onClick={() =>
                  harness({
                    stages: [...s.harness.stages, ""],
                    stageEfforts: s.harness.stageEfforts && [
                      ...s.harness.stageEfforts,
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
                    disabled={s.harness.skills.some(
                      (x) =>
                        x.name === k.name && x.instruction === k.instruction,
                    )}
                    onClick={() =>
                      harness({
                        skills: [
                          ...s.harness.skills,
                          { name: k.name, instruction: k.instruction },
                        ],
                      })
                    }
                  >
                    {k.scope} · {k.name} 추가
                  </button>
                ))}
              {s.harness.skills.map((k, i) => (
                <button
                  key={i}
                  onClick={() =>
                    harness({
                      skills: s.harness.skills.filter((_, j) => i !== j),
                    })
                  }
                >
                  {k.name} 제거
                </button>
              ))}
              <button
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(s.harness, null, 2)], {
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
          </details>
          <fieldset disabled={readonly}>
            <legend>자동 재요청</legend>
            <label className="retry-toggle">
              <input
                type="checkbox"
                checked={s.autoRetry === true}
                onChange={(e) => {
                  run.enabled = e.target.checked;
                  if (!run.enabled) {
                    run.wait?.abort();
                    if (run.automatic) {
                      run.request?.abort(Error("자동 요청을 중지했습니다."));
                      void api.xcodeCancel?.(run.id);
                    }
                  }
                  config({ autoRetry: e.target.checked });
                }}
              />
              이어지는 응답 자동 요청
            </label>
            <label>
              재요청 방식
              <select
                disabled={busy}
                value={s.repeatCompleted ? "repeat" : "failure"}
                onChange={(e) =>
                  config({ repeatCompleted: e.target.value === "repeat" })
                }
              >
                <option value="failure">중단된 응답만 이어받기</option>
                <option value="repeat">정상 완료 후에도 계속 요청</option>
              </select>
            </label>
            <RetryLimit label="자동 실행 한도(분)" value={s.autoMinutes ?? 15} max={240} disabled={busy} commit={autoMinutes=>config({autoMinutes})}/>
            <RetryLimit label="자동 요청 한도(회)" value={s.maxAutoRequests ?? 5} max={100} disabled={busy} commit={maxAutoRequests=>config({maxAutoRequests})}/>
            <RetryLimit label="재요청 간격(초)" value={s.retrySeconds ?? 60} max={3600} disabled={busy} commit={retrySeconds=>config({retrySeconds})}/>
          </fieldset>
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
                disabled={!origin}
                value={capacity}
                onChange={(e) => setCapacity(origin, Number(e.target.value))}
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
                onChange={(e) => setProbe(e.target.value as Probe)}
              >
                <option value="text">짧은 텍스트</option>
                <option value="image">샘플 이미지</option>
                <option value="pdf">샘플 PDF</option>
              </select>
            </label>
            <button
              disabled={!api.xcodeChat || !s.model.trim() || !origin}
              onClick={() => void diagnose()}
            >
              연결 진단 실행
            </button>
            {report && <p role="status">{report}</p>}
          </fieldset>
        </details>
        <div className="session-settings-save">
          <button type="button" disabled={busy || readonly || savingKey || settingsSave === "saving"} onClick={() => void saveSettings()}>
            {settingsSave === "saving" ? "저장 중…" : "설정 저장"}
          </button>
          <small aria-live="polite">{settingsSave === "failed" ? "세션 설정을 저장하지 못했습니다. 다시 시도하세요." : ""}</small>
        </div>
      </div>
      <div hidden={documentPanel !== "form"}><OfficeForm form={run.snapshot().form} review={run.snapshot().formReview} setForm={form=>run.patch({form,formReview:undefined})} close={()=>setDocumentPanel(null)} disabled={busy||readonly} answer={s.turns.at(-1)?.answers.at(-1)?.text||""} prepare={text=>setPrompt([prompt,text].filter(Boolean).join("\n\n"))}/></div>
      {local && api.wordCapture && <div hidden={documentPanel !== "word"}>
        <WordSelection close={()=>setDocumentPanel(null)} disabled={busy || readonly}
          answer={s.turns.at(-1)?.answers.at(-1)?.text || ""}
          attach={(name,text)=>setFiles(previous=>[...previous,{name,text}])}/>
      </div>}
      <div className="chat-workbench" ref={workbench}>
        <ChatTimeline
          reading={run.reading}
          turns={s.turns}
          preview={preview}
          phase={phase}
          pending={pending}
          error={error}
          busy={busy}
          readonly={readonly}
          applyHarness={(h) => config({ harness: h })}
        />
        {interrupted && (waiting.length > 0 || run.snapshot().failedInput) && <div className="queue-recovery">
          <strong>중단된 메시지</strong><span>{interrupted.prompt}</span>
          <button disabled={readonly} onClick={()=>void retryInterrupted().catch(e=>setError(String(e)))}>이 메시지 재시도</button>
          <button disabled={readonly} onClick={()=>void skipInterrupted().catch(e=>setError(String(e)))}>{visibleQueue.some(q=>q.id!==interrupted.id) ? "건너뛰고 다음 전송" : "건너뛰기"}</button>
        </div>}
        {visibleQueue.length > 0 && <details className="chat-waiting">
          <summary>대기 메시지 {visibleQueue.length}개</summary>
          {visibleQueue.map((q,index)=><div key={q.id}>
            {editingItem===q.id ? <textarea aria-label="대기 메시지 수정" value={editedPrompt} onChange={e=>setEditedPrompt(e.target.value)}/>
              : <span>{q.prompt}</span>}
            {q.files.length>0 && <small>{q.files.map(f=>f.name).join(" · ")}</small>}
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
            <button disabled={readonly || q.id===interruptedId} onClick={()=>void removeWaiting(q.id).catch(e=>setError(String(e)))}>취소</button>
          </div>)}
          {!busy && !interrupted && queuePaused && <button disabled={readonly} onClick={()=>{
            void resumeQueue().catch(e=>run.patch({queuePaused:true,error:String(e)}));
          }}>대기열 재개</button>}
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
            onChange={(e) => setPrompt(e.target.value)}
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
              <button
                className="chat-stop"
                aria-label="중지"
                title="중지"
                onClick={cancel}
              >
                <Square size={14} />
              </button>
            )}
            {(!busy || prompt.trim() || selectedFiles.length>0) && (
              <button
                className="chat-submit"
                aria-label={busy || waiting.length ? "대기열에 추가" : "전송"}
                title={busy || waiting.length ? "대기열에 추가 (Enter)" : "전송 (Enter)"}
                disabled={
                  readonly ||
                  importing ||
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
      {!api.xcodeChat && <p>모델 연결은 데스크톱 앱에서 사용할 수 있습니다.</p>}
    </section>
  );
}
