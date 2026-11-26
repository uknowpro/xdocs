# Changelog

## 0.5.36

- Open new xcode sessions directly in chat when a default connection is saved, and indicate when the saved token is in use.
- Preview the next queued message and its attachments. Send a selected message immediately, or pause follow-ups while the current response continues.
- Restore queue pause and rate-limit states after restart. Flag interrupted requests whose outcome needs review, and preserve completed harness stages.
- Inspect and pause queues from the session list. Reorder and cancel selected messages in batches, and navigate the queue with keyboard shortcuts.

## 0.5.35

- Match the Windows title bar and window-control colors to the xdocs theme. System mode follows Windows appearance changes.

## 0.5.34

- Organize Preferences into General, Workspace, xcode Defaults, Organization, and About.
- Save a default model connection for new xcode sessions. Review connection changes before saving individual sessions.
- Preview JSON changes with masked tokens, group session settings by task, and stop automatic requests from the conversation.
- Show the active step in organization sign-in. Display Analyzer input sources and Kubernetes versions alongside results.

## 0.5.33

- Allow explicitly approved intranet HTTP endpoints per xcode session and complete OpenAI-compatible `/v1` base URLs automatically.

## 0.5.32

- Use the operating system’s proxy settings for xcode requests and clarify proxy, certificate, and redirect errors.

## 0.5.31

- Show the actionable cause of xcode chat failures, including authentication, address, and connection errors.

## 0.5.30

- Bundle kubewiser 0.2.0-alpha.12 for local Kubernetes manifest, Helm, and upgrade analysis.

## 0.5.29

- Reopen Office output to verify selected and excluded fields and spreadsheet formulas.
- Resume Office reviews and compare changed template fields.
- Undo selected notes from a saved batch, and search workspace review history by note, form or citation.
- Record the exact saved Office copy and compare its fingerprint from review history.
- Back up and restore Office drafts and review records, skip duplicates, retry failed note writes, and filter grouped history by date, session and result.

## 0.5.28

- Review original and proposed values before saving a Word or Excel copy. Select which fields to write, record approvals and reasons, and export the review as Markdown.
- Select answer blocks in their original Markdown. Resume draft note edits after restarting, review conflicting notes, and open saved notes from the batch result.
- Return from an edited note to the exact answer, applied content, and checked citations. Export note changes and Office review reasons from the session.

## 0.5.27

- Attach workspace notes, sheet ranges and xinfra resources. Inspect citations alongside the answer, open the original sheet range or resource, and compare the sent snapshot with its current source.
- Apply a selected part of an answer to one or more notes. Review and select the edits, track them by session, and preview an undo.
- Expand verified Word and Excel evidence per field and filter missing or conflicting evidence.
- Review queued execution settings and choose the harness saved at enqueue time or the current session harness.

## 0.5.26

- Preserve unsent attachments across restarts. Queue, reorder or redirect follow-ups while keeping received text. Retry a smaller request after a model context limit.
- Search questions and answers, quote a selection, branch a conversation, or save an answer to a linked workspace note.
- Inspect cited Excel cells and Word paragraphs in the imported snapshot. Keep your reading position while new answers arrive.
- Exercise session recovery, concurrent queues and compact chat controls in desktop integration tests.

## 0.5.25

- Right-click a sheet cell or row number to delete that row. Right-click inside a multi-row selection to delete all selected data rows. The menu stays inside the window and preserves the designated header row.
- The xcode session title, model name and settings use the available page width. The conversation and message composer stay centered.

## 0.5.24

- Make sheets and chat use the available window height. Keep input and send controls visible with attachments, and focus invalid session JSON settings.
- Keep the selected design and create button visible in the catalog. Fit cloud diagrams, follow Terraform declarations and step between changed IaC files.
- Show complete paths for truncated tree entries, compact the graph controls, group long forms and compare sync conflicts alongside their resolution actions.
- Group Analyzer evidence by file, restore selected paths after rescanning, and remember source positions in infrastructure and automation canvases.

## 0.5.23

