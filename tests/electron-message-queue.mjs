import { _electron, expect } from "@playwright/test";
import { once } from "node:events";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const mode=process.argv[2];
const root=process.argv[3] || await mkdtemp(path.join(tmpdir(),"xdocs-message-queue-"));
const data=path.join(root,"profile"), vault=path.join(root,"vault");
await mkdir(data,{recursive:true});await mkdir(vault,{recursive:true});
await writeFile(path.join(data,"workspace.json"),JSON.stringify({root:vault}));
const requests=[];
const server=createServer(async(req,res)=>{
  let body="";
  for await (const chunk of req) body+=chunk;
  requests.push({messages:JSON.parse(body).messages,model:JSON.parse(body).model,res});
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const endpoint="http://127.0.0.1:"+server.address().port+"/v1/chat/completions";
let app,page;
const btn=name=>page.getByRole("button",{name,exact:true});
const input=()=>page.getByLabel("xcode 메시지");
async function launch(){
  const exe=process.env.XDOCS_EXECUTABLE;
  app=await _electron.launch({args:exe?[]:["."],...(exe?{executablePath:path.resolve(exe)}:{}),env:{...process.env,XDOCS_TEST_DATA:data}});
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
  page=await app.firstWindow();
}
async function create(){
  await btn("새로 만들기").click();await btn("xcode 세션 만들기").click();
  await btn("세션 설정 펼치기").click();
  await page.getByLabel("API 주소").fill(endpoint);await btn("설정 저장").click();
  if (mode !== "seed")
    await expect(page.getByRole("dialog", { name: "세션 설정" })).toBeHidden();
}
async function submit(text){
  await input().fill(text);
  await expect(page.getByRole("button", { name: /^(전송|대기열에 추가)$/ })).toBeEnabled();
  await input().press("Enter");
}
function finish(i,text){
  requests[i].res.writeHead(200,{"Content-Type":"text/event-stream"});
  requests[i].res.end("data: "+JSON.stringify({choices:[{delta:{content:text}}]})+"\n\ndata: [DONE]\n\n");
}
const count=n=>expect.poll(()=>requests.length).toBe(n);
async function openQueue(){
  const list=page.locator(".chat-waiting");
  await expect(list).toBeVisible();
  if(!await list.evaluate(el=>el.open)) await list.locator(":scope > summary").click();
  return list;
}
try{
  await launch();
  if(mode==="seed"){
    await create();await submit("upgrade question");await count(1);finish(0,"upgrade answer");
    await expect(page.locator(".chat-answer")).toContainText("upgrade answer");
    await input().fill("upgrade draft");
  } else {
  if(mode==="verify"){
    if(!await input().count()) await page.locator(".page-tree").getByRole("button",{name:"새 xcode 세션",exact:true}).click();
    await expect(input()).toHaveValue("upgrade draft");
    await expect(page.locator(".chat-answer")).toContainText("upgrade answer");
  }
  await create();await submit("first-A");await count(1);
  await page.getByLabel("파일 첨부 선택").setInputFiles({name:"A.txt",mimeType:"text/plain",buffer:Buffer.from("isolated-A")});
  await submit("queued-A");let list=await openQueue();
  await list.getByRole("button",{name:"수정",exact:true}).click();
  await page.getByLabel("대기 메시지 수정").fill("edited-A");
  await btn("수정 저장").click();await expect(list).toContainText("edited-A");
  await submit("cancel-this");await expect(list).toContainText("cancel-this");
  const cancelRow=list.locator(":scope > div").filter({hasText:"cancel-this"});
  await cancelRow.getByRole("button",{name:"위로 이동"}).click();
  await expect(list.locator(":scope > div").first()).toContainText("cancel-this");
  await expect(page.locator(".page-tree .session-queue-count").first()).toContainText("대기 2개");
  await list.locator(":scope > div").filter({hasText:"cancel-this"}).getByRole("button",{name:"취소"}).click();
  await expect(list).not.toContainText("cancel-this");
  await submit("batch-one");
  await submit("batch-two");
  await btn("여러 항목 선택").click();
  await list.getByRole("checkbox", { name: "batch-one 선택" }).check();
  await list.getByRole("checkbox", { name: "batch-two 선택" }).check();
  await btn("선택 항목 위로").click();
  await expect(list.locator(".queue-select")).toHaveText(["batch-one", "batch-two", "edited-A"]);
  await btn("선택 항목 취소").click();
  await expect(list.locator(".queue-select")).toHaveText(["edited-A"]);
  await btn("선택 끝내기").click();
  await input().fill("unfinished-A");
  await create();await submit("first-B");await count(2);
  await page.getByLabel("파일 첨부 선택").setInputFiles({name:"B.txt",mimeType:"text/plain",buffer:Buffer.from("recovered attachment B")});
  await submit("queued-B");await openQueue();
  finish(0,"answer-A");await count(3);
  const third=JSON.stringify(requests[2].messages);
  assert.match(third,/edited-A/);assert.match(third,/answer-A/);assert.match(third,/isolated-A/);
  assert.doesNotMatch(third,/first-B|cancel-this/);finish(2,"completed-A");
  requests[1].res.writeHead(429);requests[1].res.end("usage_limit_exceeded");
  await expect(btn("이 메시지 재시도")).toBeVisible();await count(3);
  await expect(page.locator(".queue-actions")).toContainText("사용량 또는 요청 한도에 도달함");
  await btn("이 메시지 재시도").click();await count(4);
  assert.match(JSON.stringify(requests[3].messages),/first-B/);
  const child=app.process(), exited=once(child,"exit");
  if(process.platform==="win32") execFileSync("taskkill",["/F","/T","/PID",String(child.pid)]);
  else child.kill("SIGKILL");
  await exited;await launch();
  const tree=page.locator(".page-tree");
  await tree.getByRole("button",{name:mode==="verify"?"새 xcode 세션 2":"새 xcode 세션",exact:true}).click();
  await expect(input()).toHaveValue("unfinished-A");
  await expect(page.locator(".chat-answer").last()).toContainText("completed-A");
  await tree.getByRole("button",{name:mode==="verify"?"새 xcode 세션 3":"새 xcode 세션 2",exact:true}).click();
  await openQueue();await count(4);
  await expect(page.locator(".queue-recovery")).toContainText("전송 결과 확인 필요");
  if(await btn("세션 설정 펼치기").isVisible()) await btn("세션 설정 펼치기").click();
  await page.getByLabel("모델명",{exact:true}).fill("replacement-model");await btn("설정 저장").click();
  await expect(page.locator(".queue-target")).toContainText("replacement-model");
  await expect(btn("설정 확인")).toBeVisible();
  await btn("이 메시지에 현재 설정 적용").click();
  await expect(page.locator(".queue-target")).toHaveCount(0);
  await btn("건너뛰고 다음 전송").click();await count(5);
  assert.match(JSON.stringify(requests[4].messages),/queued-B/);
  assert.match(JSON.stringify(requests[4].messages),/recovered attachment B/);
  assert.equal(requests[4].model,"replacement-model");
  assert.doesNotMatch(JSON.stringify(requests[4].messages),/edited-A|isolated-A/);
  requests[4].res.writeHead(200, { "Content-Type": "text/event-stream" });
  requests[4].res.write('data: {"choices":[{"delta":{"content":"partial before switching"}}]}\n\n');
  await expect(page.locator(".chat-live")).toContainText("partial before switching");
  await submit("queued-first");
  await page.getByLabel("파일 첨부 선택").setInputFiles({
    name: "priority.txt", mimeType: "text/plain", buffer: Buffer.from("priority attachment"),
  });
  await submit("selected-now");
  list = await openQueue();
  const queueLabel = list.locator(":scope > summary");
  const queued = name => list.locator(".queue-select").filter({ hasText: name });
  await expect(queueLabel).toContainText("queued-first");
  await queued("queued-first").focus();
  await queued("queued-first").press("ArrowDown");
  await expect(queued("selected-now")).toBeFocused();
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await queued("selected-now").press(modifier + "+ArrowUp");
  await expect(queueLabel).toContainText("selected-now");
  await expect(queueLabel).toContainText("첨부 1개");
  await queued("selected-now").press(modifier + "+ArrowDown");
  await expect(queueLabel).toContainText("queued-first");
  await queued("selected-now").press(modifier + "+Enter");
  await count(6);
  const priority = JSON.stringify(requests[5].messages);
  assert.match(priority, /selected-now.*priority attachment/s);
  assert.match(priority, /partial before switching/);
  assert.doesNotMatch(priority, /queued-first/);
  const priorityRow = list.locator(":scope > div").filter({ hasText: "selected-now" });
  await expect(priorityRow).toContainText("전송 중");
  requests[5].res.writeHead(429);
  requests[5].res.end("usage_limit_exceeded");
  await expect(priorityRow).toContainText("사용량 또는 요청 한도에 도달함");
  await priorityRow.getByRole("button", { name: "이 메시지 재시도", exact: true }).click();
  await count(7);
  assert.match(JSON.stringify(requests[6].messages.at(-1)), /selected-now/);

  await submit("queued-last");
  await expect(queued("queued-last")).toBeVisible();
  await btn("중지하고 다음 보내기").click();
  await count(8);
  assert.match(JSON.stringify(requests[7].messages.at(-1)), /queued-first/);
  await expect(queued("queued-last")).toBeVisible();

  await page.getByLabel("xcode 세션 작업 상태").click();
  const sidebar = page.locator(".xcode-running");
  await expect(sidebar).toContainText("다음 · queued-last");
  await sidebar.getByRole("button", { name: /대기열 일시정지$/ }).click();
  await expect(queueLabel).toContainText("일시정지");
  finish(7, "first queued answer");
  await expect(page.locator(".chat-answer").last()).toContainText("first queued answer");
  await expect(btn("중지하고 다음 보내기")).toBeHidden();
  await count(8);
  await app.close();
  await launch();
  const activeTitle = mode === "verify" ? "새 xcode 세션 3" : "새 xcode 세션 2";
  await page.locator(".page-tree").getByRole("button", { name: activeTitle, exact: true }).click();
  await expect(page.locator(".chat-waiting > summary")).toContainText("일시정지");
  await count(8);
  await btn("대기열 재개").click();
  await count(9);
  assert.match(JSON.stringify(requests[8].messages.at(-1)), /queued-last/);
  await btn("중지").click();
  await expect(btn("이 메시지 재시도")).toBeVisible();
  await count(9);
  await btn("이 메시지 재시도").click();
  await count(10);
  requests[9].res.writeHead(429);
  requests[9].res.end("usage_limit_exceeded");
  await expect(page.locator(".chat-waiting .queue-recovery")).toContainText("사용량 또는 요청 한도에 도달함");
  await app.close();
  await launch();
  await page.locator(".page-tree").getByRole("button", { name: activeTitle, exact: true }).click();
  await expect(page.locator(".chat-waiting .queue-recovery")).toContainText("사용량 또는 요청 한도에 도달함");
  await count(10);
  console.log("PASS session queues: edit, cancel, attachments, background history, draft, quota pause, restart and stop");
  }
}finally{
  if(app) await app.close().catch(()=>{});
  server.closeAllConnections();server.close();
  if(!mode) await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:150});
}
