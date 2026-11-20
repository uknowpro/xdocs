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
