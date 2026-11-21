import {test,expect} from "@playwright/test";

test("selected sheet range creates a note without neighbouring cells",async({page})=>{
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button",{name:"새 시트 테이블",exact:true}).click();
  const cell=(address:string)=>page.getByLabel("시트 1 "+address,{exact:true});
  await cell("A1").fill("공유 항목");await cell("A2").fill("선택 값");await cell("B1").fill("제외 값");
  await cell("A1").click();await cell("A2").click({modifiers:["Shift"]});
  await page.getByRole("button",{name:"선택 범위를 노트로 복제"}).click();
  await expect(page.locator(".markdown")).toContainText("선택 값");await expect(page.locator(".markdown")).not.toContainText("제외 값");
});

test("consecutive Analyzer imports expose added and removed evidence",async({page})=>{
  await page.goto("/");
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button",{name:"Analyzer 만들기"}).click();
  for(const target of ["/old","/new"]){
    await page.getByLabel("기존 분석 JSON 열기").setInputFiles({name:"scan.json",mimeType:"application/json",
      buffer:Buffer.from(JSON.stringify({project:{},connections:[],findings:[{direction:"inbound",kind:"route",target,file:"Orders.java",line:5,status:"candidate"}]}))});
    await expect(page.locator(".analyzer-path").first()).toContainText(target);
  }
  await page.getByText("직전 분석과 변경 비교").click();
  const diff=page.locator("details").filter({has:page.getByText("직전 분석과 변경 비교",{exact:true})});
  await expect(diff).toContainText("/old");await expect(diff).toContainText("/new");
});

test("folder quick actions, block editing, trash confirmation and session switching",async ({page})=>{
  await page.goto("/");
  const btn=(name:string)=>page.getByRole("button",{name,exact:true});
  await btn("개인 보관함 새 폴더").click();
  await page.getByLabel("폴더 이름",{exact:true}).fill("업무");
  await btn("만들기").click();
  await btn("업무 새 노트").click();
  await expect(page.getByRole("textbox",{name:"블록 편집기"})).toBeVisible();
  const menu=()=>page.locator(".page-row.current").getByRole("button",{name:/페이지 메뉴$/});
  await menu().click();await btn("이름 변경").click();
  await page.getByLabel("페이지 이름 변경").fill("결산");
  await btn("저장").click();
  await btn("업무 페이지 메뉴").click();
  page.once("dialog",d=>d.dismiss());
  await btn("휴지통으로 이동").click();
  await expect(page.locator(".page-tree").getByRole("button",{name:"결산",exact:true})).toBeVisible();
  await btn("업무 페이지 메뉴").click();
  page.once("dialog",d=>d.accept());await btn("휴지통으로 이동").click();
  await btn("휴지통").click();
  page.once("dialog",d=>d.accept());await btn("결산 영구삭제").click();
  await expect(btn("결산 영구삭제")).toHaveCount(0);
  page.once("dialog",d=>d.accept());await btn("휴지통 비우기").click();
  await expect(btn("휴지통 비우기")).toBeDisabled();await btn("복원 창 닫기").click();
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await btn("xcode 세션 만들기").click();
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await btn("xcode 세션 만들기").click();
  await btn("왼쪽 메뉴 접기").click();
  const tabs=page.getByRole("navigation",{name:"xcode 세션 전환"});
  await tabs.getByRole("button",{name:"새 xcode 세션",exact:true}).click();
  await expect(tabs.getByRole("button",{name:"새 xcode 세션",exact:true})).toHaveAttribute("aria-current","page");
});

test("catalog confirmation stays visible while its content scrolls",async({page})=>{
  await page.setViewportSize({width:780,height:600});
  await page.goto("/");
  const button=(name:string)=>page.getByRole("button",{name,exact:true});
  await button("새로 만들기").click();await button("xinfra 캔버스").click();
  const confirm=button("템플릿으로 시작");
  await expect(confirm).toBeInViewport({ratio:1});
  const original=await confirm.boundingBox();
  await page.locator(".catalog-content").evaluate(el=>el.scrollTop=el.scrollHeight);
  await expect(confirm).toBeInViewport({ratio:1});
  expect((await confirm.boundingBox())!.y).toBeCloseTo(original!.y,0);
});

