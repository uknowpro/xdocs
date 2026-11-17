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

## v0.4.0-alpha.1 인프라 문서

- 단위 테스트 24개 통과: 세 형식의 리소스·관계, 비밀값 제외, Terraform sensitive 표시, YAML 잘못된 구조, 스냅샷 직렬화·비교 및 기존 저장소 회귀 포함.
- 브라우저 테스트 8개 통과: 기존 편집·시트·저장 경합과 인프라 메모 재열기·세 테마 화면 포함.
- `npm run test:infrastructure`로 실제 Electron 파일 선택→요약 노트 생성→메모 저장→재가져오기 비교→메모 유지→관계 표시→HTML 표 내보내기→연결된 운영 절차 노트 생성 확인. 원본 파일 불변과 비밀값 미저장 검사.
- `npm run build` 타입 검사와 프로덕션 빌드 통과. 세 OS 패키징 CI에서도 인프라 데스크톱 검사를 실행합니다.

입력은 테스트용 구성입니다. 실제 provider·클러스터·운영 환경에 연결하지 않았으며 관계 완전성이나 실제 배포 상태를 검증한 것은 아닙니다.

## IaCD main 개발분 — 2026-11-18

- 단위 테스트 33개, 브라우저 UI 테스트 11개 통과. 새 테스트는 클라우드·AVM·CloudFormation 코드, 의존 대상 포함 추출, 원본·미지원 리소스 보존, 단순 속성 override, 연결 오류, 문자열 표현식의 문자 그대로 보존, 기존 노트 회귀를 포함합니다.
- 실제 Electron에서 HCL 작업 스레드 가져오기, 원본 보관 확인 UI, 알 수 없는 리소스 표시, 속성 수정·저장·override, ZIP 파일 선택·내보내기, 원본 불변을 확인했습니다.
- Terraform 1.13.5로 생성 fixture의 `init -backend=false`와 `validate` 통과. AWS·AzureRM·Google·AzAPI provider 및 고정 버전 AVM 3종을 포함합니다. 유효한 테스트 공개키를 사용하며 실제 계정에 연결하거나 plan/apply하지 않았습니다.
- Helm 4.3.1에서 `helm lint` 및 `helm template` 통과. 생성된 chart는 apiVersion v2이며 렌더링 결과의 namespace·selector·port를 검사합니다.
- cfn-lint 1.60.1로 AWS VPC·Subnet·EC2·S3 CloudFormation 템플릿 검사 통과. AWS에 스택을 생성하지 않았습니다.
- 화이트·그레이·다크 캔버스, 드래그·연결·실행 취소, 필수값 미입력 시 추출 차단, WAF 검토 기록 재열기를 확인했습니다.

이 검증은 구문·스키마·로컬 앱 동작 기준입니다. 실제 계정 정책·서비스 제한·비용·가용성·클러스터 admission 및 WAF 준수는 검증하지 않았습니다. GitHub Actions·Jenkins·Ansible 캔버스는 구현되지 않은 검토 문서 범위입니다.

IaCD Linux 디렉터리 패키지에서도 HCL 작업 스레드·원본 보존·ZIP 추출 검사를 통과했습니다. CI에서 발견한 새 노트 생성 응답 전 입력 경합은 생성 중 편집기를 대기시키도록 수정하고, 지연 생성 응답을 재현한 브라우저 테스트로 입력이 새 노트 ID에 저장되는 것을 확인했습니다.
