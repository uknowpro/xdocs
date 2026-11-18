# 개발 로드맵

기준: v0.5.0-alpha.3 개발용 알파. README에는 로드맵을 싣지 않고 이 문서에서 관리합니다.

## 구현 및 로컬 검증 완료

- [x] 화이트·그레이·다크·시스템 테마, 로컬 Markdown + SQLite
- [x] Markdown 호환 블록 편집, 블록 이동, ID 기반 링크 선택기
- [x] 로컬 이미지·PDF 첨부, PDF 보기, HTML 가져오기
- [x] 파일 변경 감지, 휴지통 복원 UI, 변경 이력과 복원
- [x] v0.1 보관함 호환성 검증, 색인 버전 검사, 원본 Markdown 유지
- [x] SQLite FTS 검색, 변경된 노트만 색인 갱신, 저장소 작업 스레드 분리
- [x] 그래프 제목·폴더·태그 필터, 표시 개수 선택, 연결 계산 최적화
- [x] PostgreSQL 조직 보관함, 소속 사용자별 owner/editor/reader 권한, 문서 버전·감사 이벤트
- [x] 시스템 브라우저 OIDC + PKCE 로그인, 갱신 토큰, OS 암호화 저장 가능 시 토큰 보관
- [x] 개인·조직 저장 분리, 영속적인 오프라인 변경 대기열, 버전 충돌과 사본 보존
- [x] Markdown 텍스트 공동 편집: Yjs 병합, 약 1초 간격 교환, 로컬 미전송 상태 보존
- [x] Redis 변경 이벤트와 공동 편집 참여 상태, Redis 없는 단일 프로세스 동작
- [x] 수동 업데이트 확인·다운로드·저장 후 재시작 UI 및 GitHub 배포 설정
- [x] Linux/macOS/Windows 패키징 CI 구성

위 목록의 동작 검증은 Ubuntu 개발 환경과 격리된 PostgreSQL·Redis·Keycloak 환경 기준입니다. 패키징 CI 설정이 실제 OS별 배포 검증 완료를 뜻하지는 않습니다.

## 이번 확장 구현·로컬 검증

- [x] 대규모 보관함 벤치마크, 목록 페이지네이션과 본문 지연 로딩, 전체 본문 누적 메모리 개선
- [x] 조직 첨부파일 PostgreSQL 저장·계정별 로컬 캐시·미전송 대기열·다른 기기 조회
- [x] 소유자가 지정하는 문서별 읽기 전용 예외 권한과 조직 변경 이력 조회·복원 UI
- [x] Markdown 블록별 Yjs 편집, 참여자별 블록·커서 위치 공유, 네트워크 실패 후 재시작 복구
- [x] 8개 클라이언트 10분 누적 편집·지연 전송·재전송 부하 검증: 5,728개 변경, 유실·중복 0
- [x] 시트 탭형 테이블·다중 시트 가져오기·셀 편집·탭 구분 클립보드·노트 표 복제
- [x] DRM 비우회 원본 첨부/로컬 앱 열기, Windows Excel 읽기 전용 대체 경로 구현
- [x] 서명 설정이 없으면 중단하는 별도 릴리스 워크플로, 업데이트 메타데이터와 초안 릴리스

측정 조건과 실행한 검증은 [검증 기록](validation.md), 시트 호환 범위는 [시트 사용법](sheets.md), 서명 절차는 [릴리스 안내](releases.md)에 정리합니다.

## 인프라 문서 확장

- [x] Terraform/OpenTofu JSON·Kubernetes·Compose 파일 가져오기와 허용 필드 요약
- [x] 리소스 목록·관계·운영 메모, 이전 스냅샷 비교와 메모 유지
- [x] 연결된 운영 절차·ADR 노트 생성, TSV 복사와 HTML/PDF 표 내보내기
- 범위와 제한: [인프라 문서](infrastructure.md). 실시간 인프라 제어·배포 도구는 포함하지 않습니다.

