import { test, expect } from "@playwright/test";
test("Builder uses the selected sheet and saves a linked evidence note", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page
    .getByRole("button", { name: "새 시트 테이블", exact: true })
    .click();
  await page.getByLabel("시트 1 A1", { exact: true }).fill("예산");
  await page.getByLabel("시트 1 A2", { exact: true }).fill("1200");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "Harness 만들기" }).click();
  await page
    .getByLabel("시트 페이지", { exact: true })
    .selectOption({ label: "새 시트" });
  await page.getByLabel("초과 기준").fill("1000");
  await expect(page.locator(".builder-panel pre").first()).toContainText(
    "시트 1!A2",
  );
  await page.setViewportSize({ width: 1440, height: 1600 });
  await page
    .locator(".builder-panel")
    .screenshot({ path: "test-results/builder.png" });
  await page.getByRole("button", { name: "결과를 하위 노트로 저장" }).click();
  await expect(page.locator(".markdown")).toContainText("1200");
  await page.reload();
  await page.getByRole("button", { name: "새 Builder", exact: true }).click();
  await expect(page.getByLabel("초과 기준")).toHaveValue("1000");
});
test("catalog creates an Azure AVM canvas and exposes the selected module", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
    .click();
  await page.getByLabel("공급자", { exact: true }).selectOption("Azure");
  await page.getByRole("button", { name: "컴포넌트 편집", exact: true }).click();
  await expect(page.getByRole("group", {name:"설계 템플릿"}).locator(".template-card")).toHaveCount(1);
  await page.getByLabel("템플릿 검색").fill("no-matching-template");
  await expect(page.getByRole("button", { name: "템플릿으로 시작" })).toBeDisabled();
  await page.getByRole("button", { name: "검색 조건 초기화" }).click();
  await expect(page.getByRole("group", {name:"설계 템플릿"}).locator(".template-card")).toHaveCount(19);
  await page.getByRole("button",{name:"AVM · 사업부별 사설 데이터 구역",exact:true}).click();
  await page.getByRole("button", { name: "템플릿으로 시작" }).click();
  await page.getByRole("button", { name: "Terraform 선언 보기" }).click();
  await expect(page.getByLabel("선택한 Terraform 선언")).toBeFocused();
  await page.getByRole("button", { name: "캔버스에서 보기" }).click();
  await expect(page.getByLabel("컴포넌트 표시 이름")).toBeFocused();
  await expect(page.getByLabel("선택한 Terraform 선언")).toContainText(
    "Azure/avm",
  );
  const list = page.getByLabel("Terraform 선언", { exact: true });
  await list.selectOption({ index: 2 });
  await expect(page.getByLabel("선택한 Terraform 선언")).toContainText(
    "virtualnetwork",
  );
});
test("packaged multi-cloud VPN case opens without network access", async ({ page }) => {
  await page.goto("/");
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page
    .getByRole("button", { name: "IaCD 아키텍처", exact: true })
    .click();
  await page.getByLabel("공급자",{exact:true}).selectOption("멀티클라우드");
  await expect.poll(() => page.locator(".template-thumbnail img").evaluateAll(
    images => images.filter(i => (i as HTMLImageElement).naturalWidth > 0).length
  )).toBe(2);
  await page.setViewportSize({width:1440,height:1100});
  await page
    .getByRole("dialog")
    .screenshot({ path: "test-results/architecture-catalog.png" });
  await page.getByRole("button",{name:"Azure ↔ GCP · 이중 VPN 게이트웨이",exact:true}).click();
  await page.getByRole("button", { name: "템플릿으로 시작" }).click();
  await expect(page.getByLabel("아키텍처 제목")).toHaveValue(
    "멀티클라우드 · Azure ↔ GCP · 이중 VPN 게이트웨이",
  );
  await page.getByLabel("Terraform 파일").selectOption("terraform/azure.tf");
  await expect(page.getByLabel("Terraform 코드")).toContainText(
    "azurerm_virtual_network_gateway_connection",
  );
});
test("a named harness copy keeps its rules and clears the original note input", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "Harness 만들기" }).click();
  await page.getByLabel("하네스 템플릿").selectOption("meeting");
  await page
    .getByLabel("입력 노트", { exact: true })
    .selectOption({ label: "생각이 연결되는 공간" });
  await expect(page.locator(".builder-panel pre").first()).toContainText("L");
  await page.getByText("하네스 공유와 복제", { exact: true }).click();
  await page.getByLabel("사본 이름").fill("운영팀 회의 v1");
  await page.getByRole("button", { name: "워크스페이스에 사본 저장" }).click();
  await expect(page.getByLabel("입력 노트", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("찾을 문구")).toHaveValue("- [ ]");
  await page.getByText("하네스 공유와 복제", { exact: true }).click();
  await expect(page.getByText(/원본 페이지 .* · 버전/)).toBeVisible();
});
test("workspace harness library applies a versioned snapshot", async ({
  page,
}) => {
  await page.goto("/");
  const create = page.getByRole("button", { name: "Harness 만들기" });
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await create.click();
  await page
    .getByLabel("프롬프트", { exact: true })
    .fill("회계팀 검토 기준 v1");
  await page.getByText("하네스 공유와 복제", { exact: true }).click();
  await page.getByLabel("사본 이름").fill("회계팀 검토");
  await page
    .getByRole("button", { name: "워크스페이스 템플릿으로 게시" })
    .click();
  await expect(
    page.getByLabel("워크스페이스 템플릿", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await create.click();
  await page
    .getByLabel("워크스페이스 템플릿", { exact: true })
    .selectOption({ label: "회계팀 검토" });
  await expect(page.getByLabel("프롬프트", { exact: true })).toHaveValue(
    "회계팀 검토 기준 v1",
  );
});

test("retired AWS templates are absent from gallery search", async ({ page }) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", {name:"IaCD 아키텍처", exact:true}).click();
  const search = page.getByLabel("템플릿 검색");
  await search.fill("결제 서비스 · 격리 복구 리허설");
  await expect(page.getByRole("button", {name:"템플릿으로 시작"})).toBeDisabled();
  await search.fill("aws-ecs-efs-integration-bash-terraform");
  await expect(page.locator(".template-card")).toHaveCount(0);
  await search.fill("Fargate 서비스 검색");
  await expect(page.getByRole("button", {name:"템플릿으로 시작"})).toBeDisabled();
  await expect(page.locator(".template-card")).toHaveCount(0);
});

test("Analyzer findings become a saved Builder source with both network directions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button",{name:"Analyzer 만들기"}).click();
  await page.getByLabel("기존 분석 JSON 열기").setInputFiles({name:"scan.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({
    project:{},connections:[],findings:["inbound","outbound"].map(direction=>({direction,kind:"route",target:"/orders",file:"Orders.java",line:9,status:"candidate"}))
  }))});
  await expect(page.locator(".analyzer-path")).toHaveCount(2);
  await page.getByRole("button",{name:"보고서를 하위 노트로 저장"}).click();
  await expect(page.locator(".markdown")).toContainText("Orders.java:9");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button",{name:"Harness 만들기"}).click();
  await page.getByLabel("하네스 템플릿").selectOption("network");
  await page.getByLabel("입력 노트",{exact:true}).selectOption({label:"네트워크 분석"});
  await expect(page.locator(".builder-panel pre").first()).toContainText("outbound");
  await expect(page.locator(".builder-panel pre").first()).toContainText("inbound");
});

