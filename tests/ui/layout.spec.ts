import { expect, test, type Page } from "@playwright/test";

async function fitsWidth(page: Page, selector: string) {
  const overflowing = await page
    .locator(selector)
    .evaluateAll((elements) =>
      elements
        .filter((e) => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1)
        .map((e) => e.className),
    );
  expect(overflowing).toEqual([]);
}

test("laptop sidebar stays reachable, remembers its width state and gives the tree one scroll area", async ({
  page,
}) => {
  await page.setViewportSize({ width: 780, height: 600 });
  await page.goto("/");
  const menu = page.locator(".sidebar-switch");
  const main = page.locator("main");
  const tree = page.locator(".page-tree");
  await expect(
    tree.getByRole("button", { name: "주간 아이디어", exact: true }),
  ).toBeVisible();
  expect(await tree.evaluate((e) => e.clientHeight)).toBeGreaterThan(100);
  expect(
    await tree.evaluate((e) => e.scrollHeight - e.clientHeight),
  ).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page.getByRole("button", { name: "새 시트 테이블" }).click();
  expect(
    await page.locator(".sheet-scroll").evaluate((e) => e.clientHeight),
  ).toBeGreaterThan(300);
  await main.evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  await expect(page.locator(".titlebar button")).toHaveCount(0);
  await expect(
    page.locator(".sidebar-heading .sidebar-switch"),
  ).toBeInViewport();
  await page.locator(".sidebar").evaluate((e) => {
    e.scrollTop = e.scrollHeight;
  });
  await expect(menu).toBeInViewport();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".sidebar-rail .sidebar-switch")).toBeFocused();
  expect(await main.evaluate((e) => e.clientWidth)).toBe(740);
  await page.reload();
  await expect(menu).toHaveAccessibleName("왼쪽 메뉴 펼치기");
  await menu.click();
  await expect(tree).toBeVisible();
});

test("narrow screens can navigate, read code and reach dialog controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto("/");
  const open = page.getByRole("button", { name: "왼쪽 메뉴 펼치기" });
  await open.click();
  await page.getByRole("button", { name: "환경 설정" }).click();
  await fitsWidth(page, ".dialog");
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await open.click();
  await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
  await page
    .getByRole("button", { name: "xinfra 캔버스", exact: true })
    .click();
  await fitsWidth(page, ".dialog");
  await page.getByRole("button", { name: "멀티클라우드 예제" }).click();
  await expect(page.locator(".network-sheet")).toBeVisible();
  for (const name of ["AWS 드로잉", "코드 추출", "WAF 검토", "설계"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await fitsWidth(
      page,
      ".main, .arch-toolbar, .arch-editor, .arch-export, .arch-review",
    );
  }
  await open.click();
  await page.keyboard.press("Escape");
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".network-sheet")).toBeVisible();
});

