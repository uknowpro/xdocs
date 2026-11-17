# xdocs

**생각을 쓰고, 지식을 연결하는 로컬 노트 앱.**

Markdown 파일은 내 폴더에, 검색·연결 정보는 SQLite에 저장합니다. 로그인 없이 오프라인에서 사용할 수 있습니다. 현재는 **v0.5.0-alpha.3 개발용 알파**입니다.

![다크 테마 노트 화면과 연결 그래프](docs/images/dark.png)

## 주요 기능

- 화이트·그레이·다크·시스템 테마
- Markdown·블록 편집, 자동 저장·변경 이력·휴지통 복원
- 제목·본문 검색, 노트 링크·백링크·그래프
- 이미지·PDF 첨부, Markdown·HTML 가져오기, Markdown·HTML·PDF 내보내기
- 시트 탭형 테이블·Excel/CSV/TSV 가져오기·탭 구분 클립보드
- Terraform/OpenTofu·Kubernetes·Compose 인프라 목록·관계·운영 메모·변경 비교
- 조직 보관함·SSO·오프라인 동기화·블록 공동 편집·문서별 편집 제한

[설치 파일 다운로드](https://github.com/uknowpro/xdocs/releases/tag/v0.5.0-alpha.3) — 코드 서명·공증 없는 개발용 프리릴리스입니다.

IaCD의 기본 경계 도면에서 **AWS VPC → Subnet → EC2**, **Azure Resource Group → VNet → Subnet**, **GCP VPC → Subnetwork → VM**을 중첩해서 표시합니다. 속성 또는 드래그로 소속을 변경하고 Terraform·CloudFormation·Helm으로 내보낼 수 있습니다. 사이드바의 **새 자동화·스택 캔버스**에서 GitHub Actions, Ansible, Jenkins Declarative, CloudFormation 파일을 가져와 카드별 원문을 편집할 수 있습니다. [캔버스 사용법](docs/automation-canvas-review.md)

main의 보관함 **페이지 트리**에서 노트와 캔버스를 함께 탐색합니다. 페이지 옆 **+**로 하위 노트나 캔버스를 추가할 수 있습니다. 페이지를 끌거나 **⋯** 메뉴로 하위 트리를 이동하고 순서를 조정합니다. 일반 노트의 **캔버스 미리보기 삽입**으로 원본을 연결하세요. 미리보기를 누르면 같은 캔버스가 열립니다.

<details>
<summary>AWS 계정 간 백업 드로잉과 노트 미리보기</summary>

![AWS Organizations 내 두 계정과 리전, KMS 키 및 백업 볼트 사이의 연결](docs/images/aws-drawing.png)

![노트에 삽입된 캔버스 미리보기](docs/images/canvas-embed.png)

</details>

<details>
<summary>IaCD 아키텍처 캔버스 보기</summary>

![AWS·Azure·GCP·Kubernetes 경계와 소속 리소스를 중첩한 IaCD 캔버스](docs/images/iacd.png)

![EC2 소속 서브넷 변경 전후의 CloudFormation 코드 비교](docs/images/iac-changes.png)

</details>

<details>
<summary>GitHub Actions 캔버스 보기</summary>

![빌드 검증과 패키징 Job 및 선택한 Job의 YAML 블록](docs/images/workflow.png)

</details>

## 실행

Node.js 24 이상과 데스크톱 환경이 필요합니다.

```sh
git clone https://github.com/uknowpro/xdocs.git
cd xdocs
npm ci
npm start
```

앱에서 보관함 폴더를 선택하세요. `npm run dev`는 브라우저 저장소를 사용하는 UI 미리보기이며 실제 파일 저장은 데스크톱 앱에서 지원합니다.

## 업데이트와 데이터

**앱 폴더 밖에 둔 보관함의 Markdown 원본은 앱 코드 업데이트와 분리되어 유지됩니다.** 같은 보관함을 다시 열면 기존 노트를 읽습니다. SQLite는 파일에서 재생성할 수 있는 색인입니다.

v0.1 보관함의 원본·ID 보존과 색인 갱신을 테스트했습니다. 설치형 업데이트 UI는 포함되어 있으나 서명된 실제 릴리스 간 설치 검증은 아직 필요합니다. 업데이트 전에는 저장을 마치고 앱을 종료한 뒤 **보관함 전체를 백업**하세요. 브라우저 미리보기 데이터는 브라우저 데이터 삭제 시 사라질 수 있습니다.

## 개발

```sh
npm test              # 저장소 테스트
npm run build         # 타입 검사와 빌드
npm run test:ui       # Playwright UI 테스트
npm run test:desktop  # 빌드 후 Electron 실행 검증
npm run dist          # 현재 OS 패키징
```

Ubuntu와 GitHub Actions의 macOS·Windows에서 기본 실행 검사를 통과했습니다. 사용자 기기에서의 설치·업데이트와 서명 검증은 별도로 필요합니다.

[IaCD 사용법](docs/iacd.md) · [인프라 문서](docs/infrastructure.md) · [시트 사용법](docs/sheets.md) · [사용·개발 가이드](docs/guide.md) · [조직 서버 설정](docs/server.md) · [아키텍처](docs/architecture.md) · [MIT License](LICENSE)
