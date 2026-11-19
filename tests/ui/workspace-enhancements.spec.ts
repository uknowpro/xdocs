import {test,expect} from "@playwright/test";

test("selected sheet range creates a note without neighbouring cells",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:"새 시트 테이블",exact:true}).click();
  const cell=(address:string)=>page.getByLabel("시트 1 "+address,{exact:true});
  await cell("A1").fill("공유 항목");await cell("A2").fill("선택 값");await cell("B1").fill("제외 값");
  await cell("A1").click();await cell("A2").click({modifiers:["Shift"]});
  await page.getByRole("button",{name:"선택 범위를 노트로 복제"}).click();
  await expect(page.locator(".markdown")).toContainText("선택 값");await expect(page.locator(".markdown")).not.toContainText("제외 값");
});

test("consecutive Analyzer imports expose added and removed evidence",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"Analyzer 만들기"}).click();
  for(const target of ["/old","/new"]){
    await page.getByLabel("기존 분석 JSON 열기").setInputFiles({name:"scan.json",mimeType:"application/json",
      buffer:Buffer.from(JSON.stringify({project:{},connections:[],findings:[{direction:"inbound",kind:"route",target,file:"Orders.java",line:5,status:"candidate"}]}))});
    await expect(page.locator(".analyzer-path").first()).toContainText(target);
  }
  await page.getByText("직전 분석과 변경 비교").click();
  const diff=page.locator("details").filter({has:page.getByText("직전 분석과 변경 비교",{exact:true})});
  await expect(diff).toContainText("/old");await expect(diff).toContainText("/new");
});
