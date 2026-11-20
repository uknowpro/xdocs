import type { Attachment } from "./types";
import { unzipSync, strFromU8 } from "fflate";
export const templateGroups: Record<string, Record<string, string[]>> = {
  DeepSeek: {
    "DeepSeek · 근거 기반 답변": [
      "요청한 결과를 먼저 제시하세요. 첨부에서 가져온 주장은 파일명과 위치를 제시하고, 자료가 부족한 부분은 확인할 항목으로 남기세요.",
    ],
    "DeepSeek · 변경안 작성": [
      "첨부에서 성공 조건, 변경할 파일·심볼, 유지해야 할 동작을 추출하세요. 다음 단계에서 사용할 짧은 작업 명세를 작성하세요.",
      "작업 명세와 원본을 대조해 필요한 변경안을 작성하세요. 코드 변경 요청이면 파일별 패치와 예상 동작을 제시하세요.",
      "제안이 요구사항, 경계값, 기존 호출자와 맞는지 원본에 대조하세요. 발견한 오류를 수정한 최종 변경안과 사용자가 실행할 검증 절차를 제시하세요.",
    ],
    "DeepSeek · 인프라 의사결정": [
      "제공된 IaC, 도면, 운영 문서에서 현재 구성·제약·요구사항을 추출하고 출처를 붙이세요.",
      "제약을 만족하는 설계 대안을 장애 범위, 데이터 경계, 비용 요인과 운영 복잡도로 비교하고 하나를 선택하세요.",
      "선택한 방안이 실패할 조건을 점검하고 최종 결정, 전환 순서, 되돌리는 조건과 남은 확인 사항을 작성하세요.",
    ],
    "DeepSeek · 시각 자료 판독": [
      "이미지·슬라이드에 보이는 레이블, 위치, 연결 방향과 수치를 출처별로 추출하세요. 판독하기 어려운 부분을 표시하세요.",
      "사용자의 질문에 답하고 각 결론을 관찰 항목 또는 문서 근거에 연결하세요. 자료끼리 상충하는 곳은 양쪽 출처를 제시하세요.",
    ],
  },
  일반: {
    "직접 대화": ["요청에 직접 답하고 필요한 경우 근거를 표시하세요."],
    "코드 검토": [
      "제공된 코드의 흐름과 요구사항을 파악하세요.",
      "정확성과 유지보수 문제를 근거 및 수정 제안과 함께 정리하세요.",
    ],
    "인프라 변경 검토": [
      "리소스 관계와 변경 범위를 정리하세요.",
      "운영 영향과 검증 절차를 작성하세요.",
    ],
    "이미지·문서 분석": [
      "첨부에서 확인되는 사실과 불확실한 부분을 구분하세요.",
      "요청한 결과를 출처와 함께 정리하세요.",
    ],
    "기술 설계": [
      "목표와 제약을 정리하고 설계 대안을 비교하세요.",
      "선택한 설계의 구현 단계와 검증 기준을 작성하세요.",
    ],
  },
  "운영·플랫폼": {
    "장애 회고": [
      "장애 기록에서 시각·출처·사용자 영향을 추출해 타임라인을 작성하고 관측 공백을 표시하세요.",
      "감지·완화·복구를 구분하고 원인 가설마다 지지 근거와 반례를 연결하세요.",
      "회고문과 재발 방지 표를 작성하세요. 각 조치에 확인 지표를 붙이고 담당자와 기한이 미정이면 표시하세요.",
    ],
    "릴리즈·롤백 계획": [
      "변경 목록과 배포 대상에서 선행 조건, 데이터 호환성, 되돌리기 어려운 작업을 추출하세요.",
      "배포 순서별 관찰 지표, 중단 기준, 롤백 또는 전진 수정 절차를 작성하세요. 기준값은 출처가 없으면 확인 항목으로 남기세요.",
    ],
    "IaC 보안 검토": [
      "제공된 선언에서 신뢰 경계, 공개 진입점, 권한 부여를 파일과 리소스 이름에 연결하세요.",
      "확인된 설정 위험을 영향과 근거 순으로 정리하고 최소 권한 수정안과 배포 전 확인 절차를 제시하세요.",
    ],
    "플랫폼 운영 가이드": [
      "플랫폼 이용자의 작업, 접근 전제, 서비스 의존성을 자료에서 추출하세요.",
      "작업별 실행 순서, 예상 결과, 실패 시 확인 위치와 지원 요청 기준을 담은 운영 가이드를 작성하세요.",
    ],
  },
  "설계·품질": {
    "아키텍처 결정 기록": [
      "결정할 문제와 비교 기준을 정의하고 후보별 장애 범위, 유지 비용, 전환 제약을 같은 기준으로 비교하세요.",
      "결정 기록을 배경·선택·포기한 대안·결과·재검토 조건 순서로 작성하세요. 미합의 사항을 명시하세요.",
    ],
    "회귀 테스트 설계": [
      "변경 요구와 기존 동작을 연결해 정상·경계·오류·복구 사례를 추출하세요.",
      "각 사례를 전제 조건, 입력, 실행 단계, 기대 결과로 작성하고 요구사항별 누락을 확인하세요.",
    ],
    "DB 마이그레이션 검토": [
      "기존·신규 스키마와 읽기·쓰기 경로를 대조해 잠금, 구버전 호환, 데이터 변환 위험을 찾으세요.",
      "준비·백필·전환·정리 단계별 검증 쿼리 초안과 중단 조건을 제시하세요. 비가역 변경을 표시하세요.",
    ],
  },
  "데이터·비용": {
    "클라우드 비용 차이 분석": [
      "비용표의 기간·통화·계정·할인을 맞추고 비교 불가능하거나 누락된 항목을 표시하세요.",
      "서비스별 차액과 주요 기여 항목을 원본 행과 연결하세요. 요율 변화와 사용량 변화는 근거가 있을 때만 분리하세요.",
    ],
    "데이터 품질·백필 계획": [
      "키, 시간 범위, 예상 건수와 정합성 제약을 추출하세요. 누락·중복·지연을 판정할 기준을 정리하세요.",
      "백필 순서와 멱등성 조건, 재실행 경계, 전후 대조 절차를 작성하세요.",
    ],
  },
  "기획·문서": {
    "요구사항·수용 기준": [
      "회의록과 요청서에서 이해관계자, 업무 규칙, 상충하거나 미정인 요구를 근거와 함께 추출하세요.",
      "요구별 수용 기준을 조건·행동·기대 결과로 적고 남은 결정 질문을 정리하세요.",
    ],
    "프로젝트 주간 보고": [
      "기간별 진행 기록에서 완료·지연·의존성·결정 요청을 근거와 함께 추출하세요.",
      "주간 보고서를 작성하고 다음 행동마다 담당·기한을 표시하세요. 자료에 없는 진척률이나 일정을 만들지 마세요.",
    ],
    "Word 양식 작성안": [
      "제공된 양식 텍스트에서 확인 가능한 제목·표 항목과 기입 지침을 순서대로 추출하세요. 판독할 수 없는 필드는 확인 요청으로 남기세요.",
      "원자료에서 근거를 찾아 항목별 작성안을 원래 순서대로 제시하세요. 미확인 값과 출처를 구분하고 파일 수정 완료를 주장하지 마세요.",
    ],
    "Excel 양식 입력안": [
      "첨부에서 확인되는 시트·열 제목·입력 행을 정리하세요. 좌표, 수식 또는 병합 여부를 확인할 수 없으면 추정하지 마세요.",
      "시트별로 붙여넣을 값을 탭 구분 표로 제시하세요. 확인된 수식 칸은 입력 범위에서 제외하고 누락·중복 및 단위 확인 사항은 표 밖에 적으세요.",
    ],
  },
  "제품·서비스": {
    "제품 요구 명세": [
      "자료에서 사용자 문제, 대상, 제약과 성공 지표를 출처별로 정리하세요.",
      "제품 요구 명세를 목표·범위·사용 흐름·수용 기준·미결정 사항으로 작성하세요.",
    ],
    "접근성 점검표": [
      "화면과 문서에서 주요 작업 경로, 입력 요소와 오류 상태를 식별하고 관찰 근거를 남기세요.",
      "경로별로 키보드·화면 읽기·확대 점검 절차와 기대 결과를 적고 실제 점검이 필요한 항목을 표시하세요.",
    ],
    "API 계약 변경 안내": [
      "구버전과 새 버전 자료에서 엔드포인트, 필드, 오류 응답 변경을 추출하고 호환성 영향을 판별하세요.",
      "호출자용 이전 안내를 변경 전후 예시, 적용 순서, 검증 조건 순으로 작성하고 문서에 없는 일정을 추정하지 마세요.",
    ],
    "지원 티켓 분류": [
      "티켓의 증상, 환경과 영향 범위를 정리하고 중복 가능성이 있는 항목을 근거와 함께 묶으세요.",
      "티켓별 우선순위 근거, 다음 확인 질문, 담당 팀 이관 조건과 사용자에게 보낼 응답 초안을 작성하세요.",
    ],
  },
  "자료·교육": {
    "지표 정의서": [
      "보고서에서 지표명과 원자료를 대조해 집계 단위, 분자·분모, 기간, 제외 조건을 추출하세요.",
      "지표별 정의와 계산 예시를 작성하고 중복 집계, 결측값과 기간 경계 확인 기준을 덧붙이세요.",
    ],
    "문서 버전 비교": [
      "두 문서의 버전과 대응하는 절을 식별하고 추가·삭제·수정된 내용을 원문 위치와 함께 정리하세요.",
      "의미가 바뀐 항목, 영향받는 독자와 필요한 후속 조치를 제시하세요. 대응을 확인할 수 없는 절은 표시하세요.",
    ],
    "실습 교안 작성": [
      "자료에서 대상 독자, 준비물, 학습 목표를 추출하고 실습 가능한 절차를 선별하세요.",
      "목표별로 실습 과제, 예상 결과, 이해도 확인 질문과 채점 기준을 작성하세요.",
    ],
  },
};
export const templates: Record<string, string[]> = Object.assign({}, ...Object.values(templateGroups));
export const jobRoles = [
  { group: "기획·문서", name: "프로덕트 매니저", instruction: "사용자 문제, 성공 지표, 범위와 제외 범위를 정의하고 근거가 있는 우선순위를 제안하세요." },
  { group: "설계·개발", name: "접근성 전문가", instruction: "작업 흐름별 키보드 접근, 포커스 순서, 오류 안내와 대체 텍스트를 검토하세요. 자료로 확인할 수 없는 동작은 검증 과제로 표시하세요." },
  { group: "데이터·비용", name: "BI 분석가", instruction: "지표의 분모, 집계 단위와 기간을 명시하고 세그먼트별 차이를 비교하세요. 상관과 인과를 구분하세요." },
  { group: "설계·개발", name: "API 설계자", instruction: "호출자별 계약, 오류 모델, 버전 호환성과 폐기 일정을 검토하고 예시 요청·응답으로 변경 영향을 설명하세요." },
  { group: "기획·문서", name: "교육 콘텐츠 설계자", instruction: "독자의 선행 지식에서 출발해 학습 목표, 실습, 성취 확인 기준을 연결하세요." },
  { group: "인프라·운영", name: "서비스 데스크 담당자", instruction: "사용자의 증상과 환경, 영향 범위를 먼저 파악하고 재현 질문, 해결 확인 기준과 이관 조건을 제시하세요." },
  { group: "인프라·운영", name: "클라우드 엔지니어", instruction: "계정과 네트워크 경계, 가용 영역 장애, IAM 권한과 비용 영향을 검토하세요. 해당하는 변경은 영향 범위와 검증 방법을 제시하세요." },
  { group: "인프라·운영", name: "데브옵스 엔지니어", instruction: "배포 순서와 자동화 의존성을 확인하세요. 운영 변경에는 실패를 감지할 지표, 롤백 조건과 복구 검증 절차를 제시하세요." },
  { group: "설계·개발", name: "백엔드 엔지니어", instruction: "API 계약과 기존 호출자 호환성을 확인하세요. 데이터 변경에는 트랜잭션 경계, 동시 요청과 재시도의 영향을 검토하세요." },
  { group: "설계·개발", name: "프론트엔드 엔지니어", instruction: "사용자 흐름에서 로딩·빈 화면·오류 상태를 검토하세요. 키보드 탐색, 포커스, 좁은 화면에서의 동작을 확인할 방법을 제시하세요." },
  { group: "설계·개발", name: "풀스택 엔지니어", instruction: "사용자 입력이 화면에서 API와 저장소까지 전달되는 경로를 추적하세요. 계층 간 계약과 배포 순서를 확인하고 종단 간 검증 사례를 제시하세요." },
  { group: "데이터·비용", name: "데이터 엔지니어", instruction: "스키마 변경, 데이터 계보, 누락과 중복을 검토하세요. 재처리와 백필 시 정합성을 확인할 기준을 제시하세요." },
  { group: "인프라·운영", name: "SRE · 신뢰성 엔지니어", instruction: "사용자 영향, 오류 예산, 감지와 복구 시간을 근거로 판단하세요. 경보 기준과 복구 확인 방법을 명시하세요." },
  { group: "인프라·운영", name: "클라우드 보안 엔지니어", instruction: "공개 경로와 신뢰 경계, IAM 권한, 비밀 관리 상태를 선언 근거에 연결하고 수정 순서를 제시하세요." },
  { group: "인프라·운영", name: "플랫폼 엔지니어", instruction: "팀별 온보딩, 공용 인터페이스와 운영 책임을 확인하세요. 표준화의 이점과 예외 처리 비용을 구분하세요." },
  { group: "설계·개발", name: "솔루션 아키텍트", instruction: "이해관계자 요구와 비기능 조건을 먼저 확인하고 설계 대안별 비용, 장애 격리, 이전 난이도를 비교하세요." },
  { group: "설계·개발", name: "QA · 테스트 엔지니어", instruction: "요구사항별 정상·경계·실패 사례와 재현 조건을 도출하고 판정 가능한 기대 결과를 작성하세요." },
  { group: "데이터·비용", name: "DBA", instruction: "쿼리 경로, 잠금, 인덱스 영향과 복구 가능성을 검토하세요. 백업 복원과 데이터 무결성 검증 방법을 제시하세요." },
  { group: "데이터·비용", name: "FinOps 분석가", instruction: "비용 귀속, 통화, 기간과 할인 조건을 맞추세요. 실제 지출과 추정 절감액을 구분하고 계산 근거를 제시하세요." },
  { group: "기획·문서", name: "비즈니스 분석가 (BA)", instruction: "업무 규칙과 이해관계자의 목표를 연결하세요. 수용 기준, 상충하는 요구, 확인 질문을 구분하세요." },
  { group: "기획·문서", name: "PMO · 프로젝트 관리", instruction: "마일스톤, 의존성, 일정 기준선과 실제 진척을 대조하세요. 결정 요청과 후속 조치의 담당자·기한을 확인하세요." },
  { group: "기획·문서", name: "테크니컬 라이터", instruction: "독자와 선행 지식을 명시하고 절차를 실행 순서로 구성하세요. 용어를 통일하고 단계별 예상 결과를 설명하세요." },
] as const;
export type JobRole = (typeof jobRoles)[number]["name"];
export function roleInstruction(name?: JobRole) {
  const role = jobRoles.find((item) => item.name === name);
  return role ? `직무 역할: ${role.name}. 현재 요청에 관련된 기준을 각 단계에 적용하세요. ${role.instruction}` : "";
}
export type Harness = {
  jobRole?: JobRole;
  name: string;
  stages: string[];
  effort?: string;
  stageEfforts?: string[];
  historyTurns?: number;
  skills: { name: string; instruction: string }[];
};
export type InputFile = { name: string; text: string } | Attachment;
export type Turn = {
  runId?: string;
  prompt: string;
  files: InputFile[];
  execution?: { model: string; harness: string; skills: string[]; configuration?: Harness };
  answers: {
    stage: string;
    text: string;
    elapsedMs?: number;
    effort?: string;
    retries?: number;
  }[];
};
export type Session = {
  endpoint: string;
  model: string;
  profile: string;
  harness: Harness;
  turns: Turn[];
  repeatCompleted?: boolean;
  autoRetry?: boolean;
  retrySeconds?: number;
  autoMinutes?: number;
  maxAutoRequests?: number;
};
export function preset(name: string): Harness {
  const policies: Record<string, string[]> = {
    "DeepSeek · 변경안 작성": ["low", "high", "high"],
    "DeepSeek · 인프라 의사결정": ["low", "high", "high"],
    "DeepSeek · 시각 자료 판독": ["low", "high"],
  };
  return {
    name,
    stages: [...templates[name]],
    skills: [],
    ...(policies[name] ? { stageEfforts: policies[name] } : {}),
  };
}
export function fresh(): Session {
  return {
    endpoint: "http://127.0.0.1:8000/v1/chat/completions",
    model: "deepseek-ai/DeepSeek-V4.1-Flash",
    profile: "",
    harness: preset("DeepSeek · 근거 기반 답변"),
    turns: [],
  };
}
const block = /^```xdocs-xcode\r?\n([^]*?)\r?\n```$/m;
export function pack(s: Session) {
  return (
    "```xdocs-xcode\n" + JSON.stringify(s).replaceAll("`", "\\u0060") + "\n```"
  );
}
export function replaceSession(body: string, s: Session) {
  return body.replace(block, () => pack(s));
}
export function decode(body: string): Session | null {
  const m = body.match(block);
  if (!m) return null;
  try {
    const s = JSON.parse(m[1]);
    return validHarness(s.harness) &&
      Array.isArray(s.turns) &&
      s.turns.every(
        (t: Turn) =>
          t &&
          typeof t.prompt === "string" &&
          (t.execution === undefined ||
            (typeof t.execution?.model === "string" &&
              typeof t.execution.harness === "string" &&
              Array.isArray(t.execution.skills) &&
              t.execution.skills.every(
                (skill) => typeof skill === "string",
              ))) &&
          Array.isArray(t.answers) &&
          t.answers.every(
            (a) => typeof a?.text === "string" && typeof a.stage === "string",
          ) &&
          Array.isArray(t.files) &&
          t.files.every(
            (f) =>
              f &&
              typeof f.name === "string" &&
              ("text" in f
                ? typeof f.text === "string"
                : typeof f.path === "string" &&
                  ["pdf", "image"].includes(f.kind)),
          ),
      ) &&
      typeof s.endpoint === "string" &&
      typeof s.model === "string"
      ? s
      : null;
  } catch {
    return null;
  }
}
export function validHarness(h: Harness) {
  return (
    h &&
    typeof h.name === "string" &&
    (h.jobRole === undefined || jobRoles.some((r) => r.name === h.jobRole)) &&
    (!h.effort ||
      ["low", "medium", "high", "xhigh", "max"].includes(h.effort)) &&
    (h.historyTurns === undefined ||
      (Number.isSafeInteger(h.historyTurns) &&
        h.historyTurns >= 0 &&
        h.historyTurns <= 100)) &&
    Array.isArray(h.stages) &&
    h.stages.length > 0 &&
    h.stages.length <= 12 &&
    h.stages.every((s) => typeof s === "string") &&
    (h.stageEfforts === undefined ||
      (Array.isArray(h.stageEfforts) &&
        h.stageEfforts.length === h.stages.length &&
        h.stageEfforts.every((e) =>
          ["", "server", "low", "medium", "high", "xhigh", "max"].includes(e),
        ))) &&
    Array.isArray(h.skills) &&
    h.skills.every(
      (s) => typeof s?.name === "string" && typeof s.instruction === "string",
    )
  );
}
export async function documentInput(f: File): Promise<InputFile> {
  if (f.size > 8 * 1024 * 1024) throw Error("문서는 8MB 이하로 선택하세요.");
  let text: string;
  const isOpenDocument = /\.(odt|ott|odp|otp)$/i.test(f.name);
  const isHwpx = /\.hwpx$/i.test(f.name);
  if (isOpenDocument || isHwpx || /\.(docx|dotx|pptx|potx|xlsx|xltx)$/i.test(f.name)) {
    const partPattern = isOpenDocument ? /^content\.xml$/ :
      isHwpx ? /^Contents\/section\d+\.xml$/ :
      /^(word\/document|ppt\/slides\/slide\d+|xl\/sharedStrings|xl\/worksheets\/sheet\d+)\.xml$/;
    const parts: string[] = [];
    let bytes = 0;
    const zip = unzipSync(new Uint8Array(await f.arrayBuffer()), {
      filter: (e) => {
        if (!partPattern.test(e.name)) return false;
        bytes += e.originalSize;
        if (bytes > 16 * 1024 * 1024)
          throw Error("문서의 압축 해제 범위가 너무 큽니다.");
        return true;
      },
    });
    const xml = (name: string) =>
      new DOMParser().parseFromString(strFromU8(zip[name]), "application/xml");
    const strings = zip["xl/sharedStrings.xml"]
      ? Array.from(
          xml("xl/sharedStrings.xml").getElementsByTagName("si"),
          (e) => e.textContent || "",
        )
      : [];
    for (const name of Object.keys(zip).sort((a, b) =>
      a.localeCompare(b, "en", { numeric: true }),
    )) {
      if (name === "xl/sharedStrings.xml") continue;
      const doc = xml(name);
      if (doc.getElementsByTagName("parsererror").length)
        throw Error("문서 XML을 읽을 수 없습니다.");
      if (isOpenDocument) {
        const ns = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
        for (const node of doc.getElementsByTagNameNS(ns, "*")) {
          if (node.localName === "p" || node.localName === "h") {
            // ODF stores significant whitespace as elements inside paragraphs.
            const clone = node.cloneNode(true) as Element;
            for (const space of Array.from(clone.getElementsByTagNameNS(ns, "*"))) {
              if (space.localName === "s") space.replaceWith(" ".repeat(Math.min(160, Math.max(1, Number(space.getAttributeNS(ns, "c")) || 1))));
              else if (space.localName === "tab") space.replaceWith("\t");
              else if (space.localName === "line-break") space.replaceWith("\n");
            }
            parts.push(clone.textContent || "");
          }
        }
      } else if (isHwpx) {
        // Read each text run once, including text in nested tables.
        for (const node of doc.getElementsByTagNameNS("*", "t")) {
          parts.push(node.textContent || "");
        }
      } else if (name.startsWith("xl/")) {
        parts.push(
          name,
          ...Array.from(doc.getElementsByTagName("row"), (row) =>
            Array.from(row.getElementsByTagName("c"), (c) => {
              const v = c.getElementsByTagName("v")[0]?.textContent || "";
              return (
                (c.getAttribute("r") || "") +
                "=" +
                (c.getAttribute("t") === "s"
                  ? strings[Number(v)] || ""
                  : v || c.textContent)
              );
            }).join("\t"),
          ),
        );
      } else
        parts.push(
          name,
          ...Array.from(doc.getElementsByTagNameNS("*", "p"), (p) =>
            Array.from(
              p.getElementsByTagNameNS("*", "t"),
              (n) => n.textContent,
            ).join(""),
          ),
        );
    }
    text = parts.join("\n");
  } else {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      await f.arrayBuffer(),
    );
    if (text.includes("\0"))
      throw Error("텍스트 또는 지원되는 문서를 선택하세요.");
  }
  if (!text.trim() || text.length > 160000)
    throw Error("문서 텍스트는 비어 있지 않고 16만 자 이하여야 합니다.");
  return { name: f.name, text };
}
