import { _electron, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";

const [mode, root] = process.argv.slice(2);
const profile = path.join(root, "profile"), vault = path.join(root, "vault");
if (mode === "seed") {
  await mkdir(profile, { recursive: true });
  await mkdir(vault, { recursive: true });
  await writeFile(path.join(profile, "workspace.json"), JSON.stringify({ root: vault }));
}
const inputFile = {name:"upgrade.docx", mimeType:"application/octet-stream", buffer:Buffer.from(zipSync({
  "word/document.xml":strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{amount}}</w:t></w:r></w:p><w:p><w:r><w:t>{{skip}}</w:t></w:r></w:p></w:body></w:document>'),
}))};
const app = await _electron.launch({
  executablePath: process.env.XDOCS_EXECUTABLE,
  args: process.env.XDOCS_EXECUTABLE ? [] : ["."],
  env: { ...process.env, XDOCS_TEST_DATA: profile },
});
try {
  const page = await app.firstWindow();
  const button = name => page.getByRole("button", { name, exact: true });
  await expect(page.locator(".workspace-switch strong")).toHaveText("vault", {timeout:30000});
  if (mode === "seed") {
    await button("새로 만들기").click();await button("xcode 세션 만들기").click();
    await button("파일 첨부").click();
    await button("Word·Excel 양식 채우기").click();
    const office=page.locator(".office-form");
    await office.getByLabel("원본 양식").setInputFiles(inputFile);
    await office.locator(".office-source-field").filter({hasText:"amount"}).getByPlaceholder("확인 필요").fill("725");
    await office.locator(".office-source-field").filter({hasText:"skip"}).getByPlaceholder("확인 필요").fill("제외할 값");
    await button("저장 전 미리보기").click();
    const preview=page.getByRole("region",{name:"작성본 미리보기"});
    await preview.getByLabel("amount 검토 사유").fill("업그레이드 확인 값");
    await preview.locator(".office-preview-fields > section").filter({hasText:"skip"}).getByLabel("반영",{exact:true}).uncheck();
    await app.evaluate(({BrowserWindow},dest)=>{
      BrowserWindow.getAllWindows()[0].webContents.session.once("will-download",(_e,item)=>item.setSavePath(dest));
    },path.join(root,"review.md"));
    await button("검토 기록 Markdown 저장").click();
    await expect.poll(()=>readFile(path.join(root,"review.md"),"utf8").catch(()=>"")).toContain("업그레이드 확인 값");
  } else {
    if(!await page.locator(".xcode").count()) await button("새 xcode 세션").first().click();
    await button("Office 검토 초안 열기").click();
    const preview=page.getByRole("region",{name:"작성본 미리보기"});
    await expect(preview.getByLabel("amount 검토 사유")).toHaveValue("업그레이드 확인 값");
    await expect(preview).toContainText("725");
    await expect(preview.locator(".office-preview-fields > section").filter({hasText:"skip"}).getByLabel("반영",{exact:true})).not.toBeChecked();
    await button("검토 이력").click();
    await page.getByLabel("검토 이력 검색").fill("업그레이드 확인 값");
    await expect(page.locator(".review-search-results")).toContainText("upgrade.docx");
    console.log("PASS Windows upgrade preserves the Office form values, selections, reasons and search history");
  }
} finally { await app.close(); }
