# v0.3.0 검증 기록

기준 환경: Ubuntu 데스크톱, Node.js 24, Electron, 격리된 PostgreSQL 17·Redis 7·Keycloak 26.4. 테스트 파일·서버 스키마는 운영 데이터와 분리합니다.

## 실행한 검증

- `npm test`: 저장소·기존 데이터 호환성·오프라인 대기열·계정 분리·Excel 다중 시트·TSV·보호 파일 거부.
- `npm run test:ui`: 화이트/그레이/다크·검색·그래프·블록 편집과 시트 탭/셀 편집/여러 줄 붙여넣기/범위 복사/재로딩 저장.
- `npm run test:desktop`: 실제 Electron의 파일·SQLite·Markdown/HTML/PDF 내보내기.
- `npm run test:features`: 외부 파일 감지·이력 복원·휴지통·첨부·SSO UI·조직 저장·블록 공동 편집.
- `npm run test:sheets`: 실제 파일 선택→다중 시트→셀 수정→Markdown 저장, 원본 불변, 읽기 실패 원본 첨부.
- `npm run test:server`: 역할·보관함 격리·문서별 읽기 전용 예외·첨부 불변/격리·충돌·이력·Redis 이벤트·블록 병합·커서 위치 공유·중복 전송.
- `npm run test:sso`: 실제 Keycloak PKCE, API 토큰 검증, 연결 실패 뒤 캐시 재시작/변경 병합, 두 기기 첨부 조회, 조직 이력 복원, 로그아웃.

## OS별 자동 검증

[GitHub Actions 실행](https://github.com/uknowpro/xdocs/actions/runs/44083551336)에서 Ubuntu·macOS·Windows의 단위 테스트 19개, 빌드, Electron 파일 저장·SQLite·Markdown/HTML/PDF 내보내기 검사를 통과했고 AppImage·DEB·NSIS EXE·DMG·ZIP 산출물 생성을 완료했습니다. 서명하지 않은 CI 산출물입니다. [기본 검사](https://github.com/uknowpro/xdocs/actions/runs/44083552110)는 브라우저 테스트 7개와 서버 통합 검사까지 통과했습니다.

Windows에서 발견한 지연된 파일 갱신과 입력의 경합은 동일 버전의 재로딩을 생략하고 요청 이후 입력된 초안을 보존하도록 수정했습니다. 지연 응답에 대한 브라우저 회귀 테스트를 포함합니다. Linux AppImage와 `.deb` 설치 파일 생성도 확인했습니다.

## 대규모 보관함

`npm run test:benchmark`는 임시 Markdown 5,000개를 만들고 첫 색인, 갱신, 검색, 목록 크기와 프로세스 최대 RSS를 측정합니다. 본문을 한 파일씩 읽고, 렌더러에는 미리보기·링크·태그만 전달하며 선택한 노트 본문만 따로 읽습니다. 사이드바는 100개, 서버 문서 목록은 20개씩 페이지를 나눕니다. 검색 결과 본문은 240자로 제한합니다.

측정 결과는 아래 JSON에 기록합니다. 숫자는 이 기기의 한 실행 결과이며 일반적인 성능 보장이 아닙니다.

```json
{
  "notes": 5000,
  "openMs": 47833,
  "refreshMs": 1347,
  "searchMs": 80,
  "snapshotBytes": 3795970,
  "peakRssMiB": 118
}
```

## 공동 편집 부하

`npm run test:soak`는 기본 60초 동안 8개의 Yjs 클라이언트가 PostgreSQL에 편집을 반복합니다. 7번째 변경마다 전송을 지연하고 마지막에 모든 기기의 상태를 재전송하여 변경 개수·중복·버전 멱등성을 검사합니다. `XDOCS_SOAK_SECONDS=600 npm run test:soak`로 10분 검증을 재현할 수 있습니다. 개발 환경의 제한된 부하 검증이며 수일간 연결·대규모 다중 조직의 운영 부하를 보장하지 않습니다.

실행 결과(10분, 8개 클라이언트):

```json
{
  "seconds": 600,
  "clients": 8,
  "edits": 5728,
  "peakStateBytes": 96275,
  "peakRssMiB": 274,
  "lostEdits": 0,
  "duplicateEdits": 0
}
```

## 검증되지 않은 외부 환경

macOS·Windows 설치/삭제/업그레이드, 실제 인증서 서명·Apple 공증, 서명된 릴리스 간 업데이트, 운영 SSO/SAML·조직 그룹 정책, Windows Excel COM 실행은 해당 환경이 없어 완료로 표시하지 않습니다. Linux 디렉터리 패키징과 실행은 별도로 검증합니다.
