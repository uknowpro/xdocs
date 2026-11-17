# xdocs

로컬 Markdown 파일을 작성하고, 노트 사이의 연결을 탐색하는 데스크톱 앱입니다.

## 실행

Node.js 24 이상이 필요합니다.

```sh
npm ci
npm start
```

`npm start`는 프런트엔드를 빌드한 뒤 Electron 데스크톱 앱을 실행합니다. 처음 실행하면 보관함 폴더를 선택하세요. 기존 Markdown 폴더 또는 빈 폴더를 사용할 수 있습니다.

```sh
npm run dev       # 브라우저 UI 미리보기 (데모 노트, localStorage)
npm test          # 파일 저장 / 충돌 / SQLite 검증
npm run test:ui   # Playwright UI 검증; 먼저 npx playwright install chromium
npm run build    # 타입 검사 + 프로덕션 빌드
npm run dist     # 현재 OS용 설치 파일 생성
```

브라우저 미리보기는 실제 보관함을 사용하지 않습니다. 파일 저장과 SQLite는 Electron에서만 작동합니다.

## 구현된 기능

- 화이트 / 그레이 / 다크 / 시스템 테마와 선택 유지
- 폴더 선택, 기존 `.md` 재귀 검색, 새 노트, Markdown 가져오기
- Markdown 원문 편집 + 읽기 화면, 간단한 서식 도구, 한글 조합 중 자동 저장 지연
- 자동 저장, Ctrl/Cmd+S, 종료 전 저장 확인, 외부 변경 충돌 감지와 사본 저장
- `[[노트 제목]]`, `[[노트 ID|표시 이름]]`, 백링크, 로컬 / 전체 그래프
- SQLite 제목·본문 검색, Ctrl/Cmd+K
- Markdown / HTML / PDF 내보내기
- 원본을 `.xdocs/trash`에 보존하는 삭제

첫 버전의 편집기는 Markdown 원문 기반입니다. 블록 WYSIWYG, 드래그 정렬, 리치 미디어는 후속 범위입니다.

## 저장 구조

```text
my-vault/
  노트-xxxxxxxx.md
  기존폴더/기존노트.md
  .xdocs/
    index.sqlite       # 재생성 가능한 SQLite 색인
    trash/             # 삭제한 노트 원본
```

앱이 생성한 노트에는 `<!-- xdocs:id=UUID -->` 한 줄을 기록합니다. 본문은 Markdown 그대로입니다. 외부 Markdown에는 메타데이터를 강제로 추가하지 않습니다. 앱에서 생성한 노트의 ID 링크는 제목 변경에도 유지됩니다. 제목 링크는 제목이 바뀌면 자동 갱신하지 않습니다. 같은 제목이 여러 개면 ID 링크를 사용하세요. 외부 파일은 경로 기반 ID이므로 이름/경로 변경 시 ID가 달라집니다.

보관함 새로고침 버튼은 파일에서 SQLite 색인을 다시 생성합니다. 외부 파일 변경 자동 감시는 아직 없으며 저장 시 변경 여부를 확인합니다. 변경 감지부터 최종 파일 교체 사이의 극히 짧은 외부 쓰기 경쟁은 완전히 차단할 수 없으므로 동시에 같은 파일을 편집하지 않는 것을 권장합니다. 5 MB 초과 문서, 숨김 폴더, 심볼릭 링크, 20단계 초과 하위 폴더는 색인에서 제외됩니다.

휴지통 복원 UI는 아직 없습니다. `.xdocs/trash` 안의 파일을 보관함으로 옮기고 새로고침하면 복원됩니다. 전체 백업은 보관함 폴더를 복사하세요.

## 지원 범위와 제한

- 개발 대상: Ubuntu desktop, macOS, Windows 10 이상. 각 OS의 설치/서명 검증을 거친 정식 릴리스는 아직 아닙니다.
- PostgreSQL / Redis / SSO / 서버 동기화 / 공동 편집: 아직 구현하지 않았습니다. 설정 화면에서도 후속 개발로 표시합니다.
- HTML은 내보내기만 지원합니다. HTML 가져오기, PDF 뷰어·첨부·OCR은 후속 개발입니다.
- 내보내기는 문서 본문 기준이며 노트 간 링크·로컬 첨부파일 패키징은 아직 지원하지 않습니다. 외부 리소스 자동 요청을 막기 위해 이미지 표시를 제한합니다.
- PDF는 설치된 OS 폰트를 사용합니다. 한국어 폰트가 있는 환경에서 확인하세요.
- SQLite 검색은 부분 문자열 검색입니다. 대규모 보관함용 FTS 및 페이지네이션은 후속 개선입니다.
- 그래프는 가독성을 위해 최대 60개 노트를 표시합니다.

## 구조

- `desktop/store.mjs`: 파일 원본, 충돌 확인, SQLite 색인
- `desktop/main.mjs`: 폴더·파일 대화상자, 제한된 IPC, 내보내기
- `desktop/preload.cjs`: 렌더러에 노출하는 최소 API
- `src/`: React UI, 테마, Markdown 렌더링, 그래프
- `tests/`: 저장소 단위 테스트와 브라우저 UI 테스트

Electron은 sandbox/contextIsolation을 사용하며 렌더러의 Node 접근, 임의 탐색, 새 창, 권한 요청을 차단합니다. Markdown은 표시 전 정제합니다. 개인 노트·SQLite·환경변수·인증서·빌드 결과는 `.gitignore`에서 제외합니다. 보관함은 코드 저장소 밖에 두는 것을 권장합니다.

## 배포

`npm run dist`로 현재 운영체제용 패키지를 생성합니다. Linux AppImage/deb, macOS dmg, Windows NSIS 설정이 포함되어 있습니다. macOS 공증/코드 서명과 Windows 서명 인증서는 별도 설정이 필요합니다. 인증서와 SSO 자격증명을 저장소에 커밋하지 마세요.