test("Builder copies a customized step from another page independently", async ({page})=>{
  await page.goto("/");
  const create=page.getByRole("button",{name:"Harness 만들기"});
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await create.click();
  await page.getByLabel("단계 이름").fill("운영 예산");
  await page.getByLabel("초과 기준").fill("2300");
  await page.getByText("하네스 공유와 복제",{exact:true}).click();
  await page.getByLabel("사본 이름").fill("원본 하네스");
  await page.getByRole("button",{name:"워크스페이스에 사본 저장"}).click();
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await create.click();
  await page.getByText("다른 Builder에서 단계 가져오기",{exact:true}).click();
  await page.getByLabel("원본 Builder").selectOption({label:"원본 하네스"});
  await page.getByLabel("추가할 단계").selectOption("0");
  await expect(page.getByLabel("초과 기준").nth(1)).toHaveValue("2300");
  await page.getByRole("button",{name:"아래로",exact:true}).first().click();
  await expect(page.getByLabel("단계 이름").first()).toHaveValue("운영 예산");
});

test("Seoul case opens both AZs and selects the NAT declaration", async ({page}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", {name:"IaCD 아키텍처",exact:true}).click();
  await page.getByRole("button", {name:"사례 설계",exact:true}).click();
  await page.getByRole("button", {name:"서울 리전 · 이중 AZ 프라이빗 이그레스",exact:true}).click();
  await page.getByRole("button", {name:"템플릿으로 시작"}).click();
  const diagram=page.locator(".case-blueprint");
  await expect(diagram).toContainText("ap-northeast-2a");
  await expect(diagram).toContainText("ap-northeast-2c");
  await diagram.getByRole("button",{name:"NAT Gateway",exact:true}).last().click();
  await expect(page.getByLabel("컴포넌트 표시 이름")).toHaveValue(/egress_c/);
  await page.getByRole("button",{name:"확대 보기",exact:true}).click();
  const svg = await diagram.locator("svg").evaluate(el => el.outerHTML);
  const capture = await page.context().newPage();
  await capture.setViewportSize({width:1168,height:600});
  await capture.setContent('<style>body{margin:0}svg{display:block;width:100%}</style>'+svg);
  await capture.locator("svg").screenshot({path:"test-results/seoul-case.png"});
  await capture.close();
});

