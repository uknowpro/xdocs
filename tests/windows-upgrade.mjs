import { folderBody, withParent } from "../shared/page-parent.mjs";
import { encodeWorkbook } from "../shared/tabular.mjs";
import { unzipSync } from "fflate";
import { _electron as electron, expect } from "@playwright/test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const [mode, executablePath, root, version, scale = "1"] =
  process.argv.slice(2);
const data = path.join(root, "profile"),
  vault = path.join(root, "workspace");
const manifest = path.join(root, "expected.json");
if (mode === "seed") {
  await mkdir(data, { recursive: true });
  await mkdir(vault, { recursive: true });
  await writeFile(
    path.join(data, "workspace.json"),
    JSON.stringify({ root: vault }),
  );
  await writeFile(path.join(root, "fixture.txt"), "업그레이드 첨부\n");
}
const app = await electron.launch({
  ...(executablePath === "." ? {} : { executablePath }),
  args: [...(executablePath === "." ? ["."] : []), "--force-device-scale-factor=" + scale],
  env: { ...process.env, XDOCS_TEST_DATA: data },
});
try {
  assert.equal(await app.evaluate(({ app }) => app.getVersion()), version);
  const page = await app.firstWindow();
  await expect(page.locator(".workspace-switch strong")).toHaveText(
    path.basename(vault),
    { timeout: 30000 },
  );
  assert.ok(
    Math.abs((await page.evaluate(() => devicePixelRatio)) - Number(scale)) <
      0.05,
  );
  const button = (name) => page.getByRole("button", { name, exact: true });
  async function terraformFiles() {
    const dest = path.join(root, mode + scale + ".zip");
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, dest);
    await button("코드 ZIP 내보내기").click();
    await expect(page.getByRole("status")).toContainText("내보냈습니다");
    const zip = unzipSync(await readFile(dest));
    const terraform = Object.fromEntries(
      Object.entries(zip)
        .filter(([name]) => name.startsWith("terraform/"))
        .map(([name, bytes]) => [name, Buffer.from(bytes).toString("base64")]),
    );
    assert.ok(Object.keys(terraform).length);
    return terraform;
  }
  if (mode === "seed") {
    await button("새 시트 테이블").click();
    await page.locator(".sheet-grid textarea").first().fill("분기 예산");
    await expect(page.locator(".save-state")).toContainText("로컬에 저장됨");
    await button("IaCD 아키텍처").click();
    await button("멀티클라우드 예제").click();
    await expect(page.getByLabel("아키텍처 제목")).toHaveValue(
      "멀티클라우드 · 웹 서비스",
    );
    await expect(page.locator(".save-state")).toContainText("로컬에 저장됨");
    await app.evaluate(
      ({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [file],
        });
      },
      path.join(root, "fixture.txt"),
    );
    // Store representative documents through the old desktop build's vault API.
    const make = (title,body) => page.evaluate(([title,body])=>window.xdocs.create(title,body),[title,body]);
    const team = await make("운영팀",folderBody("", "운영팀"));
    const project = await make("분기 검토",folderBody(team.id,"분기 검토"));
    const book = encodeWorkbook({version:1,sheets:[{id:"budget",name:"비용",firstRowHeader:true,rows:[["항목","금액"],["운영","420"]]}]});
    await make("예산표",withParent(project.id,"# 예산표\n\n"+book));
    for (const name of ["네트워크 검토","비용 검토"]) {
      const session = {endpoint:"http://localhost/v1",model:"upgrade-test",profile:"",
        harness:{name:"검토",stages:["검토"],skills:[]},
        turns:[{prompt:name+" 질문",files:[],answers:[{stage:"검토",text:name+" 답변"}]}]};
      await make(name,withParent(project.id,"# "+name+"\n\n" + "```xdocs-xcode\n"+JSON.stringify(session)+"\n```"));
    }
    const expected = await page.evaluate(async () => {
      const api = window.xdocs,
        attachment = await api.addAttachment();
      const n = await api.create("업그레이드 기록", "# 업그레이드 기록");
      await api.save({
        ...n,
        body: n.body + "\n\n[" + attachment.name + "](" + attachment.path + ")",
      });
      const ws = await api.refresh();
      return {
        attachment: attachment.path,
        notes: await Promise.all(
          ws.notes.map(async ({ id }) => {
            const { path, body, revision } = await api.readNote(id);
            return { id, path, body, revision };
          }),
        ),
      };
    });
    await button("코드 추출").click();
    expected.terraform = await terraformFiles();
    await button("왼쪽 메뉴 접기").click();
    await expect(button("왼쪽 메뉴 펼치기")).toBeVisible();
    await writeFile(manifest, JSON.stringify(expected));
  } else {
    const expected = JSON.parse(await readFile(manifest, "utf8"));
    assert.equal(expected.notes.length, 8);
    await expect(button("왼쪽 메뉴 펼치기")).toBeVisible();
    assert.equal(
      await readFile(path.join(vault, expected.attachment), "utf8"),
      "업그레이드 첨부\n",
    );
    for (const note of expected.notes) {
      const actual = await page.evaluate(
        (id) => window.xdocs.readNote(id),
        note.id,
      );
      for (const key of ["id", "path", "body", "revision"])
        assert.equal(actual[key], note[key]);
    }
    await button("왼쪽 메뉴 펼치기").click();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(780, 600),
    );
    const tree = page.getByRole("navigation", { name: "보관함 페이지" });
    for (const [folder,child] of [["운영팀","분기 검토"],["분기 검토","예산표"]]) {
      if (!await tree.getByRole("button",{name:child,exact:true}).isVisible())
        await tree.getByRole("button",{name:folder,exact:true}).click();
    }
    await tree.getByRole("button",{name:"예산표",exact:true}).click();
    await expect(page.getByLabel("첫 행을 헤더로 사용")).toBeChecked();
    await expect(page.locator("thead textarea").first()).toHaveValue("항목");
    await expect(page.getByLabel("비용 B2",{exact:true})).toHaveValue("420");
    for (const name of ["네트워크 검토","비용 검토"]) {
      await tree.getByRole("button",{name,exact:true}).click();
      await expect(page.locator(".chat-question")).toHaveText(name+" 질문");
      await expect(page.locator(".chat-answer")).toHaveText(name+" 답변");
    }
    await tree.getByRole("button", { name: "새 시트", exact: true }).click();
    await expect(page.locator(".sheet-grid textarea").first()).toHaveValue(
      "분기 예산",
    );
    await tree
      .getByRole("button", { name: "멀티클라우드 · 웹 서비스", exact: true })
      .click();
    const search = page.getByRole("combobox", { name: "리소스 찾기" });
    await search.fill("Application EC2");
    await search.press("Enter");
    await expect(
      page.getByRole("textbox", { name: "컴포넌트 표시 이름" }),
    ).toHaveValue("Application EC2");
    await button("속성 닫기").click();
    await button("코드 추출").click();
    assert.deepEqual(await terraformFiles(), expected.terraform);
    await button("IaC 변경 비교").click();
    await expect(page.getByText("생성된 IaC에 변경이 없습니다.")).toBeVisible();
    assert.ok(
      await page
        .locator("main")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    );
    await button("왼쪽 메뉴 접기").click();
    await expect(button("왼쪽 메뉴 펼치기")).toBeVisible();
    console.log(
      "Preserved vault and canvas layout at device pixel ratio",
      await page.evaluate(() => devicePixelRatio),
    );
  }
} finally {
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => app.quit());
  await closed;
}
