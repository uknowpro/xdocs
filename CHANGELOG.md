# Changelog

## 0.5.0-alpha.5

- 화면 빌드에 포함된 UI 라이브러리, 서버 전용 PostgreSQL·Redis 패키지와 ExcelJS 브라우저 배포본을 데스크톱 설치 파일에서 제외했습니다.
- 세 운영체제의 패키징 검사에서 배포용 앱을 직접 실행해 노트·시트·인프라·IaCD를 검증합니다.

## 0.5.0-alpha.4

- 노트와 캔버스를 하나의 페이지 트리에서 이동하고 순서를 조정할 수 있습니다.
- IaCD 경계 접기·배치 잠금·운영 주석·참조선 편집과 생성 IaC 변경 비교를 지원합니다.
- Terraform HCL/JSON에서 가져온 직접 소속 참조를 변경하고 다시 추출할 수 있습니다.

## 0.5.0-alpha.3

- 멀티클라우드 설계 기본 보기를 클라우드·네트워크·서브넷·서비스 경계 도면으로 변경했습니다. 드래그로 소속을 변경하고 경계·참조선 SVG를 각각 내보낼 수 있습니다.

## 0.5.0-alpha.2

- IaCD AWS 드로잉에 계정·리전 경계, 서비스 심볼, 방향선·라벨, 계정 간 백업 예제와 SVG 추출을 추가했습니다.
- 노트와 캔버스 목록을 분리하고 ID로 원본을 참조하는 캔버스 미리보기를 추가했습니다.
- 보관함 아래에 노트를 모으고 문서 생성 도구와 아이콘을 구분했습니다. Jenkins 내보내기 파일명을 수정했습니다.

## 0.5.0-alpha.1 — IaCD 및 자동화 캔버스

- 새 노트 생성 응답 전 이전 편집기에 입력되던 경합 수정.

- 시각적 컴포넌트 배치·연결·속성·실행 취소, SVG·코드 ZIP 추출.
- AWS·Azure·GCP Terraform, AWS CloudFormation, Kubernetes manifest·Helm chart 생성.
- Terraform HCL/JSON 역변환, 알 수 없는 리소스·원본 설정 보존, 제한된 문자열 속성 override.
- 공식 Azure AVM 3종과 WAF 5개 축 검토 기록.
- GitHub Actions·Jenkins·Ansible 및 CloudFormation 전용 캔버스에서 원본 가져오기, 카드 배치, 블록 편집·추가, 파일 내보내기 지원.

## 0.4.0-alpha.1 — 2026-11-17

- Terraform/OpenTofu JSON, Kubernetes 및 Compose YAML/JSON을 제한된 요약으로 가져오기.
- 리소스 목록·관계·운영 메모, 변경 비교, 연결된 운영 절차·ADR 노트, TSV 복사와 HTML/PDF 표 내보내기.
- 원본·환경변수·Secret 내용을 보관하지 않는 필드 허용 방식과 별도 작업 스레드 처리.
- Linux·macOS·Windows 설치 파일을 개발용 프리릴리스로 배포. 서명·공증·실기기 업그레이드는 미검증.

## 0.3.0

- 시트 탭형 테이블, Excel/CSV/TSV 가져오기, 탭 구분 범위 복사·붙여넣기, 노트 표 복제, HTML/PDF 표 내보내기.
- DRM 비우회 원본 첨부·로컬 앱 열기와 Windows Excel 읽기 전용 대체 경로.
- 조직 첨부파일 동기화, 문서별 편집 제한, 이력 조회·복원.
- Markdown 블록 공동 편집, 참여자 위치 공유, 오프라인 재시작 복구 검증.
- 목록 페이지네이션, 본문 지연 로딩, 메모리 개선과 5천 노트 벤치마크.
- 별도 서명 릴리스 워크플로. 실기기·인증서·운영 SSO 검증은 별도 진행.

## 0.2.0 — 2026-11-17

- Add Markdown block editing, block ordering and stable note-link selection.
- Add history and trash restoration, filesystem watching, image/PDF attachments and HTML import.
- Preserve v0.1 Markdown originals and note IDs during index upgrades; gate future index versions.
- Move local storage work to a worker, add FTS and incremental indexing, and add graph filters.
- Add PostgreSQL workspaces, versioned writes, membership roles, audit events and Redis notifications.
- Add OIDC/PKCE login, secure token persistence when available, durable offline changes and conflict copies.
- Add Yjs Markdown text collaboration with local pending state and participant presence.
- Add manual update controls and multi-platform packaging CI.
- Shorten README; move detailed usage and roadmap into separate documents.

This is a development alpha. Production SSO policies, signed upgrade installation, and real macOS/Windows validation remain release prerequisites. Back up personal vaults and unsent organization data before upgrading.

## 0.1.0 — 2026-11-17

- Initial Electron application with monochrome themes, local Markdown, SQLite search, backlinks, graph and Markdown/HTML/PDF export.
