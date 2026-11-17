# Changelog

## Unreleased — IaCD

- 새 노트 생성 응답 전 이전 편집기에 입력되던 경합 수정.

- 시각적 컴포넌트 배치·연결·속성·실행 취소, SVG·코드 ZIP 추출.
- AWS·Azure·GCP Terraform, AWS CloudFormation, Kubernetes manifest·Helm chart 생성.
- Terraform HCL/JSON 역변환, 알 수 없는 리소스·원본 설정 보존, 제한된 문자열 속성 override.
- 공식 Azure AVM 3종과 WAF 5개 축 검토 기록.
- GitHub Actions·Jenkins·Ansible 캔버스 적용 가능성 검토 문서 추가(기능 미구현).

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