for(const [provider,title,address] of [
  ["AWS","EFS 백업 · 계정 간 복사와 복원 검증","aws_backup_vault.archive"],
  ["GCP","배치 병행 이전 · 금액 대조와 결과 선택","google_bigquery_data_transfer_config.compare"],
  ["AWS","멀티계정 랜딩존 · 조직 감사 로그 분리","aws_cloudtrail.organization"],
  ["Azure","리전 장애 전환 · 한국과 일본의 이중 웹 서비스","azurerm_linux_web_app.recovery"],
  ["멀티클라우드","하이브리드 지점망 · 이중 라우터와 AWS·GCP","google_compute_router_peer.west"],
]) test(title+" opens offline with selectable Terraform declarations",async({page})=>{
  await page.setViewportSize({width:1600,height:1000});
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/,route=>route.abort());
  await page.goto("/");
  const btn=(name:string)=>page.getByRole("button",{name,exact:true});
  await btn("새로 만들기").click();await btn("IaCD 아키텍처").click();
  await page.getByLabel("공급자",{exact:true}).selectOption(provider);
  await btn("사례 설계").click();await btn(title).click();await btn("템플릿으로 시작").click();
  const diagram=page.locator(".case-blueprint");
  const resource=diagram.locator("[data-resource]").filter({has:page.locator("title",{hasText:address})});
  await resource.click();await expect(page.getByLabel("컴포넌트 표시 이름")).toHaveValue(address);
  await expect(page.getByLabel("Terraform 코드")).toContainText(address.split(".")[0]);
  if(provider==="멀티클라우드")await diagram.screenshot({path:"test-results/branch-routing.png"});
});

test("Azure egress path opens the source declaration for every hop",async({page})=>{
  await page.goto("/");
  const button=(name:string)=>page.getByRole("button",{name,exact:true});
  await button("새로 만들기").click();
  await button("IaCD 아키텍처").click();
  await page.getByLabel("공급자",{exact:true}).selectOption("Azure");
  await button("허브·스포크 NAT와 방화벽").click();
  await button("템플릿으로 시작").click();
  const steps=page.getByRole("navigation",{name:"스포크 송신 경로"}).getByRole("button");
  for(const [i,field] of ["subnet-private","route_table_id","next_hop_in_ip_address","firewall_policy_id","afwp-","destination_ports"].entries()){
    await steps.nth(i).click();
    await expect(page.getByLabel("선택한 Terraform 선언")).toContainText(field);
  }
});

