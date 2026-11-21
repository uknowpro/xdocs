import { _electron, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root=await mkdtemp(path.join(tmpdir(),"xdocs-message-queue-"));
const data=path.join(root,"profile"), vault=path.join(root,"vault");
await mkdir(data);await mkdir(vault);
await writeFile(path.join(data,"workspace.json"),JSON.stringify({root:vault}));
const requests=[];
const server=createServer(async(req,res)=>{
  let body="";
  for await (const chunk of req) body+=chunk;
  requests.push({messages:JSON.parse(body).messages,res});
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
}
async function submit(text){
  await input().fill(text);await input().press("Enter");
}
function finish(i,text){
  requests[i].res.writeHead(200,{"Content-Type":"text/event-stream"});
  requests[i].res.end("data: "+JSON.stringify({choices:[{delta:{content:text}}]})+"\n\ndata: [DONE]\n\n");
}
const count=n=>expect.poll(()=>requests.length).toBe(n);
async function openQueue(){
  const list=page.locator(".chat-waiting");
  await expect(list).toBeVisible();
  if(!await list.evaluate(el=>el.open)) await list.locator("summary").click();
  return list;
}
try{
  await launch();await create();await submit("first-A");await count(1);
  await page.getByLabel("파일 첨부 선택").setInputFiles({name:"A.txt",mimeType:"text/plain",buffer:Buffer.from("isolated-A")});
  await submit("queued-A");let list=await openQueue();
  await list.getByRole("button",{name:"수정",exact:true}).click();
  await page.getByLabel("대기 메시지 수정").fill("edited-A");
  await btn("수정 저장").click();await expect(list).toContainText("edited-A");
  await submit("cancel-this");await expect(list).toContainText("cancel-this");
  await list.locator(":scope > div").filter({hasText:"cancel-this"}).getByRole("button",{name:"취소"}).click();
  await expect(list).not.toContainText("cancel-this");
  await input().fill("unfinished-A");
  await create();await submit("first-B");await count(2);
  await submit("queued-B");await openQueue();
  finish(0,"answer-A");await count(3);
  const third=JSON.stringify(requests[2].messages);
  assert.match(third,/edited-A/);assert.match(third,/answer-A/);assert.match(third,/isolated-A/);
  assert.doesNotMatch(third,/first-B|cancel-this/);finish(2,"completed-A");
  requests[1].res.writeHead(429);requests[1].res.end("usage_limit_exceeded");
  await expect(btn("대기열 재개")).toBeVisible();await count(3);
  await app.close();await launch();
  const tree=page.locator(".page-tree");
  await tree.getByRole("button",{name:"새 xcode 세션",exact:true}).click();
  await expect(input()).toHaveValue("unfinished-A");
  await expect(page.locator(".chat-answer").last()).toContainText("completed-A");
  await tree.getByRole("button",{name:"새 xcode 세션 2",exact:true}).click();
  await openQueue();await count(3);
  await btn("대기열 재개").click();await count(4);
  assert.match(JSON.stringify(requests[3].messages),/queued-B/);
  assert.doesNotMatch(JSON.stringify(requests[3].messages),/edited-A|isolated-A/);
  await submit("after-stop");await openQueue();await btn("중지").click();
  await expect(btn("대기열 재개")).toBeVisible();
  await count(4);
  console.log("PASS session queues: edit, cancel, attachments, background history, draft, quota pause, restart and stop");
}finally{
  if(app) await app.close().catch(()=>{});
  server.closeAllConnections();server.close();
  await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:150});
}
