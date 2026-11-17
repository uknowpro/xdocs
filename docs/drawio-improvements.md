# draw.io를 참고한 캔버스 개선 후보

draw.io 공식 사용자 문서와 xdocs 경계 도면을 비교했다. 아래 항목은 후속 제안이다.

| 순서 | xdocs에서 해결할 문제 | 제안과 완료 기준 | 참고 |
| --- | --- | --- | --- |
| 1 | EC2를 옮길 때 드롭하기 전에는 대상 서브넷이 분명하지 않다. | 이동할 수 있는 경계를 강조하고 대상 이름을 표시한다. 드롭 전에 새 소속을 알 수 있고, 취소하면 기존 참조를 유지한다. | [컨테이너 드롭 표시](https://www.drawio.com/docs/manual/shapes/container-shapes/) |
| 2 | 서브넷과 워크로드가 많으면 계정 전체 구조를 보기 어렵다. | VPC·서브넷·네임스페이스 단위로 접고 내부 항목 수를 표시한다. 접힌 영역으로 향하는 참조선은 경계에서 끝나도록 한다. | [컨테이너 접기·펼치기](https://www.drawio.com/docs/manual/shapes/container-shapes/) |
| 3 | 선택한 리소스에 참조가 몰리면 선이 제목이나 다른 선과 겹친다. | 도형 가장자리에서 연결점을 고르고 선의 꺾임점과 교차 표시를 조절한다. 경로 편집 후 IaC 변경 비교는 비어 있어야 한다. | [연결점·꺾임점·교차 표시](https://www2.drawio.com/doc/faq/connectors) |
| 4 | 설계 설명과 실제 리소스 참조를 한꺼번에 보면 의미가 섞인다. | 리소스·코드 참조·운영 주석의 표시를 전환한다. 보기를 바꿔도 생성 코드가 동일한지 검사한다. | [레이어 표시](https://www.drawio.com/docs/manual/layers/hide-display-layers/) |
| 5 | 리뷰 중 배경이나 확정된 경계를 실수로 옮길 수 있다. | 배치 잠금을 제공하고 잠금 상태를 선택 시 표시한다. 읽기 권한과 배치 잠금은 각각 적용한다. | [도형·레이어 잠금](https://www.drawio.com/docs/manual/editor/lock-elements/) |