test("chat uses tall windows and keeps submit visible beside expanded options",async({page})=>{
  await page.setViewportSize({width:1600,height:1440});
  await page.goto("/");
  const btn=(name:string)=>page.getByRole("button",{name,exact:true});
  await btn("새로 만들기").click();await btn("xcode 세션 만들기").click();
  const settings=btn("세션 설정 접기");
  if (await settings.isVisible()) await settings.click();
  await expect.poll(()=>page.locator(".chat-workbench").evaluate(el=>el.clientHeight)).toBeGreaterThan(900);
  await page.setViewportSize({width:980,height:700});
  await page.getByText("전송 미리보기",{exact:true}).click();
  await expect(page.getByLabel("xcode 메시지")).toBeInViewport({ratio:1});
  await expect(btn("전송")).toBeInViewport({ratio:1});
});

test("Analyzer groups shared source files and restores a path after reordering",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:"새로 만들기",exact:true}).click();
  await page.getByRole("button",{name:"Analyzer 만들기"}).click();
  const upload=async(names:string[])=>page.getByLabel("기존 분석 JSON 열기").setInputFiles({
    name:"paths.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({connections:names.map(name=>({
      status:"declared",nodes:[{kind:"Service",name}],evidence:[{file:"app.yaml",line:2}]}))}))});
  await upload(["one","two"]);
  await page.getByText("파일별 경로 근거 · 1개 파일").click();
  await page.locator(".evidence-file").getByRole("button",{name:"경로 2",exact:true}).click();
  await upload(["two","one"]);
  await expect(page.locator("#network-path-0 summary")).toBeFocused();
  await expect(page.locator("#network-path-0")).toContainText("two");
});

test("sheet row menu deletes the selected data rows or just the clicked row",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:"새로 만들기",exact:true}).click();
  await page.getByRole("button",{name:"새 시트 테이블",exact:true}).click();
  const cell=(r:number)=>page.getByLabel("시트 1 A"+r,{exact:true});
  for(const [i,value] of ["header","one","two","three","four"].entries()) await cell(i+1).fill(value);
  await page.getByLabel("첫 행을 헤더로 사용").check();
  await cell(2).click(); await cell(3).click({modifiers:["Shift"]});
  await cell(3).click({button:"right"});
  await expect(page.getByRole("button",{name:"2행 삭제",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"선택한 2개 행 삭제"}).click();
  await expect(cell(1)).toHaveValue("header");
  await expect(cell(2)).toHaveValue("three");
  await page.getByRole("button",{name:"1행 선택",exact:true}).click({button:"right"});
  await cell(3).dispatchEvent("contextmenu",{clientX:1279,clientY:719});
  await expect(page.getByRole("group",{name:"행 작업"})).toBeInViewport({ratio:1});
  await page.keyboard.press("Escape");
  await expect(page.getByRole("group",{name:"행 작업"})).toBeHidden();
  await cell(2).click({button:"right"});
  await page.getByRole("button",{name:"1행 삭제",exact:true}).click();
  await expect(cell(2)).toHaveValue("four");
});

test("wide xcode header uses the page while chat stays centered",async({page})=>{
  await page.setViewportSize({width:1920,height:1080});
  await page.goto("/");
  await page.getByRole("button",{name:"새로 만들기",exact:true}).click();
  await page.getByRole("button",{name:"xcode 세션 만들기",exact:true}).click();
  const header=await page.locator(".chat-header").boundingBox();
  const composer=await page.locator(".chat-composer").boundingBox();
  expect(header!.width-composer!.width).toBeGreaterThan(200);
  expect(Math.abs(header!.x+header!.width/2-composer!.x-composer!.width/2)).toBeLessThan(2);
  for (const width of [911,390]) {
    await page.setViewportSize({width,height:600});
    await expect(page.locator(".chat-header h2")).toBeInViewport({ratio:1});
    await expect(page.locator(".chat-settings-toggle")).toBeInViewport({ratio:1});
    const box=await page.locator(".chat-composer").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x+box!.width).toBeLessThanOrEqual(width);
  }
});
