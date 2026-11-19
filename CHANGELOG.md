# Changelog

## 0.5.11

- Updated the bundled Kubernetes Analyzer engine, kubewiser, from v0.2.0-alpha.8 to v0.2.0-alpha.10 on Windows, Ubuntu and macOS.

## 0.5.10

- Import, edit and export xcode connection and retry settings as JSON. Validation identifies invalid fields before applying changes. Exports omit API tokens.
- Chat errors include troubleshooting steps for authentication failures, missing endpoints or models, and unsupported inputs.

## 0.5.9

- Start an xcode session with the API URL, optional token and model ID. Connection diagnostics, retries and harness controls are grouped under advanced settings.

## 0.5.8

- **Chat in xcode sessions.** Follow the model’s streamed reply beneath your message. Press Enter to send or Shift+Enter for a new line. Copy a finished answer or expand its stage history. Session settings are available in the upper-right corner.
- **Resume interrupted work.** In a local workspace, reopen the session to review the partial reply and rerun from the first unfinished stage. Select project files to include with your next request.
- **Explore five architecture case studies.** Inspect zonal egress in Seoul, private EKS operations, three-cloud retail analytics, isolated Azure spokes and regional GCP Shared VPC egress. Select a component to inspect its Terraform source.
- **Verify workspace backups.** Create a backup with SHA-256 checksums and test a restore into a new folder before switching workspaces.

## 0.5.7

- xcode 세션에서 텍스트·이미지·문서를 첨부하고 하네스와 스킬을 조합해 모델의 스트리밍 응답을 받을 수 있습니다.
- 전송 미리보기, 서버별 대기열, 자동 요청 한도, 실행 기록과 텍스트·이미지·PDF 연결 진단을 추가했습니다.

## 0.5.6

- 환경 설정에서 PolyForm Internal Use 사용권과 내장 분석 도구 고지를 오프라인으로 읽을 수 있습니다.
- Analyzer의 네트워크 경로 및 발견 항목에서 프로젝트 원본 또는 Helm 원본 템플릿을 읽을 수 있습니다.
