# 로컬 조직 서버와 SSO

개발 검증용 PostgreSQL·Redis·Keycloak 구성입니다. 설정의 비밀번호와 계정은 **로컬 개발 전용**이며 외부 서버에서 사용하지 마세요. 모든 포트는 `127.0.0.1`에 바인딩합니다.

## 시작

Docker Compose가 있는 환경에서:

```sh
docker compose -f server/compose.yml up -d
cp server/.env.example server/.env
npm run server
```

Keycloak 준비에는 시간이 걸릴 수 있습니다. API가 OIDC discovery 오류로 종료되면 Keycloak이 준비된 후 다시 실행하세요. Docker Compose가 없는 경우 Docker의 Compose 플러그인을 설치하거나 동일 설정으로 컨테이너를 실행해야 합니다.

다른 터미널에서 개발용 사용자를 조직 보관함에 등록합니다.

```sh
npm run server:grant -- 10000000-0000-4000-8000-000000000001 "개발팀" owner
```

`server:grant`는 서버 관리용 명령입니다. 기존 보관함에 권한을 부여하려면 마지막 인자로 출력된 보관함 UUID를 전달하세요. 역할은 `owner`, `editor`, `reader` 중 하나입니다.

## 앱에서 연결

1. `npm start`로 앱을 실행합니다.
2. **조직 보관함**에서 서버 주소 `http://127.0.0.1:4242`를 입력합니다.
3. **브라우저에서 SSO 로그인**을 선택합니다.
4. 개발 계정 `developer` / `local-development-only`로 로그인합니다.
5. 보관함을 열고 노트를 작성합니다.

관리 콘솔은 `http://127.0.0.1:58080`이며 개발 관리자 계정은 `admin` / `local-development-only`입니다. 개발용 사용자 subject는 `server/realm.json`에 고정되어 있습니다.

로그인 흐름은 Authorization Code + PKCE + state + nonce 검증입니다. 콜백 주소는 `http://127.0.0.1:43821/callback`입니다. 해당 포트를 다른 프로그램이 사용하면 로그인할 수 없습니다.

## 구성

| 환경변수           | 역할                                 |
| ------------------ | ------------------------------------ |
| `DATABASE_URL`     | PostgreSQL 연결                      |
| `REDIS_URL`        | 선택적 이벤트·참여 상태 Redis 연결   |
| `OIDC_ISSUER`      | 신뢰할 발급자                        |
| `OIDC_CLIENT_ID`   | 데스크톱용 public client             |
| `OIDC_AUDIENCE`    | API가 검사하는 access token audience |
| `OIDC_SCOPE`       | 기본값 `openid profile`              |
| `ALLOW_LOCAL_HTTP` | 로컬 OIDC HTTP 허용: 개발용 `1`      |
| `HOST`, `PORT`     | API 수신 주소·포트                   |

실제 조직에 연결할 때는 HTTPS 주소, public client의 콜백/PKCE 설정, API audience를 맞춰야 합니다. SAML 사용 조직은 Keycloak 같은 OIDC 브로커의 외부 IdP 연결로 연계할 수 있으나 이 구성은 별도 검증 대상입니다. 데스크톱 앱이 SAML assertion을 직접 처리하지는 않습니다.

## 데이터와 권한

- PostgreSQL: 보관함·사용자 권한·문서 버전·삭제 표식·감사 이벤트·공동 편집 상태·첨부파일 원본.
- Redis: 문서 변경 알림과 약 20초 동안 유지되는 공동 편집 참여 상태. 문서 원본을 저장하지 않습니다.
- 데스크톱: 계정별 조직 캐시, 일반 편집 대기열, 공동 편집 미전송 상태. 개인 보관함과 분리됩니다.
- 모든 문서 읽기·쓰기·이력·이벤트·공동 편집 요청에 보관함 권한을 확인합니다. 소유자는 문서의 **문서 권한**에서 편집자별 읽기 전용 예외를 설정할 수 있습니다. 소유자 관리 권한은 유지되며 열람자를 편집자로 올리거나 문서를 숨기지는 않습니다.
- 소유자는 `PUT /v1/workspaces/:id/members`로 구성원의 역할을 지정할 수 있습니다. 관리자용 UI는 아직 없습니다.

`GET /v1/workspaces`로 접근 가능한 보관함을 조회합니다. 문서 API는 `/v1/workspaces/:id/notes`, 이력은 `/:noteId/history`, 공동 편집은 `/:noteId/collaboration`입니다. 요청에는 발급자가 발행한 API audience용 Bearer access token이 필요합니다.

## 검증과 종료

```sh
npm run test:server
npm run test:sso
npm run build
npm run test:features
docker compose -f server/compose.yml down
```

`down`은 볼륨을 보존합니다. `down -v`는 데이터 볼륨을 삭제하므로 보존할 데이터가 있을 때 사용하지 마세요. 운영 배포 전에는 서명·TLS·백업·권한 회수·트래픽 제한·복구 절차와 부하 검증이 추가로 필요합니다.

## v0.3 확장

조직 첨부파일은 4 MB까지 PostgreSQL에 저장하고, 데스크톱 SQLite에 미전송 파일을 보관합니다. `/v1/workspaces/:id/assets/:filename`으로 전송·조회하며 기존 경로를 다른 내용으로 덮어쓰지 않습니다. 노트보다 첨부 전송을 먼저 시도합니다. 계정별 `asset_cache`의 미전송 파일도 백업 대상입니다.

이력 UI는 서버의 최근 100개 버전을 표시하며 복원도 새로운 버전으로 저장합니다. 문서별 편집 제한 API는 `/notes/:id/permissions`이며 소유자만 관리할 수 있습니다.

새 공동 편집 세션은 `?mode=blocks`로 시작하며 각 Markdown 블록을 Y.Text로 저장합니다. 참여자의 블록 ID·커서 오프셋은 Redis에 잠시 보관합니다. 커서는 최대 약 1초 지연된 위치 표시이며 문자 단위의 원격 캐럿 렌더링은 아닙니다. 기존 텍스트 세션과의 호환성은 유지합니다.
