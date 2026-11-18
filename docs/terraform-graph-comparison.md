# Terraform의 의존선과 캔버스의 소속 비교

xdocs 0.5.1, Terraform CLI 1.13.5(AWS provider 6.73.0), Inframap v0.8.1에 같은 [루트 구성](../tests/fixtures/terraform-graph/main.tf)을 입력했다. AWS 관리 리소스 8개와 [로컬 모듈](../tests/fixtures/terraform-graph/module/main.tf) 호출 1개를 포함한다. Terraform은 로컬 모듈까지 초기화했고, xdocs에는 사용자가 가져오기에서 선택할 루트 main.tf를 입력했다. 계정 접속·배포 없이 구성만 분석했다.

| EC2의 서브넷 지정 방식 | xdocs 경계 도면·참조 | terraform graph | Inframap raw |
| --- | --- | --- | --- |
| 직접 참조 | app 서브넷 안, 서브넷 참조 | 서브넷으로 선 | 서브넷으로 선 |
| 외부 입력 변수 | 부모 미확인, 리소스 참조 없음 | EC2만 표시 | EC2만 표시 |
| 로컬 모듈 출력 | 부모 미확인, EC2 → 모듈 → 서브넷 | EC2 → 서브넷 | EC2만 표시 |
| for_each의 모든 인스턴스가 같은 서브넷을 직접 참조 | app 서브넷 안에 선언 1개 | 선언 1개와 서브넷으로 선 | 선언 1개와 서브넷으로 선 |
| depends_on에만 서브넷 지정 | 경계 밖, 서브넷 참조 | 서브넷으로 선 | 서브넷으로 선 |

xdocs에서는 노드 9개, 참조 7개, 부모·자식 관계 4개가 나왔다. Terraform 기본 그래프는 노드 8개·선 6개, Inframap raw 모드는 노드 8개·선 5개였다. 두 DOT 출력 모두 중첩 경계가 없었다. Inframap 기본 모드는 이 작은 예제에서 빈 그래프를 출력했다. 재현 시 raw 모드에는 고립 노드를 유지하는 옵션도 함께 지정한다. Inframap은 루트 모듈의 관리 리소스를 순회하고 모드에 따라 공급자별 필터를 적용한다. [Inframap HCL 그래프 구현](https://github.com/cycloidio/inframap/blob/f02f224cb0d0d8f369f001405fa646c206614b21/generate/hcl.go) · [Terraform graph 문서](https://developer.hashicorp.com/terraform/cli/commands/graph)

## 드로잉과 코드 편집

draw.io 소스에서 그룹 명령은 선택한 셀을 groupCells로 묶고, 연결선은 두 끝의 셀을 따로 읽는다. 도면 저장과 읽기는 그래프 모델 XML로 처리한다. xdocs에 적용할 때도 단순 의존선과 실제 소속 변경을 구별해야 한다. 예를 들어 위의 dependency_only를 선 하나 때문에 app 서브넷 안에 놓으면 Terraform에 없는 소속을 만들어 낸다. draw.io 검토 범위는 이 편집·직렬화 코드이며 Terraform 입력 실험은 표의 세 도구에서 수행했다. [그룹 명령](https://github.com/jgraph/drawio/blob/f411a11f4f6b8994d869bdbc45f4d4d9e2284f34/src/main/webapp/js/grapheditor/Actions.js#L673) · [연결선 끝점](https://github.com/jgraph/drawio/blob/f411a11f4f6b8994d869bdbc45f4d4d9e2284f34/src/main/webapp/js/grapheditor/Graph.js#L10407) · [도면 직렬화](https://github.com/jgraph/drawio/blob/f411a11f4f6b8994d869bdbc45f4d4d9e2284f34/src/main/webapp/js/grapheditor/Editor.js#L1922)

## 추출·재가져오기

xdocs에서 direct의 X 좌표를 변경하고 추출한 main.tf는 입력과 바이트 단위로 일치했다. 같은 EC2의 소속을 destination으로 바꾸면 해당 subnet_id의 주소만 바뀌었다. 재가져온 뒤 direct는 destination 안에, repeated는 app 안에 남았다. 로컬 모듈 디렉터리는 프로젝트에 별도로 보관한다. 비교한 외부 CLI 명령의 출력 형식은 DOT이며, Terraform 재추출은 xdocs에서 검증했다. [회귀 테스트](../tests/terraform-graph.test.mjs)

## 재현

xdocs 저장소 루트에서 실행한다. 외부 CLI는 위에 명시한 버전을 사용한다. Terraform 초기화가 생성하는 파일은 임시 복사본에 둔다.

```sh
node --test tests/terraform-graph.test.mjs
fixture=$(mktemp -d)
cp -R tests/fixtures/terraform-graph/. "$fixture/"
terraform -chdir="$fixture" init -backend=false
terraform -chdir="$fixture" graph
inframap generate "$fixture"
inframap generate --raw --clean=false "$fixture"
```

이번 결과는 AWS 구성 하나와 값을 그대로 돌려주는 로컬 모듈에 대한 것이다. 다음 검증 우선순위는 인덱스로 다른 서브넷을 고르는 for_each, 조건부 모듈 출력, Azure·GCP 네트워크다. 모듈 내부를 따라가서 의존 대상을 알아내더라도, 호출자가 준 식을 안전하게 수정할 수 있는지는 별도로 판정해야 한다.
