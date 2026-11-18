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
