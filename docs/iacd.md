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
- 원본 리소스의 배치·표시 이름은 편집할 수 있습니다. 카탈로그에 대응하는 일부 문자열 속성만 편집하며 변경값은 `zz_xdocs_override.tf.json`으로 추출합니다. 원본에 override 파일이 있으면 편집한 override 추출을 차단합니다. 원본 리소스 삭제와 임의 표현식·중첩 블록 재작성은 하지 않습니다.
- 변수·함수·provider·모듈을 평가하지 않습니다. count/for_each는 선언 하나로 표시하며 모듈 내부를 내려받거나 펼치지 않습니다. 선택하지 않은 로컬 모듈·파일·tfvars·state·자격증명은 읽지 않습니다. 모듈의 상대 경로는 추출 후 사용자가 원래 디렉터리 구조로 제공해야 합니다.
- 가져온 문서의 Terraform 추출은 선택과 관계없이 원본 전체를 보존합니다. 가져온 원본과 새 클라우드 리소스는 provider·변수 충돌 방지를 위해 별도 아키텍처 노트로 관리합니다. 가져온 Terraform을 CloudFormation으로 변환하지 않습니다.
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
