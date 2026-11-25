import { _electron,expect } from "@playwright/test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {zipSync,strToU8} from "fflate";
import ExcelJS from "exceljs";

for(const scale of process.platform==="win32"?[1.25,1.5]:[1.25]){
  const root=await mkdtemp(path.join(tmpdir(),"xdocs-conversation-"));
  const profile=path.join(root,"profile"), vault=path.join(root,"vault");
  await mkdir(profile);await mkdir(vault);
  await writeFile(path.join(profile,"workspace.json"),JSON.stringify({root:vault}));
  const requests=[];
  const server=createServer(async(req,res)=>{
    let data="";for await(const chunk of req)data+=chunk;
    requests.push({data,res});
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  let app,page;
  const button=name=>page.getByRole("button",{name,exact:true});
  const input=()=>page.getByLabel("xcode 메시지");
  async function launch(){
    const exe=process.env.XDOCS_EXECUTABLE;
    app=await _electron.launch({args:[...(exe?[]:["."]),"--force-device-scale-factor="+scale],executablePath:exe||undefined,env:{...process.env,XDOCS_TEST_DATA:profile}});
    await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
    page=await app.firstWindow();page.setDefaultTimeout(15000);
  }
  const count=n=>expect.poll(()=>requests.length).toBe(n);
  const delta=text=>"data: "+JSON.stringify({choices:[{delta:{content:text}}]})+"\n\n";
  function answer(index,text){requests[index].res.writeHead(200,{"Content-Type":"text/event-stream"});requests[index].res.end(delta(text)+"data: [DONE]\n\n");}
  async function send(text){await input().fill(text);await input().press("Enter");}
  async function visibleControls(names){
    for(const name of names){
      const locator=name==="입력"?input():button(name);
      await expect(locator).toBeInViewport();
      assert.ok(await locator.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1;}),name);
    }
  }
  try{
    await launch();await button("새로 만들기").click();await button("xcode 세션 만들기").click();
    await button("세션 설정 펼치기").click();
    await page.getByLabel("API 주소").fill("http://127.0.0.1:"+server.address().port+"/v1/chat/completions");
    await page.getByLabel("모델명",{exact:true}).fill("model-"+"long-".repeat(24));
    await button("설정 저장").click();
    await expect(page.getByRole("dialog", { name: "세션 설정" })).toBeHidden();
    const book=new ExcelJS.Workbook();book.addWorksheet("예산").getCell("B2").value=730;
    const doc=zipSync({"word/document.xml":strToU8('<w:document xmlns:w="urn:w"><w:p><w:t>회의 결정</w:t></w:p></w:document>')});
    await page.getByLabel("파일 첨부 선택").setInputFiles([
      {name:"예산.xlsx",mimeType:"application/octet-stream",buffer:Buffer.from(await book.xlsx.writeBuffer())},
      {name:"회의.docx",mimeType:"application/octet-stream",buffer:Buffer.from(doc)}]);
    await input().fill("자료 검토");await expect(button("회의.docx 제거")).toBeVisible();
    await app.close();await launch();
    if(!await input().count()) await page.getByRole("button",{name:"새 xcode 세션",exact:true}).first().click();
    await expect(input()).toHaveValue("자료 검토");await expect(button("예산.xlsx 제거")).toBeVisible();
    await input().press("Enter");await count(1);
    requests[0].res.writeHead(200,{"Content-Type":"text/event-stream"});requests[0].res.write(delta("수신한 부분 응답"));
    await expect(page.locator(".chat-live")).toContainText("부분 응답");
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(820,660));
    await send("나중에");
    await page.getByLabel("파일 첨부 선택").setInputFiles(["배포 계획","검토 기준"].map(name=>({name:name+".txt",mimeType:"text/plain",buffer:Buffer.from(name)})));
    await expect(button("검토 기준.txt 제거")).toBeVisible();
    await input().fill("지금 처리");await visibleControls(["입력","대기열에 추가","중지"]);
    await page.getByText("전송 옵션",{exact:true}).click();await button("지금 이어서 요청").click();
    await count(2);assert.match(requests[1].data,/지금 처리/);assert.match(requests[1].data,/수신한 부분 응답/);
    answer(1,"근거 [예산.xlsx#예산!B2] [회의.docx#문단 1] [회의.docx#문단 9]");
    await count(3);assert.match(requests[2].data,/나중에/);
    requests[2].res.writeHead(400);requests[2].res.end('{"error":{"code":"context_length_exceeded"}}');
    await page.getByText("전송 범위 줄이기",{exact:true}).click();
    await input().fill("별도 초안");await visibleControls(["입력","대기열에 추가"]);
    await page.locator(".input-repair input").first().uncheck();
    await button("선택한 범위로 재시도").click();await count(4);
    assert.doesNotMatch(requests[3].data,/수신한 부분 응답/);answer(3,"마지막 답");
    await expect(page.locator(".chat-answer").last()).toContainText("마지막 답");
    await button("대화 찾기").click();await page.getByLabel("세션 대화 검색").fill("근거");
    await expect(page.locator('[data-found="1"]')).toHaveCount(1);
    await page.getByLabel("세션 대화 검색").press("Escape");
    const turn=page.locator("article.chat-turn").nth(1);
    await turn.locator(".answer-source summary").first().click();
    await expect(turn.locator(".answer-source pre").first()).toHaveText("730");
    await expect(turn.locator(".answer-source")).toHaveCount(2);
    const text=turn.locator(".chat-answer p");
    await text.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(range);el.dispatchEvent(new MouseEvent("mouseup",{bubbles:true}));});
    await turn.getByText("인용해 질문").click();await expect(input()).toHaveValue(/별도 초안[\s\S]+> 근거/);
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1200,800));
    for(const [action,title] of [["노트로 저장","결정 노트"],["여기서 새 세션","분기 세션"]]){
      await turn.hover();await turn.getByLabel("답변 메뉴").click();await turn.getByText(action,{exact:true}).click();
      await page.getByLabel("새 페이지 제목").fill(title);await page.locator(".answer-save").getByText("저장",{exact:true}).click();
      if(action==="노트로 저장"){
        const content=await page.evaluate(async()=>{const w=await window.xdocs.refresh();return (await window.xdocs.readNote(w.notes.find(n=>n.title==="결정 노트").id)).body;});
        assert.match(content,/원래 대화/);assert.match(content,/근거/);
        await page.getByRole("button",{name:"새 xcode 세션",exact:true}).first().click();
      }else await expect(page.locator("article.chat-turn")).toHaveCount(2);
    }
    console.log("PASS session actions and layout at scale",scale);
  }finally{if(app)await app.close().catch(()=>{});server.closeAllConnections();server.close();await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:150});}
}
