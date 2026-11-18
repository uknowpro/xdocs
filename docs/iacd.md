# IaCD — 시각적 아키텍처와 코드

현재 `main` 개발분에 구현된 기능입니다. 기존 v0.4.0-alpha.1 설치 릴리스에는 포함되지 않습니다.

사이드바 **IaCD 아키텍처**에서 빈 캔버스·멀티클라우드 예제·Terraform 가져오기를 선택합니다. 컴포넌트를 클릭하거나 끌어 배치하고, 속성에서 연결 대상을 고르거나 **대상 클릭으로 연결**을 사용합니다. 화살표는 **참조하는 컴포넌트 → 참조 대상** 방향입니다. 위치 이동·키보드 방향키·확대/축소·맞춤·그룹별 정렬·실행 취소/다시 실행을 지원합니다.

![IaCD 캔버스](images/iacd.png)

## 구현된 컴포넌트

| 범위                   | 지원 컴포넌트                                                      |
| ---------------------- | ------------------------------------------------------------------ |
| AWS                    | VPC, Subnet, EC2, S3                                               |
| Azure                  | Resource Group, Virtual Network, Subnet, Linux VM, Storage Account |
| GCP                    | VPC Network, Subnetwork, Compute Engine, Cloud Storage             |
| Kubernetes             | Namespace, Deployment, Service, Ingress, ConfigMap, PVC            |
| Azure Verified Modules | Resource Group, Virtual Network, Private Storage                   |

클라우드 전체 서비스 카탈로그가 아닙니다. 예를 들어 관리형 Kubernetes 클러스터, load balancer, IAM/RBAC 전체, 방화벽·라우팅·NAT·모니터링 전체는 자동 생성하지 않습니다. Kubernetes 컴포넌트는 별도 클러스터를 대상으로 하며 AWS/Azure/GCP VM과 연결한다고 클러스터가 생기지 않습니다. 선은 지원하는 형식의 실제 참조 필드에 대응하며 임의의 두 컴포넌트를 연결해 배포 의미를 만들어내지 않습니다.

## 추출

**코드 추출**에서 전체·Terraform·CloudFormation·manifest·Helm을 선택합니다. 선택 컴포넌트만 추출할 때는 참조하는 의존 대상도 포함합니다. 선택 형식과 맞지 않는 컴포넌트는 제외 안내를 표시합니다. 필수값·연결·숫자 범위·이름·일부 CIDR 검증 실패 시 추출을 막습니다. 공급자의 모든 런타임 제약을 검증하지는 않습니다.

| 파일                                                                      | 내용                                                                              |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `terraform/main.tf.json`                                                  | Terraform이 직접 읽는 공식 JSON 구성. 새 리소스와 provider·모듈 참조              |
| `terraform/terraform.tfvars.example`                                      | Azure 구독·GCP 프로젝트 ID 예제. 인증정보 없음                                    |
| `cloudformation/template.json`                                            | AWS VPC·Subnet·EC2·S3의 CloudFormation 구성, `Ref` 연결, S3 삭제·교체 시 Retain   |
| `manifests/*.yaml`                                                        | 컴포넌트별 Kubernetes 리소스                                                      |
| `chart/Chart.yaml`, `chart/values.yaml`, `chart/templates/resources.yaml` | Helm v2 application chart. `values.resources.<컴포넌트ID>`의 리소스 정의를 렌더링 |
| `architecture.json`, `architecture.svg`                                   | 편집 모델과 정적 다이어그램                                                       |
| `WELL_ARCHITECTED.md`, `README.md`                                        | 설계 검토 기록·생성 범위·사용 안내                                                |

Terraform과 CloudFormation은 **같은 AWS 리소스에 중복 적용하지 않습니다.** Kubernetes manifest와 Helm도 같은 리소스에 중복 적용하지 않습니다. Helm은 리소스 정의를 values로 제공하며 임의 입력을 `tpl`로 실행하지 않습니다. 네임스페이스 이름은 입력값 그대로 유지하므로 설치할 release·namespace·기존 리소스 소유권을 검토하세요.