for (const width of [390, 780, 1440]) {
  test(`captions and action groups remain separated at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const menu = page.getByRole("button", { name: "왼쪽 메뉴 펼치기" });
    async function openFromMenu(name: string) {
      if (await menu.isVisible()) await menu.click();
      await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
      await page.getByRole("button", { name, exact: true }).click();
    }
    async function gapAbove(selector: string) {
      return page.locator(selector).first().evaluate((e) =>
        e.getBoundingClientRect().top - e.previousElementSibling!.getBoundingClientRect().bottom,
      );
    }
    for (const [entry, section, actions] of [
      ["xinfra 캔버스", ".architecture-start", ".arch-start-options"],
      ["인프라 문서", ".infrastructure-start", ".infra-actions"],
    ]) {
      await openFromMenu(entry);
      expect(await gapAbove(section + " > " + actions)).toBeGreaterThanOrEqual(12);
      expect(await page.locator(section).evaluate(e => parseFloat(getComputedStyle(e).paddingLeft))).toBeGreaterThanOrEqual(16);
      await fitsWidth(page, section);
      if (section === ".architecture-start") {
        const input = page.getByLabel("템플릿 검색");
        const caption = page.locator(".catalog-field > span").filter({ hasText: "템플릿 검색" });
        const filter = page.getByRole("button", { name: "전체", exact: true });
        const [field, label, firstButton] = await Promise.all([
          input.boundingBox(), caption.boundingBox(), filter.boundingBox(),
        ]);
        expect(field!.y - label!.y - label!.height).toBeCloseTo(8, 0);
        expect(firstButton!.y - field!.y - field!.height).toBeCloseTo(16, 0);
      }
      await page.locator(section + " header button").click();
    }
    await openFromMenu("새 시트 테이블");
    expect(await gapAbove(".sheet-toolbar + .sheet-grid-settings")).toBeGreaterThanOrEqual(8);
    await openFromMenu("Harness 만들기");
    const actions = page.locator(".stage-actions").first();
    await expect(actions).toBeVisible();
    await fitsWidth(page, ".stage-actions");
    const boxes = await actions.locator("button").evaluateAll(items =>
      items.map(e => { const r = e.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom }; }),
    );
    for (let i = 1; i < boxes.length; i++) {
      const a = boxes[i - 1], b = boxes[i];
      expect(Math.max(b.left - a.right, b.top - a.bottom)).toBeGreaterThanOrEqual(5.9);
    }
  });
}

test("compact navigation leaves ten complete rows visible on a 1366px laptop", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => {
    const notes = Array.from({ length: 35 }, (_, index) => ({
      id: String(index), title: "페이지 " + index, path: index + ".md",
      body: "# 페이지 " + index, revision: "1",
    }));
    localStorage.setItem("xdocs.preview.v1", JSON.stringify({name:"워크스페이스", root:"미리보기", notes}));
  });
  await page.goto("/");
  const tree = page.getByRole("navigation", {name:"보관함 페이지"});
  await expect(tree.locator(".page-row")).toHaveCount(35);
  const visible = await tree.evaluate(list => {
    const bounds = list.getBoundingClientRect();
    return [...list.querySelectorAll(".page-row")].filter(row => {
      const box = row.getBoundingClientRect();
      return box.top >= bounds.top && box.bottom <= bounds.bottom;
    }).length;
  });
  expect(visible).toBeGreaterThanOrEqual(10);
  console.log("1366x768 fully visible page rows:", visible);
  await tree.evaluate(list => { list.scrollTop = list.scrollHeight; });
  const create = page.getByRole("button", {name:"새로 만들기", exact:true});
  await expect(create).toBeInViewport();
  await expect(page.getByRole("button", {name:"환경 설정"})).toBeInViewport();
  await create.click();
  await expect(page.getByRole("button", {name:"xinfra 캔버스"})).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(create).toBeFocused();
  await page.getByRole("button", {name:"워크스페이스 전환"}).click();
  await expect(page.getByRole("button", {name:"조직 보관함 SSO"})).toBeInViewport();
});

test("tree keyboard navigation focuses rows, opens actions and renames pages",async ({page})=>{
  await page.goto("/");
  const tree=page.getByRole("navigation",{name:"보관함 페이지"});
  const entries=tree.locator("[data-entry-key]");
  await entries.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(entries.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(entries.first()).toBeFocused();
  const target=entries.filter({hasText:"주간 아이디어"});
  await target.focus();
  await page.keyboard.press("Shift+F10");
  await expect(tree.getByRole("group",{name:"주간 아이디어 작업"})).toBeVisible();
  await page.keyboard.press("Escape");
  await target.focus();
  await page.keyboard.press("F2");
  await expect(page.getByRole("textbox",{name:"페이지 이름 변경"})).toHaveValue("주간 아이디어");
});

test("create a folder inline with Enter or cancel with Escape on desktop and mobile", async ({page}) => {
  for (const width of [1366, 390]) {
    await page.setViewportSize({width, height:800});
    await page.goto("/");
    if (width === 390) await page.getByRole("button",{name:"왼쪽 메뉴 펼치기"}).click();
    const add = page.getByRole("button",{name:"개인 보관함 새 폴더"});
    await add.click();
    const input = page.getByRole("textbox",{name:"폴더 이름",exact:true});
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("placeholder","폴더 이름 입력");
    await expect(page.locator(".folder-name-form")).not.toContainText("폴더 이름");
    await expect(page.getByRole("button",{name:"만들기",exact:true})).toBeDisabled();
    await input.fill("취소할 폴더");
    await input.press("Escape");
    await expect(input).toHaveCount(0);
    await add.click();
    await input.fill("프로젝트 " + width);
    await input.press("Enter");
    await expect(page.getByRole("button",{name:"프로젝트 "+width,exact:true})).toBeVisible();
  }
});

test("canvas title and design modes share a row and tool pages omit the text footer", async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/");
  await expect(page.locator(".document-end")).toContainText("자");
  await expect(page.locator(".document-end")).not.toContainText("—");
  const button=(name:string)=>page.getByRole("button",{name,exact:true});
  await button("새로 만들기").click();
  await button("xinfra 캔버스").click();
  await button("멀티클라우드 예제").click();
  const title=await page.getByLabel("아키텍처 제목").boundingBox();
  const mode=await button("설계").boundingBox();
  expect(Math.abs(title!.y+title!.height/2-mode!.y-mode!.height/2)).toBeLessThan(6);
  await expect(page.locator(".document-end")).toHaveCount(0);
  expect(await page.locator(".view-tabs .note-utilities").count()).toBe(1);
});