- Search offline AWS, Azure and Google Cloud component palettes and edit Terraform arguments using provider-schema forms. Connect resources, inspect regional boundaries and navigate between canvas nodes and Terraform declarations.
- Review provider version changes, validate exported projects with a local Terraform or OpenTofu installation, and see validation results for five enterprise architecture templates.

## 0.5.22

- Fill an attached Word template or confirm a local template path in chat. Review proposed values, source locations, missing fields and conflicts before saving a separate copy. Plain-text Word controls and optional underscore fields are supported.
- Select and extend entire sheet rows and columns with Shift, then copy as tab-separated values.
- Explore Azure secured virtual hubs, cross-region Google Cloud backends and VPC-to-VPC HA VPN using offline diagrams linked to Terraform. Card layout and declaration navigation are covered by regression tests.

## 0.5.21

- Explore seven redesigned Azure and GCP architecture templates offline and jump from a diagram resource to its Terraform declaration.
- Select sheet ranges with Shift+arrow keys and use F2 to select text within a cell. Retry individual files after a partial folder import.

## 0.5.20

- Remove the persistent selection and clipboard shortcut instructions from sheets. Successful copies are silent, and selected cells still copy as tab-separated values.

## 0.5.19

- Remove five tall, list-style AWS diagrams from the template gallery. The four AWS architecture case studies remain available.

## 0.5.18

- Simplify Analyzer to Network, Helm, Manifest and Kubernetes Upgrade while keeping all six analysis paths.
- Display the first sheet row as column headers, keep body row numbers and prevent numbers from covering the header corner when scrolling.
- Undo and redo workspace page moves with Ctrl+Z and Ctrl+Shift+Z (Command on macOS).
- Save xcode settings and return to the current draft. Find roles and templates in advanced settings, and edit retry intervals without premature numeric resets.
- Create a harness from the workspace and folder creation menus.

## 0.5.17

- Open Word selection and Office forms from the attachment menu. Applying a Word or Excel form harness opens the form automatically.
- Group Word capture and revision actions beneath their related controls.

## 0.5.16

- Review field values and sources before exporting copies of Word and Excel forms. Advanced Word templates can use an optional local python-docx-template environment installed with user consent.
- Search 22 job roles and preview 29 task harnesses. Track running, waiting, completed and failed sessions in the page tree.
- Read HWPX, OpenDocument and Office template attachments in xcode.

## 0.5.15

- Browse 56 reviewed architecture templates across AWS, Azure, GCP and multi-cloud designs. Check required Terraform inputs and deployment prerequisites before creating a page.
- Open a template card’s featured connection to highlight both resources and their enclosing boundaries. Follow the connection to its Terraform property and choose a source line when several locations match.
- Review the previous and new placement targets alongside the Terraform diff. Undo restores the diagram and code together.
- Trace Terraform plan instances into local modules and inspect overlapping subnet ranges. Round-trip checks cover reviewed references, module paths and Terraform source contents across the catalog.

## 0.5.14

- Preview reusable architecture components before inserting them. Edit names, IPv4 CIDRs and external connections, detect overlapping subnets in the same AWS, Azure or GCP network, and undo the insertion in one step.
- Inspect local Terraform and OpenTofu plans by module, action and instance address. Review replacement paths and save selected changes, affected diagram resources and a checklist to a linked block note with sensitive values masked.
- Browse enterprise architecture templates, trace Terraform changes and resume reading notes. The compact workspace tree supports keyboard navigation and leaves more room for pages.

## 0.5.13

- Review live Terraform beside the architecture canvas, copy the current file and compare changed lines with the version from when you opened the page.
- Focus on a resource and its neighbours, follow incoming and outgoing references, and jump from a design issue to the affected resource. Filter template previews by scenario and provider.
- Manage notes and folders from the workspace tree, confirm folder deletion, remove individual items from the trash or empty it. Switch xcode sessions using tabs when the sidebar is collapsed.
- Create new notes in the block editor and import CSV files through the spreadsheet importer.

## 0.5.12

- Updated both README screenshot galleries and removed the legacy project license file from the desktop package and license screen.

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