## 외부 환경이 필요한 최종 검증

- [x] GitHub Actions의 Linux·macOS·Windows 단위 테스트·기본 Electron 실행 검사·서명하지 않은 설치 파일 생성
- [ ] 사용자 기기의 macOS·Windows 설치·삭제·업데이트 검증과 서명·공증
- [ ] 서명된 릴리스 발행 후 실제 버전 간 다운로드·설치 검증
- [ ] 운영 SSO 제공자·그룹 정책 검증; SAML은 Keycloak 등의 OIDC 브로커 연계를 통해 적용
- [ ] Windows Excel 설치 환경에서 인증·권한 거부·프로세스 정리 실사용 검증

## 구현 범위

- 블록 편집은 기본 Markdown 문법·목록·할 일·표를 지원합니다. HTML·프런트매터·첨부 이미지 등 보존이 필요한 확장 문법은 원문 모드를 사용합니다.
- 조직 공동 편집은 별도 창에서 빈 줄 기준 Markdown 블록을 각각 편집합니다. 기존 텍스트 세션은 호환 모드를 유지합니다. 리치 텍스트 ProseMirror 블록 공동 편집과는 구분합니다. 일반 편집이 같은 문서를 변경하면 세대를 구분하여 덮어쓰지 않고 사본 보존을 안내합니다.
- 조직 권한은 보관함에서 상속하며 소유자는 특정 편집자의 특정 문서를 읽기 전용으로 제한할 수 있습니다. 문서 숨김/열람 거부 ACL은 지원하지 않습니다. 개인 보관함을 서버에 자동 업로드하지 않습니다.
- Redis는 임시 참여 상태와 변경 알림용입니다. 문서와 공동 편집 상태는 PostgreSQL에 저장합니다.

## IaCD — main 개발분

- [x] AWS·Azure·GCP·Kubernetes 시각적 컴포넌트 배치·연결·속성 편집
- [x] Terraform·CloudFormation·manifest·Helm 코드 생성·미리보기·ZIP·SVG 추출
- [x] Terraform HCL/JSON 역변환, 원본과 미지원 리소스 보존
- [x] Azure AVM 고정 버전 3종, WAF 검토 기록
- [x] [자동화 캔버스 가능성 검토](automation-canvas-review.md)
- [x] GitHub Actions, Ansible, Jenkins Declarative 캔버스 원문 가져오기·편집·추출
- [x] CloudFormation 리소스 그래프 및 조건·중첩 스택 선언 원문 보존

구현 범위·한계·사용법은 [IaCD](iacd.md)에 정리합니다. 자동화 캔버스 범위는 [사용법](automation-canvas-review.md)에 정리합니다.

## 페이지와 IaCD 편집

- [x] 페이지·하위 트리 이동, 형제 순서 조정, 직전 이동 실행 취소
- [x] 경계 도면에서 선택한 리소스의 직접 참조 표시
- [x] 페이지를 연 시점 또는 지정한 기준과 생성 IaC 파일 비교

[draw.io를 참고한 캔버스 개선 현황](drawio-improvements.md)

## AppFlowy를 참고한 캔버스 편집 계획

목표는 작은 노트북에서도 도면에서 리소스를 찾고, 속성을 고친 뒤, 바뀐 코드까지 같은 페이지에서 확인하는 것이다. 첫 적용 대상은 IaCD 멀티클라우드 경계 도면이다. 세 단계의 기능을 0.5.1에 반영했다. 아래에는 설계 기준과 검증 동작을 기록한다.

### 1. 리소스 찾기와 속성 편집

