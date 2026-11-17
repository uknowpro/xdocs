# 자동화·스택 캔버스

사이드바에서 **새 자동화·스택 캔버스**를 열고 형식을 선택합니다. 예제로 시작하거나 **원본 가져오기**로 파일을 엽니다. 카드를 선택하면 해당 블록의 코드를 편집할 수 있습니다. **수정 적용**을 누르면 노트에 반영됩니다. 카드 위치는 노트에 따로 저장하며 파일 내보내기는 원문을 사용합니다.

| 형식 | 표시하는 카드와 관계 |
| --- | --- |
| GitHub Actions | Job, Step, Job 간 `needs`, Step이 속한 Job |
| Ansible | Play 및 pre_tasks·roles·tasks·post_tasks·handlers 항목 |
| Jenkins Declarative | 리터럴 이름의 Stage와 중첩 Stage |
| CloudFormation YAML·JSON | Resources 및 정적 Ref·GetAtt·DependsOn 참조 |

UTF-8 파일은 500 KB, 카드는 300개까지 지원합니다. 조건·표현식·스크립트·중첩 스택 선언 등은 **전체 원문**에서 편집합니다. 외부 파일이나 동적 실행 결과는 펼치지 않습니다. 가져온 파일 내용은 노트와 함께 저장되며 조직 보관함에서는 동기화됩니다.

데스크톱 앱은 저장 대화상자에서 `Jenkinsfile`을 제안합니다. 브라우저 미리보기가 이름에 `.txt`를 붙이면 저장한 파일명을 `Jenkinsfile`로 변경하세요.

## 최초 설계 검토 기록

## 판단

가능합니다. 다만 모든 도구를 같은 노드·선 의미로 정형화하면 실행 의미를 잃게 됩니다. **공통 편집기 + 도구별 문서 모델·파서·생성기 + 보존할 원문 영역** 구성을 권장합니다. 공통화는 배치·선택·속성 패널·실행 취소·코드 비교·검증 결과·노트 연결에 한정합니다. 배포·실행 엔진은 별도 제품 범위입니다.

우선순위는 GitHub Actions, Ansible의 제한된 playbook, Jenkins Declarative 순입니다. 범용 Groovy·Jinja·shell의 실행 결과를 완전한 정적 다이어그램으로 변환하는 것은 범위 밖으로 두는 것이 적절합니다.

| 대상                  | 적합한 표현                                                           | 1차 편집 지원                                                                | 원문 보존 영역                                                                           | 난도·추천                      |
| --------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------ |
| GitHub Actions        | Workflow 안의 Job 의존 그래프 + Job 내부 Step 목록                    | 이벤트, jobs, needs, runs-on, uses/run, inputs, permissions, environment, if | 표현식, shell 본문, 미지원 키, 재사용 workflow, matrix 확장 규칙                         | 중간·우선 구현                 |
| Ansible               | Play 순서 → Role/Task 목록, Block/Rescue/Always 계층, Handler 연결    | hosts, 기본 module task, vars 참조, when, tags, notify, 정적 import          | Jinja, 동적 include, 임의 collection/plugin, Vault 암호문                                | 중상·제한된 범위부터           |
| Jenkins               | Declarative Pipeline → Stage/Parallel/Matrix → Steps 계층             | agent, stages, 기본 steps, environment, when, post, parameters               | script 블록, Shared Library 호출, plugin DSL, Scripted Pipeline 전체                     | 높음·마지막 단계               |
| CloudFormation 역변환 | Stack → Resource 참조 그래프, Conditions·Parameters·Outputs 별도 패널 | 기본 리소스·Ref·GetAtt와 스키마 속성                                         | Fn::If/Sub/FindInMap, dynamic reference, Transform/macros, nested stacks, SAM/CDK 생성물 | 중상·AWS 정방향 추출 다음 단계 |



## 각 도구에서 선이 의미하는 것

