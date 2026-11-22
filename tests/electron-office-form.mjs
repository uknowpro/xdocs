import { _electron, expect } from "@playwright/test";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

const root = await mkdtemp(path.join(tmpdir(), "xdocs-form-"));
const data = path.join(root, "data"), vault = path.join(root, "vault");
await mkdir(data); await mkdir(vault);
await writeFile(path.join(data,"workspace.json"),JSON.stringify({root:vault}));
const formPath = path.join(root,"report form.docx");
const document = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{amount}}</w:t></w:r></w:p><w:sdt><w:sdtPr><w:alias w:val="Owner"/><w:text/></w:sdtPr><w:sdtContent><w:p><w:r><w:t>Enter owner</w:t></w:r></w:p></w:sdtContent></w:sdt><w:p><w:r><w:t>Code ____</w:t></w:r></w:p><w:p><w:r><w:t>{{date}}</w:t></w:r></w:p><w:p><w:r><w:t>{{currency}}</w:t></w:r></w:p></w:body></w:document>';
const source = zipSync({"word/document.xml":strToU8(document)});
await writeFile(formPath,source);
const book = new ExcelJS.Workbook();
const evidence=book.addWorksheet("Budget");
evidence.getCell("D12").value = 730;
evidence.getCell("D13").value = new Date("2026-11-21T00:00:00Z");evidence.getCell("D13").numFmt="yyyy-mm-dd";
evidence.getCell("D14").value = 730;evidence.getCell("D14").numFmt='0.00 "원"';
const budget = path.join(root,"budget.xlsx"); await book.xlsx.writeFile(budget);
const packets = [];
const server = createServer(async(req,res)=>{
  const chunks=[]; for await(const chunk of req) chunks.push(chunk);
  packets.push(JSON.parse(Buffer.concat(chunks)));
  const text = JSON.stringify({values:{amount:730,date:"2026년 11월 22일",currency:"USD 730","word/document.xml#control0":"Kim","word/document.xml#blank2-5":"ABC"},sources:{amount:"budget.xlsx · Budget!D12",date:"budget.xlsx#Budget!D13",currency:"budget.xlsx#Budget!D14"}});
  res.writeHead(200,{"Content-Type":"text/event-stream"});
  res.end("data: "+JSON.stringify({choices:[{delta:{content:text}}]})+"\n\ndata: [DONE]\n\n");
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
let app;
async function launch(profile=data){
  app = await _electron.launch({args:process.env.XDOCS_EXECUTABLE ? []:["."],executablePath:process.env.XDOCS_EXECUTABLE || undefined,env:{...process.env,XDOCS_TEST_DATA:profile}});
  await app.evaluate(({dialog},file)=>{
    dialog.showMessageBox=async()=>({response:1});
    dialog.showOpenDialog=async(_w,options)=>{
      if(options.defaultPath!==file) throw Error("Unexpected suggested template");
      return {canceled:false,filePaths:[file]};
    };
  },formPath);
  const page=await app.firstWindow();
  await expect(page.locator(".workspace-switch strong")).toHaveText("vault",{timeout:20000});
  return page;
}
try {
  let page=await launch();
  const button=name=>page.getByRole("button",{name,exact:true});
  await button("새로 만들기").click(); await button("xcode 세션 만들기").click();
  await button("세션 설정 펼치기").click();
  await page.getByLabel("API 주소").fill("http://127.0.0.1:"+server.address().port+"/v1/chat/completions");
  await button("설정 저장").click();
  await page.getByLabel("파일 첨부 선택").setInputFiles([formPath,budget]);
  const prompt=page.getByLabel("xcode 메시지");
  await prompt.fill("예산으로 첨부 양식을 채워줘"); await button("전송").click();
  let panel=page.locator(".office-form");
  await expect(panel.locator('input[value="730"]')).toBeVisible();
  await expect(panel.locator('input[value="Kim"]')).toBeVisible();
  const field=panel.locator(".office-source-field").filter({has:page.locator('input[value="730"]')});
  await field.getByText("budget.xlsx · Budget!D12",{exact:true}).click();
  await expect(field.locator("pre")).toHaveText("730");
  await panel.getByLabel("근거 누락·충돌만 보기").check();
  await expect(panel.locator('input[value="730"]')).toHaveCount(0);
  await expect(panel).toContainText("연결된 근거 없음");
  await expect(panel.getByText("출처와 값 대조 필요")).toHaveCount(2);
  await panel.getByText("budget.xlsx · Budget!D13",{exact:true}).click();
  await expect(panel).toContainText("날짜가 다릅니다.");
  await expect(panel).toContainText("2026-11-21");
  await panel.getByText("budget.xlsx · Budget!D14",{exact:true}).click();
  await expect(panel).toContainText("금액 또는 수치의 단위 확인");
  await expect(panel).toContainText("730 원");
  await panel.getByLabel("근거 누락·충돌만 보기").uncheck();
  assert.match(JSON.stringify(packets.at(-1)), /Budget.*D12=730/s);
  const saved=path.join(root,"copy.docx");
  await app.evaluate(({dialog},dest)=>{
    dialog.showSaveDialog=async()=>({canceled:false,filePath:dest});
  },saved);
  await button("저장 전 미리보기").click();
  let preview=page.getByRole("region",{name:"작성본 미리보기"});
  const owner=preview.locator(".office-preview-fields > section").filter({hasText:"Owner"});
  await expect(owner).toContainText("Enter owner");
  await expect(owner).toContainText("Kim");
  await owner.getByLabel("반영",{exact:true}).uncheck();
  await preview.getByLabel("amount 검토 사유").fill("예산 시트에서 확인");
  await preview.locator(".office-preview-fields > section").filter({hasText:"amount"}).getByLabel("검토 승인").check();
  await button("작성본 사본 저장").click();
  await expect.poll(async () => (await readFile(saved).catch(()=>Buffer.alloc(0))).length).toBeGreaterThan(0);
  const xml=strFromU8(unzipSync(await readFile(saved))["word/document.xml"]);
  assert.match(xml,/>730</);assert.match(xml,/>Enter owner</);assert.doesNotMatch(xml,/>Kim</);assert.match(xml,/Code ____/);
  await preview.getByRole("button",{name:"닫기",exact:true}).click();
  await button("저장 전 미리보기").click();
  await expect(preview.getByLabel("amount 검토 사유")).toHaveValue("예산 시트에서 확인");
  const markdown=path.join(root,"office-review.md");
  await app.evaluate(({BrowserWindow},dest)=>{
    BrowserWindow.getAllWindows()[0].webContents.session.once("will-download",(_event,item)=>item.setSavePath(dest));
  },markdown);
  await button("검토 기록 Markdown 저장").click();
  await expect.poll(()=>readFile(markdown,"utf8").catch(()=>"")).toContain("예산 시트에서 확인");
  await button("양식 패널 닫기").click();
  await prompt.fill('"'+formPath+'" 양식을 채워줘'); await button("전송").click();
  await expect(panel.locator('input[value="730"]')).toBeVisible();
  assert.deepEqual(await readFile(formPath),Buffer.from(source));
  const excelTemplate=new ExcelJS.Workbook();
  const templateSheet=excelTemplate.addWorksheet("Draft");
  templateSheet.getCell("A1").value="{{forecast}}";
  templateSheet.getCell("A2").value="{{excluded}}";
  templateSheet.getCell("A3").value={formula:"SUM(A1:A2)",result:0};
  await panel.getByLabel("원본 양식").setInputFiles({
    name:"draft.xlsx",mimeType:"application/octet-stream",buffer:Buffer.from(await excelTemplate.xlsx.writeBuffer()),
  });
  await panel.locator(".office-source-field").filter({hasText:"forecast"}).getByPlaceholder("확인 필요").fill("1200");
  await panel.locator(".office-source-field").filter({hasText:"excluded"}).getByPlaceholder("확인 필요").fill("500");
  await button("저장 전 미리보기").click();
  await expect(preview).toContainText("{{forecast}}");
  await preview.locator(".office-preview-fields > section").filter({hasText:"excluded"}).getByLabel("반영",{exact:true}).uncheck();
  const excelOutput=path.join(root,"draft-copy.xlsx");
  await app.evaluate(({dialog},dest)=>{
    dialog.showSaveDialog=async()=>({canceled:false,filePath:dest});
  },excelOutput);
  await button("작성본 사본 저장").click();
  await expect.poll(async()=>(await readFile(excelOutput).catch(()=>Buffer.alloc(0))).length).toBeGreaterThan(0);
  const actual=new ExcelJS.Workbook();await actual.xlsx.readFile(excelOutput);
  assert.equal(actual.getWorksheet("Draft").getCell("A1").value,1200);
  assert.equal(actual.getWorksheet("Draft").getCell("A2").value,"{{excluded}}");
  await expect(preview.getByLabel("작성본 검사 결과")).toContainText("수식 1개 비교");
  await preview.getByLabel("저장한 작성본 검사").setInputFiles(excelOutput);
  await expect(preview.getByLabel("작성본 검사 결과")).toContainText("작성본 검사 통과");
  actual.getWorksheet("Draft").getCell("A3").value={formula:"1+1",result:2};
  await preview.getByLabel("저장한 작성본 검사").setInputFiles({
    name:"tampered.xlsx",mimeType:"application/octet-stream",buffer:Buffer.from(await actual.xlsx.writeBuffer()),
  });
  await expect(preview.getByLabel("작성본 검사 결과")).toContainText("수식이 변경되었습니다.");
  await preview.getByLabel("forecast 검토 사유").fill("검토를 이어서 진행");
  await button("양식 패널 닫기").click();
  await app.close();
  page=await launch();
  panel=page.locator(".office-form");
  preview=page.getByRole("region",{name:"작성본 미리보기"});
  if(!await page.locator(".xcode").count())await page.getByRole("button",{name:"새 xcode 세션",exact:true}).first().click();
  await button("Office 검토 초안 열기").click();
  await expect(preview.getByLabel("forecast 검토 사유")).toHaveValue("검토를 이어서 진행");
  await expect(preview.locator(".office-preview-fields > section").filter({hasText:"excluded"}).getByLabel("반영",{exact:true})).not.toBeChecked();
  templateSheet.getCell("A2").value="고정 제목";
  templateSheet.getCell("A4").value="{{newfield}}";
  await panel.getByLabel("원본 양식").setInputFiles({
    name:"draft.xlsx",mimeType:"application/octet-stream",buffer:Buffer.from(await excelTemplate.xlsx.writeBuffer()),
  });
  const delta=panel.getByLabel("원본 양식 변경");
  await expect(delta).toContainText("추가 · newfield");await expect(delta).toContainText("삭제 · excluded");
  await delta.getByText("일치하는 입력란의 검토 복구").click();
  await expect(preview.getByLabel("forecast 검토 사유")).toHaveValue("검토를 이어서 진행");
  await button("검토 이력").click();
  await page.locator(".review-filters summary").click();
  await page.getByLabel("검토 이력 종류").selectOption("office");
  await page.getByLabel("검토 이력 결과").selectOption("verified");
  await page.getByLabel("검토 이력 검색").fill("예산 시트에서 확인");
  const entry=page.locator(".review-search-results details").filter({hasText:"report form.docx"}).first();
  await entry.locator("summary").click();
  await expect(entry).toContainText("예산 시트에서 확인");
  await expect(entry).toContainText("copy.docx");
  await entry.getByLabel("작성본 대조").setInputFiles(saved);
  await expect(entry).toContainText("저장 당시 검사한 작성본과 동일합니다.");
  await entry.getByLabel("작성본 대조").setInputFiles(formPath);
  await expect(entry).toContainText("저장 당시 검사한 작성본과 다릅니다.");
  await page.locator(".review-backup summary").click();
  const backup=path.join(root,"office-backup.json");
  await app.evaluate(({BrowserWindow},dest)=>{
    BrowserWindow.getAllWindows()[0].webContents.session.once("will-download",(_event,item)=>item.setSavePath(dest));
  },backup);
  await button("검토 백업 내보내기").click();
  await expect.poll(()=>readFile(backup,"utf8").catch(()=>"")).toContain("xdocs-review-backup");
  await page.getByLabel("검토 백업 가져오기").setInputFiles(backup);
  await expect(page.locator(".review-backup")).toContainText("복원 가능 0개");
  const otherProfile=path.join(root,"restored");
  await mkdir(otherProfile);
  await writeFile(path.join(otherProfile,"workspace.json"),JSON.stringify({root:vault}));
  await app.close();
  page=await launch(otherProfile);
  await button("검토 이력").click();await page.locator(".review-backup summary").click();
  await page.getByLabel("검토 백업 가져오기").setInputFiles(backup);
  await button("중복 제외하고 복원").click();
  await expect(page.locator(".review-backup [role=status]")).toContainText(/복원 [1-9]/);
  await page.getByLabel("검토 이력 검색").fill("예산 시트에서 확인");
  await expect(page.locator(".review-search-results")).toContainText("report form.docx");
  await app.close();
  page=await launch(otherProfile);
  if(!await page.locator(".xcode").count())await button("새 xcode 세션").first().click();
  await button("Office 검토 초안 열기").click();
  await expect(page.getByRole("region",{name:"작성본 미리보기"}).getByLabel("forecast 검토 사유")).toHaveValue("검토를 이어서 진행");

  console.log("PASS attachment and local-path form review, workbook references and separate Word output");
} finally {
  await app?.close();server.closeAllConnections();server.close();await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