Terraform은 AWS `~> 6.0`, AzureRM `~> 4.0`, Google `~> 7.0`, AVM 사용 시 AzAPI `~> 2.12`를 명시합니다. 새 클라우드 리소스는 Terraform 1.5 이상, AVM은 1.10 이상·2.0 미만을 요구합니다. 실제 프로젝트에서는 `terraform init` 후 생성된 lock 파일을 버전 관리하세요. 인프라 명령·인증·plan/apply·스택 생성은 xdocs가 실행하지 않습니다.

## Terraform → 다이어그램

같은 모듈 디렉터리의 `.tf`·`.tf.json` 여러 파일을 선택합니다. resource·data·module 선언을 노드로 만들고 표현식과 depends_on의 정적 참조를 연결합니다. 원본은 파일명·내용을 그대로 저장합니다. 알 수 없는 리소스도 일반 노드로 표시합니다.

- 사용자 확인 후 원본을 Markdown 노트의 버전 1 `xdocs-architecture` 블록에 보관합니다. 일반 노트처럼 SQLite 색인·이력·조직 동기화가 적용됩니다. **원본의 주석·변수 기본값·문자열에는 비밀정보가 있을 수 있습니다. 조직 보관함에서는 원본도 동기화됩니다.** 이전 인프라 요약 가져오기와 달리 원본을 제거하지 않습니다.
- 원본 리소스의 배치·표시 이름은 편집할 수 있습니다. 카탈로그에 대응하는 문자열 속성을 편집하면 변경값을 `zz_xdocs_override.tf.json`으로 추출합니다. 원본에 override 파일이 있으면 편집한 override 추출을 차단합니다. 원본 리소스 삭제와 임의 표현식·중첩 블록 재작성은 하지 않습니다.
- 변수·함수·provider·모듈을 평가하지 않습니다. count/for_each는 선언 하나로 표시하며 모듈 내부를 내려받거나 펼치지 않습니다. 선택하지 않은 로컬 모듈·파일·tfvars·state·자격증명은 읽지 않습니다. 모듈의 상대 경로는 추출 후 사용자가 원래 디렉터리 구조로 제공해야 합니다.
- 가져온 문서의 Terraform 추출은 선택과 관계없이 가져온 파일 전체를 포함합니다. 직접 소속 참조를 변경하면 보관된 사본에서 해당 주소만 바꾸며, 디스크의 입력 파일은 그대로 유지합니다. 가져온 원본과 새 클라우드 리소스는 provider·변수 충돌 방지를 위해 별도 아키텍처 노트로 관리합니다. 가져온 Terraform을 CloudFormation으로 변환하지 않습니다.
- 원본 파일은 총 2 MB·100개, 노드는 300개, 저장 모델은 4 MB, 구문 분석은 20초 제한입니다. 파일명은 영문·숫자·점·밑줄·하이픈을 지원합니다. 중복 선언·파일명 충돌을 거부합니다. 대규모 프로젝트는 모듈별로 나누어 가져오세요.

## Azure AVM과 Well-Architected

공식 Registry 및 해당 tag의 입력·출력을 확인해 고정했습니다(2026-11-18).