GitHub Actions의 `needs`는 Job 실행 의존성이고 Step은 보통 목록 순서로 실행합니다. `if`·실패·취소·matrix·동시성 규칙은 단순 선만으로 설명할 수 없습니다. matrix는 선언 노드로 보관하고 입력이 확정된 경우에만 펼쳐보기로 보여줘야 합니다. 재사용 workflow는 내부를 임의로 복제하지 않고 호출 노드로 표시합니다. YAML 1.2/CST 기반으로 `on`과 주석·원문을 보존해야 합니다. [공식 문법](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

Ansible의 Play·Task 순서, hosts, strategy, serial, 조건, handler 실행 시점은 모두 의미를 갖습니다. 일반 DAG처럼 Task를 연결했다고 병렬 실행으로 변환하면 안 됩니다. 정적 `import_*`와 동적 `include_*`를 구별하고 동적 include는 내부 미확정으로 표시합니다. Inventory·Vault·외부 roles를 자동 실행하거나 해석하지 않습니다. [Playbook 구조](https://docs.ansible.com/projects/ansible/latest/playbook_guide/playbooks_intro.html), [정적·동적 재사용](https://docs.ansible.com/projects/ansible/latest/playbook_guide/playbooks_reuse.html)

Jenkins는 Declarative와 Scripted 문법이 나뉩니다. Declarative도 `script`와 Shared Library·플러그인에 의해 임의 Groovy 동작을 포함할 수 있습니다. 완전 역변환을 약속하지 않고 정형 블록만 편집하며 나머지는 잠긴 원문 블록으로 둬야 합니다. Groovy를 실행해서 구조를 알아내는 방식은 사용하지 않습니다. [공식 Pipeline 문법](https://www.jenkins.io/doc/book/pipeline/syntax/)

## 공통 구조 제안

문서 외피에는 `schemaVersion`, `kind`(iacd/actions/jenkins/ansible), 화면 좌표·그룹·선택 상태, 원본 파일 목록, 노트 링크와 검토 기록을 둡니다. 도구별 모델은 별도 버전을 사용합니다. IaCD의 리소스 참조 모델을 작업 실행 모델로 재사용하지 않습니다.

어댑터는 입력 판별 → 정적 분석 → 편집 지원 범위 판정 → 수정 반영 → 코드 생성 → 진단을 담당합니다. 노드마다 **속성 편집 가능 / 원문만 보존 / 외부 참조·해석 불가** 상태를 보여줍니다. 선도 resource-reference, job-needs, task-order, handler-notify처럼 종류가 달라야 합니다. 원문 블록은 편집기에서 이동하더라도 실행 의미가 바뀌는 구조 재배치를 허용하지 않습니다.

현재 IaCD의 JSON fence 저장·ZIP 추출·캔버스 조작은 재사용할 수 있지만, 정형 모델과 JSX 화면은 아직 범용 플러그인 호스트가 아닙니다. 첫 Actions 확장을 시작할 때 캔버스 셸과 도메인 모델을 분리하는 리팩터링이 필요합니다.

## 현실적인 도입 순서와 완료 기준

1. **읽기 전용 가져오기**: 원문을 보존하고 지원/미지원 범위를 표시. 수정 없이 내보냈을 때 파일 바이트가 동일해야 합니다.
2. **제한된 작성·편집**: Actions Job/Step, Ansible 기본 Play/Task, Jenkins Declarative Stage부터. 지원하지 않는 영역의 내용·순서·표현식이 달라지면 내보내기를 막거나 명시적으로 원문을 유지합니다.
3. **차이 비교와 검증**: 캔버스 수정 전후 코드 diff, 도구별 정적 검증 결과를 연결. 시각적 좌표 변경은 생성 코드에 영향을 주지 않아야 합니다.
4. **외부 시스템 연결은 별도 결정**: GitHub workflow 발송, Jenkins job 실행, Ansible 대상 호스트 접속은 가져오기·생성과 분리한 명시적 실행 작업으로 둡니다.

검증 후보는 Actions용 actionlint, Ansible syntax-check/ansible-lint, Jenkins Declarative linter입니다. Jenkins 검증에는 Jenkins·플러그인 버전이 맞는 별도 환경이 필요합니다. Ansible의 플러그인·lookup은 외부 동작을 할 수 있으므로 사용자 문서를 일반 앱 프로세스에서 실행하지 않고 격리된 검증 환경을 사용해야 합니다. 도구·서버 검증이 실제 workflow·playbook·pipeline 성공을 보장하지는 않습니다.

릴리스 기준에는 unknown key·주석·멀티라인 명령·표현식·동적 include 보존, 원문 왕복 동일성, 주기·순서 오류, secret 참조 미해석, 버전별 테스트 fixture를 포함합니다. 실행 결과·실시간 진행 표시·자격증명 관리·비용 산정·모든 플러그인 지원은 초기 범위에서 제외합니다.

## xdocs에서의 제품 방향

노트 안에 아키텍처·자동화 문서를 연결하고, 운영 절차·ADR·WAF 기록과 함께 검토할 수 있는 편집기를 권장합니다. 사용자가 올린 임의 코드를 전부 블록으로 바꾸는 약속보다는, 잘 알려진 패턴을 쉽게 만들고 복잡한 부분은 원문 그대로 다루는 접근이 유지보수와 의미 보존 측면에서 적합합니다.