test("every catalog preview loads offline, exposes its reviewed path and fits the card",async({page})=>{
  test.setTimeout(90000);
  await page.goto("/");
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/,route=>route.abort());
  const btn=(name:string)=>page.getByRole("button",{name,exact:true});
  await btn("새로 만들기").click();
  await btn("IaCD 아키텍처").click();
  for(const [provider,count] of [["AWS",4],["Azure",19],["GCP",10],["멀티클라우드",2]] as const){
    await page.getByLabel("공급자",{exact:true}).selectOption(provider);
    const cards=page.getByRole("group",{name:"설계 템플릿"}).locator(".template-card");
    await expect(cards).toHaveCount(count);
    for(const card of await cards.all()){
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator(".thumbnail-reference")).toContainText(" → ");
      await expect.poll(()=>card.locator("img").evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
      expect(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    }
  }
  await btn("구성도 확대 미리보기").click();await btn("원본 크기 보기").click();
  await expect(page.getByRole("button",{name:"배율 보기"})).toHaveAttribute("aria-pressed","true");
});

test("follow the Azure firewall route from a card into its Terraform property", async ({page}) => {
  await page.setViewportSize({width:1500,height:950});
  await page.goto("/");
  const button = (name:string) => page.getByRole("button",{name,exact:true});
  await button("새로 만들기").click();
  await button("IaCD 아키텍처").click();
  await page.getByLabel("공급자",{exact:true}).selectOption("Azure");
  await page.getByLabel("템플릿 검색").fill("301-nat-gateway");
  await page.getByText("필수 입력과 준비 사항",{exact:true}).click();
  await expect(page.getByText(/기본값 없는 루트 변수/)).toContainText("admin_ssh_key");
  await page.locator(".thumbnail-reference").click();
  await expect(page.locator(".focused-reference")).toContainText("azurerm_firewall.main");
  const edge = page.locator(".network-layout [data-reference]").first();
  await expect(edge).toBeVisible();
  await edge.scrollIntoViewIfNeeded();
  const point = await edge.evaluate(element => {
    const path = element as unknown as SVGPathElement;
    for (let i=1;i<100;i++) {
      const p = path.getPointAtLength(path.getTotalLength()*i/100).matrixTransform(path.getScreenCTM()!);
      if (document.elementFromPoint(p.x,p.y) === path) return {x:p.x,y:p.y};
    }
    throw Error("The visible connection has no clickable point");
  });
  await page.mouse.click(point.x,point.y);
  const mark = page.getByLabel("Terraform 코드").locator("mark");
  await expect(mark).toContainText("next_hop_in_ip_address");
  await page.getByLabel("Terraform 코드").evaluate(el => {
    const line = el.querySelector("mark")!;
    el.scrollTop += line.getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientHeight / 2;
  });
  await page.screenshot({path:"test-results/terraform-reference.png"});
  await button("전체 도면 보기").click();
  await expect(mark).toHaveCount(0);
});

test("an Azure connection offers both source locations before jumping", async ({page}) => {
  await page.goto("/");
  const button = (name:string) => page.getByRole("button",{name,exact:true});
  await button("새로 만들기").click();
  await button("IaCD 아키텍처").click();
  await page.getByLabel("공급자",{exact:true}).selectOption("Azure");
  await page.getByLabel("템플릿 검색").fill("azure-quickstart-101-front-door-premium-storage-blobs-private-link");
  await page.locator(".thumbnail-reference").click();
  await button("Terraform 속성 보기").click();
  await expect(button("host_name · front-door.tf:48")).toBeVisible();
  await button("origin_host_header · front-door.tf:51").click();
  await expect(page.locator(".reference-location")).toHaveText("front-door.tf:51 · origin_host_header");
  await expect(page.getByLabel("Terraform 코드").locator("mark")).toContainText("origin_host_header");
});

