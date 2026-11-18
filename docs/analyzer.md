# Analyzer 설계와 로컬 엔진 검토

워크스페이스 트리에 Analyzer 페이지를 만들고 프로젝트 경로, 선택한 차트·values·namespace, 시작·목표 Kubernetes 버전, 마지막 분석 시점을 저장한다. 첫 화면은 네트워크 도면과 버전 리포트를 제공한다. 아래는 연동 전 설계이며 실행 결과는 각 엔진의 로컬 체크아웃에서 얻었다.

| 프로젝트 | 확인한 결과 | xdocs 적용 |
| --- | --- | --- |
| [netspector](https://github.com/uknowpro/netspector/tree/08c54318e669) | Java·Python·설정 파일의 인아웃 단서, 파일·줄·근거, 후보와 미확정 상태, Ingress → Service → 워크로드 경로 | 프로젝트의 소스 및 선언 분석 엔진으로 사용한다. 같은 호스트를 쓴다는 이유로 서로 다른 서비스나 네임스페이스를 합치지 않는다. |
| [kubewiser](https://github.com/uknowpro/kubewiser/tree/16dc9d6b8e83) | 버전별 매니페스트 검사, 로컬 Helm 렌더링, 업그레이드 단계·조치·검사하지 못한 항목 | 호환성·업그레이드 리포트의 기준 엔진으로 사용한다. 스키마와 규칙 버전을 결과에 보관한다. |
| [netflow](https://github.com/uknowpro/netflow/tree/71115e761d26) | 실행 위치별 DNS·TCP·TLS·HTTP 연결 측정용 CLI | 후속 기능에서 사용자가 제공한 기존 측정 보고서를 같은 경로에 첨부한다. 실행 위치·측정 시점을 함께 표시한다. |
| [recompose](https://github.com/uknowpro/recompose/tree/42f0b622d60c) | Compose·Dockerfile에서 VM의 Java 실행 구성을 정리 | 향후 Compose·VM 분석 범위를 넓힐 때 서비스 식별 및 실행 설정 매핑을 참고한다. |

## 로컬 재현 결과

- netspector에서 `python3 -m netspector scan examples/java --format json`을 실행해 근거 위치를 포함한 발견 5건을 확인했다. `examples/network-map`에서는 발견 10건, 연결 경로 2건을 얻었다. 이 JSON에 기존 `build_graph(report)`를 적용하면 프로젝트 2개·노드 8개·선 7개다. Java·토폴로지·그래프 단위 테스트 42개가 통과했다. [Java 분석](https://github.com/uknowpro/netspector/blob/08c54318e669/netspector/java_analyzer.py) · [그래프 구성](https://github.com/uknowpro/netspector/blob/08c54318e669/netspector/network_graph.py)
- kubewiser를 로컬 소스에서 빌드했다. `scan files`로 동일한 `docs/examples/manifest.yaml`을 검사하자 beta CronJob이 1.24에서 경고, 1.25에서 오류였다. `plan upgrade --source docs/examples/manifest.yaml --from 1.24 --to 1.25 --format json`에는 1.25 단계와 `KW-API-REMOVED` 조치가 포함됐다. `scan helm --target-version 1.25 --release app --namespace team --format json docs/examples/chart`에서는 렌더 정보와 검사 리포트를 확인했다. [업그레이드 구현](https://github.com/uknowpro/kubewiser/blob/16dc9d6b8e83/internal/analyze/analyze.go) · [Helm 렌더러](https://github.com/uknowpro/kubewiser/blob/16dc9d6b8e83/internal/render/helm.go)

## 첫 연동 작업

1. 두 CLI의 JSON을 xdocs에서 먼저 읽고, 파일·줄 또는 리소스 경로를 눌러 근거를 열게 한다. 실제 엔진 버전·입력 범위·누락을 저장해 재분석 결과를 비교한다.
2. netspector의 scan JSON에는 findings·connections가 있고 화면용 nodes·edges는 별도 그래프 함수에서 만들어진다. 엔진의 그래프 JSON 출력 경로를 제공해 xdocs가 호스트 병합·미확정 판정을 중복 구현하지 않도록 한다.
3. kubewiser의 업그레이드 계획은 목표 버전 검사와 마이너별 조치를 제공한다. 기존 문제와 새 문제의 차이는 같은 입력·검사 옵션으로 두 버전의 scan 결과를 비교한다. Helm은 같은 values·release·namespace로 두 번 렌더링하고, 달라진 리소스나 검사 제외 항목도 보여준다.
4. 차트 네트워크 도식화에는 렌더된 리소스와 템플릿 출처 연결이 필요하다. kubewiser Helm 결과 JSON의 render·report와 netspector의 프로젝트 소스 근거를 연결하는 작은 공통 예제부터 검증한다. 이름이나 포트만 일치하는 Java 호출은 후보로 남긴다.

## 현재 사용법

사이드바의 **Analyzer 만들기** 또는 폴더의 **+ → Analyzer**에서 페이지를 만든다. 데스크톱의 **폴더 선택 및 분석**으로 Java 등 소스 프로젝트, 매니페스트 폴더 또는 Helm 차트 루트를 선택한다. 네트워크 화면은 netspector의 발견 상태·방향·파일·줄과 선언된 연결 경로를 표시한다. Helm 네트워크 분석의 위치는 렌더된 YAML 기준이다. 매니페스트 업그레이드는 kubewiser의 마이너별 계획을, Helm 업그레이드는 두 버전에 같은 릴리스·네임스페이스·values를 적용해 검사 결과 차이를 표시한다.

데스크톱 설치 패키지에는 netspector 0.3.0, kubewiser 0.2.0-alpha.8, Helm 3.19.2가 들어 있다. 프로젝트 폴더나 차트를 고르면 앱에 포함된 실행 파일을 사용한다. Python·CLI 설치, PATH 설정, 최초 실행 시 다운로드가 필요하지 않다. 브라우저 미리보기와 데스크톱 모두 기존 분석 JSON을 열 수 있다.

소스에서 실행하는 개발자는 처음 `npm start` 하거나 패키징할 때 공식 배포 파일을 내려받는다. 빌드는 플랫폼별 SHA-256을 검사하고 `.cache/analyzers`에 보관한다. 대상은 Linux x64, Windows x64, macOS arm64·x64이며 netspector의 macOS 실행 파일은 macOS 15 이상을 대상으로 한다. 라이선스는 앱 리소스의 `analyzer-tools/licenses`에 있다.

분석 결과를 보존하려면 **보고서를 하위 노트로 저장**한다. Builder의 **Analyzer 업그레이드 조치**, **Analyzer 인바운드·아웃바운드 검토**에서 이 노트를 입력으로 선택하면 해당 근거 줄을 다시 검토할 수 있다. 경로는 정적 분석 결과이며 실제 연결 성공 여부는 별도 측정 대상이다.
