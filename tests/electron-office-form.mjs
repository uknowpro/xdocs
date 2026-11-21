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
const document = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{amount}}</w:t></w:r></w:p><w:sdt><w:sdtPr><w:alias w:val="Owner"/><w:text/></w:sdtPr><w:sdtContent><w:p><w:r><w:t>Enter owner</w:t></w:r></w:p></w:sdtContent></w:sdt><w:p><w:r><w:t>Code ____</w:t></w:r></w:p></w:body></w:document>';
const source = zipSync({"word/document.xml":strToU8(document)});
await writeFile(formPath,source);
const book = new ExcelJS.Workbook();
book.addWorksheet("Budget").getCell("D12").value = 730;
const budget = path.join(root,"budget.xlsx"); await book.xlsx.writeFile(budget);
const packets = [];
const server = createServer(async(req,res)=>{
  const chunks=[]; for await(const chunk of req) chunks.push(chunk);
  packets.push(JSON.parse(Buffer.concat(chunks)));
  const text = JSON.stringify({values:{amount:730,"word/document.xml#control0":"Kim","word/document.xml#blank2-5":"ABC"},sources:{amount:"budget.xlsx · Budget!D12"}});
  res.writeHead(200,{"Content-Type":"text/event-stream"});
  res.end("data: "+JSON.stringify({choices:[{delta:{content:text}}]})+"\n\ndata: [DONE]\n\n");
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
let app;
try {
  app = await _electron.launch({args:process.env.XDOCS_EXECUTABLE ? []:["."],executablePath:process.env.XDOCS_EXECUTABLE || undefined,env:{...process.env,XDOCS_TEST_DATA:data}});
  await app.evaluate(({dialog},file)=>{
    dialog.showMessageBox=async()=>({response:1});
    dialog.showOpenDialog=async(_w,options)=>{
      if(options.defaultPath!==file) throw Error("Unexpected suggested template");
      return {canceled:false,filePaths:[file]};
    };
  },formPath);
  const page=await app.firstWindow();
  const button=name=>page.getByRole("button",{name,exact:true});
  await button("새로 만들기").click(); await button("xcode 세션 만들기").click();
  await button("세션 설정 펼치기").click();
  await page.getByLabel("API 주소").fill("http://127.0.0.1:"+server.address().port+"/v1/chat/completions");
  await button("설정 저장").click();
  await page.getByLabel("파일 첨부 선택").setInputFiles([formPath,budget]);
  const prompt=page.getByLabel("xcode 메시지");
  await prompt.fill("예산으로 첨부 양식을 채워줘"); await button("전송").click();
  const panel=page.locator(".office-form");
  await expect(panel.locator('input[value="730"]')).toBeVisible();
  await expect(panel.locator('input[value="Kim"]')).toBeVisible();
  const field=panel.locator(".office-source-field").filter({has:panel.locator('input[value="730"]')});
  await field.getByText("budget.xlsx · Budget!D12",{exact:true}).click();
  await expect(field.locator("pre")).toHaveText("730");
  await panel.getByLabel("근거 누락·충돌만 보기").check();
  await expect(panel.locator('input[value="730"]')).toHaveCount(0);
  await expect(panel).toContainText("연결된 근거 없음");
  await panel.getByLabel("근거 누락·충돌만 보기").uncheck();
  assert.match(JSON.stringify(packets.at(-1)), /Budget.*D12=730/s);
  const saved=path.join(root,"copy.docx");
  await app.evaluate(({BrowserWindow},dest)=>{
    BrowserWindow.getAllWindows()[0].webContents.session.once("will-download",(_event,item)=>item.setSavePath(dest));
  },saved);
  await button("작성본 사본 저장").click();
  await expect.poll(async () => (await readFile(saved).catch(()=>Buffer.alloc(0))).length).toBeGreaterThan(0);
  const xml=strFromU8(unzipSync(await readFile(saved))["word/document.xml"]);
  assert.match(xml,/>730</);assert.match(xml,/>Kim</);assert.match(xml,/Code ____/);
  await button("양식 패널 닫기").click();
  await prompt.fill('"'+formPath+'" 양식을 채워줘'); await button("전송").click();
  await expect(panel.locator('input[value="730"]')).toBeVisible();
  assert.deepEqual(await readFile(formPath),Buffer.from(source));
  console.log("PASS attachment and local-path form review, workbook references and separate Word output");
} finally {
  await app?.close();server.closeAllConnections();server.close();await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