for (const [provider, title, label, address, field] of [
  ["Azure", "보안 가상 허브와 중앙 방화벽", "Azure Firewall", "azurerm_firewall.fw", "firewall_policy_id"],
  ["GCP", "교차 리전 내부 애플리케이션 서비스", "Backend service", "google_compute_backend_service.default", "mig_b"],
  ["GCP", "분리 VPC 간 HA VPN", "IF 0 · Tunnel 1", "google_compute_vpn_tunnel.tunnel1", "peer_gcp_gateway"],
  ["Azure", "가상 데스크톱과 NetApp 사용자 프로필", "Profile volume · 100 GiB", "azurerm_netapp_volume.NetApp_Vol", "protocols"],
  ["Azure", "격리형 Synapse 분석 워크스페이스", "Synapse Dev PE", "azurerm_private_endpoint.pe_dev", "private_connection_resource_id"],
  ["GCP", "공유 VPC·교차 프로젝트 HTTPS 백엔드", "URL map", "google_compute_region_url_map.default", "default_service"],
  ["GCP", "네트워크 트래픽 미러링과 수집", "Mirroring policy · BOTH", "google_compute_packet_mirroring.default", "collector_ilb"],
  ["GCP", "Interconnect 위의 HA VPN", "Tunnel 4", "google_compute_vpn_tunnel.tunnel_4", "peer_external_gateway_interface"],
  ["Azure", "격리형 ML 허브·스포크 플랫폼", "Workspace PE", "azurerm_private_endpoint.mlw_ple", "private_connection_resource_id"],
  ["Azure", "허브·스포크 네트워크 분리", "Management NIC", "azurerm_network_interface.spoke1-nic", "subnet_id"],
]) test(title + " shows the source-backed topology in the gallery and editor", async ({page}) => {
  await page.setViewportSize({width:1600,height:1000});
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, route => route.abort());
  await page.goto("/");
  const button = (name:string) => page.getByRole("button", {name, exact:true});
  await button("새로 만들기").click();
  await button("IaCD 아키텍처").click();
  await page.getByLabel("공급자",{exact:true}).selectOption(provider);
  await button(title).click();
  const preview = page.locator(".template-card").filter({has:button(title)}).locator("img");
  await expect.poll(() => preview.evaluate((img:HTMLImageElement) => img.naturalWidth / img.naturalHeight)).toBeGreaterThan(2);
  const fits = await preview.evaluate(async (img:HTMLImageElement) => {
    const width = img.clientWidth;
    const svg = new DOMParser().parseFromString(decodeURIComponent(img.src.slice(img.src.indexOf(",")+1)), "image/svg+xml").documentElement;
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:"+width+"px";
    document.body.append(host);
    host.append(document.importNode(svg,true));
    try {
      const rendered = host.querySelector("svg")!;
      return width > 0 && rendered.getBoundingClientRect().height <= width &&
        Array.from(rendered.querySelectorAll("g[data-resource]")).every(g=>{
          const label = g.querySelector("text")!.getBoundingClientRect();
          const box = g.querySelector("rect")!.getBoundingClientRect();
          return label.right <= box.right + 1 && label.left >= box.left - 1;
        });
    } finally { host.remove(); }
  });
  expect(fits).toBe(true);
  await button("템플릿으로 시작").click();
  const diagram = page.locator(".case-blueprint");
  await diagram.getByRole("button", {name:label, exact:true}).first().click();
  const code = page.getByLabel("선택한 Terraform 선언");
  await expect(code).toBeVisible();
  const [kind, name] = address.split(".");
  await expect(code).toContainText('resource "'+kind+'" "'+name+'"');
  await expect(code).toContainText(field);
});