- 현재 페이지의 리소스를 이름·유형·Terraform 주소로 검색하는 목록을 제공한다. 목록과 도면은 같은 리소스 ID를 선택한다. 접힌 VPC 안의 EC2를 선택하면 해당 경계를 펼쳐 위치를 보여준다.
- 선택한 항목의 속성을 바로 열고 닫을 수 있게 한다. 넓은 창에서는 도면 옆에 표시하고 좁은 창에서는 도면 위에 연다. 닫으면 방금 선택한 도형으로 키보드 포커스를 돌린다.
- 완료 기준은 780×600 창과 Windows 150% 배율에서 마우스 없이 EC2를 찾아 속성을 열고 도면으로 돌아오는 것이다. 검색·선택·상세 열기 전후의 Terraform 출력은 같아야 한다.

AppFlowy의 행 상세 화면은 선택한 행의 컨트롤러와 필드 컨트롤러로 속성을 편집한다. xdocs에서는 기존 노드 ID와 속성 편집기를 재사용한다. [AppFlowy 행 상세 구현](https://github.com/AppFlowy-IO/AppFlowy/blob/8fcee27d9bd93aad4ee0191d5d8d915d6a9a4e93/frontend/appflowy_flutter/lib/plugins/database/widgets/row/row_detail.dart)

### 2. 선택한 위치에서 추가·이동

- 서브넷을 선택한 상태에서 추가 메뉴를 열면 그 안에 배치할 수 있는 컴포넌트부터 제시한다. 자유 배치에서는 일반 추가 메뉴를 쓴다. 명령 검색은 캔버스에 포커스가 있을 때만 동작하도록 한다.
- 기존 드래그와 속성 선택에 키보드용 ‘다른 경계로 이동’을 추가한다. 세 경로가 같은 소속 변경 함수를 호출하고 같은 IaC 차이를 만들어야 한다. 직접 참조를 확인할 수 없는 가져온 표현식과 잠긴 리소스는 기존 제약을 따른다.
- 완료 기준은 EC2를 다른 서브넷으로 옮겨 변경 비교에서 해당 참조를 확인하고, 실행 취소 한 번으로 원래 코드를 복구하는 것이다. 추출한 Terraform을 새 캔버스로 가져왔을 때 소속도 같아야 한다.

AppFlowy 보드는 그룹 사이의 카드 이동을 데이터 변경으로 전달하고, 문서 편집기는 편집 문맥에 맞춰 삽입 메뉴를 구성한다. [보드 이동 처리](https://github.com/AppFlowy-IO/AppFlowy/blob/8fcee27d9bd93aad4ee0191d5d8d915d6a9a4e93/frontend/appflowy_flutter/lib/plugins/database/board/application/board_bloc.dart) · [삽입 메뉴 구성](https://github.com/AppFlowy-IO/AppFlowy/blob/8fcee27d9bd93aad4ee0191d5d8d915d6a9a4e93/frontend/appflowy_flutter/lib/plugins/document/presentation/editor_plugins/slash_menu/slash_menu_items_builder.dart)

### 3. AWS 드로잉과 자동화 캔버스로 확장

| 캔버스 | 적용할 편집 동작 | 완료 기준 |
| --- | --- | --- |
| AWS 드로잉 | 계정·리전·서비스 검색, 선택한 서비스의 상세 열기 | 같은 이름의 서비스도 소속 계정으로 구별하고 SVG에서 선택한 서비스 위치를 확인한다. |
| GitHub Actions·Jenkins·Ansible | Job·Stage·Task 검색, 카드에서 원문 편집으로 이동 | 카드 위치만 옮기면 추출한 파일이 바이트 단위로 동일하다. 원문 변경은 기존 파서로 검증한다. |
| CloudFormation | 논리 ID로 리소스 찾기, 카드에서 해당 선언 열기 | 도면을 재배치해도 원문의 조건·참조가 유지된다. |

각 단계에서 기존 alpha.6 문서를 열어 편집·저장·재열기를 검사한다. 검색어와 현재 선택은 화면 상태로 관리한다. 노트에 삽입한 미리보기는 기존 캔버스 페이지를 계속 참조한다.

## Analyzer

[네트워크 도면·Kubernetes 호환성 리포트의 로컬 엔진 검토와 연동 순서](analyzer.md)