| 컴포넌트        | 공식 모듈                                                                                                                                  | 버전   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Resource Group  | [Azure/avm-res-resources-resourcegroup/azurerm](https://registry.terraform.io/modules/Azure/avm-res-resources-resourcegroup/azurerm/0.5.0) | 0.5.0  |
| Virtual Network | [Azure/avm-res-network-virtualnetwork/azurerm](https://registry.terraform.io/modules/Azure/avm-res-network-virtualnetwork/azurerm/0.23.0)  | 0.23.0 |
| Private Storage | [Azure/avm-res-storage-storageaccount/azurerm](https://registry.terraform.io/modules/Azure/avm-res-storage-storageaccount/azurerm/0.11.0)  | 0.11.0 |

AVM Private Storage는 공개망·공유키 사용을 끄고 TLS 1.2, 기본 ZRS, Blob Private Endpoint 및 `privatelink.blob.core.windows.net` DNS·VNet 연결을 생성합니다. VNet에는 Private Endpoint용 subnet을 포함합니다. 텔레메트리는 꺼진 구성으로 내보냅니다. AVM 최신 버전 자동 추적은 하지 않습니다. 리소스가 제공하는 확장 기능 전부를 UI에 노출하지 않으며, RBAC·로그·백업·다른 스토리지 서비스 endpoint는 별도 검토해야 합니다. ZRS 지원 지역·SKU·쿼터와 실제 Private DNS 연결성도 실제 환경에서 확인해야 합니다.

**AVM 사용 자체가 워크로드의 WAF 준수나 인증을 의미하지 않습니다.** WAF 검토 화면은 신뢰성·보안·비용 최적화·운영 우수성·성능 효율성별 근거·담당자·후속 작업을 기록하며 자동 합격 점수를 부여하지 않습니다. Azure Landing Zone 전체나 WAF 인증 자동화 기능으로 해석하지 않습니다.

## 검증과 참고

생성 코드는 테스트 구성에서 Terraform CLI의 구문·provider·AVM 스키마 검증, Helm lint·template, CloudFormation lint를 수행합니다. 클라우드 plan/apply, Kubernetes 서버 dry-run, Azure 지역·권한·실제 WAF 평가·운영 비용은 검증하지 않았습니다.

참고: [ArchFormation](https://archformation.com/), [Brainboard](https://www.brainboard.co/), [사용자 제공 Brainboard 소개](https://kschoi728.tistory.com/26), [Terraform JSON 문법](https://developer.hashicorp.com/terraform/language/syntax/json), [Terraform override](https://developer.hashicorp.com/terraform/language/files/override), [AVM 소개](https://azure.github.io/Azure-Verified-Modules/), [Microsoft WAF](https://learn.microsoft.com/azure/well-architected/), [Helm charts](https://helm.sh/docs/topics/charts/), [CloudFormation 구조](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-anatomy.html).

외부 도구의 코드나 디자인 자산을 복제하지 않았습니다. Terraform 파서는 [CDK Terrain hcl2json](https://github.com/open-constructs/cdk-terrain/tree/main/packages/%40cdktn/hcl2json)을 로컬 작업 스레드에서 사용합니다.


## AWS 계정·리전 드로잉

**IaCD 아키텍처 → AWS 백업 드로잉 예제**로 시작하거나 기존 아키텍처에서 **AWS 드로잉** 탭을 엽니다. 계정 영역마다 리전을 표시하며 같은 계정을 다른 리전에 다시 그릴 수 있습니다. 계정과 서비스를 끌어 위치를 바꾸고 속성에서 이름·리전·소속 계정을 편집합니다. 서비스 선택 후 연결 대상과 방향선을 추가하고 선을 선택해 라벨을 입력합니다. 계정을 삭제하면 소속 서비스와 관련 선도 함께 삭제되며 실행 취소로 복원할 수 있습니다.

예제의 체크·엑스는 편집 가능한 설명입니다. 실제 백업 가능 여부나 IAM·KMS 정책 검증 결과를 의미하지 않습니다. 서비스 심볼은 xdocs 자체 도형입니다. 드로잉은 SVG로 저장되며 코드 ZIP에도 포함됩니다. Terraform·CloudFormation 생성은 **설계** 탭의 배포 컴포넌트를 사용합니다.

노트의 **캔버스 미리보기 삽입**은 별도 줄에 `![[캔버스 ID]]`를 기록합니다. 문서를 복제하지 않으므로 원본의 다음 저장분이 미리보기에 반영됩니다. 일반 위키 링크 `[[캔버스 ID|표시 이름]]`도 지원합니다.

## 멀티클라우드 경계 도면

**설계 → 경계 도면**에서 같은 공급자 안의 소속 관계를 확인합니다. AWS VPC에는 서브넷이, 서브넷에는 EC2가 들어갑니다. S3 버킷은 VPC 외부에 표시됩니다. Azure는 리소스 그룹·VNet·서브넷, GCP는 네트워크·서브네트워크, Kubernetes는 네임스페이스를 경계로 사용합니다. 네임스페이스 내 Service와 Deployment는 같은 수준에 놓입니다.

작성한 컴포넌트를 호환되는 상위 경계의 제목으로 끌거나 속성의 참조 대상을 바꾸면 도면과 생성 코드가 함께 바뀝니다. **자유 배치·참조선**에서 저장된 좌표와 일반 의존 관계를 볼 수 있습니다. 코드 ZIP에는 경계 도면 `architecture.svg`와 참조선 도면 `references.svg`가 포함됩니다. 예제 EC2의 AMI ID를 비워두면 생성한 Terraform과 CloudFormation에서 배포 시 값을 받습니다.

Terraform 가져오기는 지원 속성의 직접 참조에서 소속을 판별합니다. 변수·조건식·단순 depends_on·해석할 수 없는 모듈 내부는 소속을 추정하지 않습니다. 이전 버전에서 가져온 문서에 소속 정보가 없으면 원본 Terraform을 새 캔버스로 가져와 확인할 수 있습니다.

**선택 리소스 참조선**을 켜면 현재 리소스가 참조하거나 현재 리소스를 참조하는 항목만 화살표와 목록으로 볼 수 있습니다. **코드 추출 → IaC 변경 비교**에서는 현재 선택한 형식·범위에 대해 추가·수정·삭제된 파일을 확인합니다. 기준은 페이지를 열었을 때의 설계이며 **현재 설계를 기준으로 지정**하면 이후 편집만 비교합니다. 페이지를 다시 열면 기준도 새로 시작합니다. 비교에는 Terraform 실행이나 클라우드 자격증명이 필요하지 않습니다.

경계 도면에서 리소스를 끌면 가능한 경계가 강조되고 포인터 아래의 대상 이름이 표시됩니다. 가져온 Terraform은 소속 속성이 같은 모듈의 리소스나 데이터 소스를 직접 가리킬 때 대상을 바꿀 수 있습니다. 예를 들어 EC2를 다른 서브넷으로 옮기면 추출한 파일의 `subnet_id`가 바뀌고 이를 다시 가져오면 새 서브넷 안에 표시됩니다. 변수·조건식으로 정한 소속은 원문을 유지합니다. 예전에 가져온 캔버스에서 원문 참조를 편집하려면 원본 파일을 새 캔버스로 다시 가져오세요.

경계를 선택해 접으면 내부 항목 수가 표시되고 외부 참조선은 접힌 경계까지 이어집니다. 흰색 연결점은 선의 꺾임을 옮기고, 파란색 연결점은 소속 참조의 대상을 바꿉니다. **배치 잠금**은 선택한 리소스의 이동과 소속 변경을 막습니다. 경계 접기, 꺾임점, 잠금, 운영 주석과 레이어 표시는 캔버스에 저장되며 생성하는 IaC에는 영향을 주지 않습니다.

참조 목록에서 각 선의 시작·끝 연결점을 위·아래·왼쪽·오른쪽으로 지정할 수 있습니다. **선 교차 표시**를 켜면 교차하는 선에 작은 반원을 그립니다.

## 리소스 찾기와 경계 안에서 추가

캔버스에 포커스를 둔 상태에서 `/`를 누르거나 **리소스 찾기**에 이름, 유형 또는 Terraform 주소를 입력합니다. 방향키로 결과를 선택하고 Enter로 속성을 엽니다. 접힌 상위 경계는 검색 중에 펼쳐지며, 검색만 해서는 저장된 도면이나 추출 코드가 바뀌지 않습니다. 좁은 창에서는 속성 패널이 도면 위에 열립니다. Esc 또는 **속성 닫기**를 누르면 도형으로 포커스가 돌아갑니다.

서브넷 같은 경계를 선택한 뒤 `+`를 누르면 그 안에 배치할 수 있는 유형을 검색합니다. EC2를 추가하면 해당 서브넷 참조까지 한 번에 설정됩니다. 속성의 소속 선택기로 기존 리소스를 옮길 수 있습니다. 가져온 Terraform은 편집 가능한 직접 참조에서만 소속을 바꿀 수 있습니다.

**AWS 구성요소 찾기**에서 계정 이름, 리전, 서비스 종류, 항목 이름을 함께 검색할 수 있습니다. 자동화·CloudFormation 캔버스에서는 **블록 찾기**에서 Job, Stage, Task 또는 논리 ID를 선택하면 해당 원문 범위로 이동합니다. 작성 중인 원문을 적용하거나 취소하면 다른 블록으로 이동할 수 있습니다.

[동일 Terraform 예제로 비교한 경계 배치·의존선·왕복 변환](terraform-graph-comparison.md)
