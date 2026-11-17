import { test, expect } from "@playwright/test";
test("themes persist, notes save, search and graph navigate", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".markdown h1")).toHaveText("생각이 연결되는 공간");
  await page.getByRole("button", { name: "환경 설정" }).click();
  await page.getByRole("button", { name: "다크", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "설정 닫기" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "새 노트", exact: true }).click();
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .fill("# 테스트 노트\n\n한글 저장 확인 [[UI 디자인 원칙]]");
  await expect(page.locator(".save-state")).toContainText("브라우저에 저장됨");
  await page.reload();
  await page.getByRole("button", { name: "빠른 검색" }).click();
  await page.getByRole("textbox", { name: "빠른 검색" }).fill("한글 저장 확인");
  await page.locator(".search-results button").click();
  await expect(page.locator(".markdown h1")).toHaveText("테스트 노트");
  await page.getByRole("button", { name: "지식 그래프" }).click();
  await page
    .locator(".graph:not(.compact)")
    .getByRole("button", { name: "UI 디자인 원칙", exact: true })
    .click();
  await page.getByRole("button", { name: "노트 열기" }).click();
  await expect(page.locator(".markdown h1")).toHaveText("UI 디자인 원칙");
});
test("untrusted Markdown cannot execute scripts or navigate away", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "편집하기" }).click();
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .fill(
      '# 보안 확인\n\n<img src=x onerror="window.pwned=true"><script>window.pwned=true</script>\n\n[실행](javascript:alert(1))',
    );
  await page.getByRole("button", { name: "읽기 모드" }).click();
  await expect(page.locator(".markdown script,.markdown img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).pwned)).toBeUndefined();
});
test("desktop sized light, gray and dark screens have no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  for (const [label, value] of [
    ["화이트", "light"],
    ["그레이", "gray"],
    ["다크", "dark"],
  ]) {
    await page.getByRole("button", { name: "환경 설정" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: label, exact: true })
      .click();
    await page.getByRole("button", { name: "설정 닫기" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", value);
    await page.screenshot({
      path: `test-results/${value}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("block editor preserves linked text and supports formatting and block movement", async ({
  page,
}) => {
  page.on("pageerror", (error) => console.error(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") console.error(message.text());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "편집하기", exact: true }).click();
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .fill(
      "# 블록 테스트\n\n첫 번째 문단\n\n두 번째 문단\n\n[[UI 디자인 원칙]]",
    );
  await page.getByRole("button", { name: "블록 편집", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "블록 편집기" });
  await expect(editor).toContainText("첫 번째 문단");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" 추가 텍스트");
  await page.getByRole("button", { name: "블록 정렬", exact: true }).click();
  await page
    .getByRole("button", { name: "2번 블록 아래로", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Markdown 원문", exact: true })
    .click();
  const raw = await page
    .getByRole("textbox", { name: "노트 본문" })
    .inputValue();
  expect(raw).toContain("[[UI 디자인 원칙]]");
  expect(raw.indexOf("두 번째 문단")).toBeLessThan(raw.indexOf("첫 번째 문단"));
  expect(raw).toContain("추가 텍스트");
});

test("sheet tabs persist, multiline TSV pastes and rectangle copies with tabs", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "새 시트 테이블", exact: true })
    .click();
  const a1 = page.getByRole("textbox", { name: "시트 1 A1", exact: true });
  await a1.click();
  await a1.evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", '이름\t값\r\n한글\t"여러\n줄"');
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(a1).toHaveValue("이름");
  await expect(
    page.getByRole("textbox", { name: "시트 1 B2", exact: true }),
  ).toHaveValue("여러\n줄");
  await page
    .getByRole("textbox", { name: "시트 1 B2", exact: true })
    .click({ modifiers: ["Shift"] });
  const copied = await a1.evaluate((el) => {
    const data = new DataTransfer();
    el.dispatchEvent(
      new ClipboardEvent("copy", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
    return data.getData("text/plain");
  });
  expect(copied).toBe('이름\t값\r\n한글\t"여러\n줄"');
  await page.getByRole("button", { name: "시트 추가", exact: true }).click();
  await page
    .getByRole("textbox", { name: "시트 2 A1", exact: true })
    .fill("다른 시트");
  await expect(page.locator(".save-state")).toContainText("브라우저에 저장됨");
  await page.reload();
  await page.getByRole("button", { name: "새 시트", exact: true }).click();
  await page.getByRole("tab", { name: "시트 2", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "시트 2 A1", exact: true }),
  ).toHaveValue("다른 시트");
});

test("Markdown table selection copies tab-separated cells", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새 노트", exact: true }).click();
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .fill("# 표 복사\n\n| 이름 | 값 |\n| --- | --- |\n| 한글 | 12 |");
  await page.getByRole("button", { name: "읽기 모드", exact: true }).click();
  const copied = await page.locator(".markdown table").evaluate((table) => {
    const range = document.createRange();
    range.selectNodeContents(table);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const data = new DataTransfer();
    table.dispatchEvent(
      new ClipboardEvent("copy", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
    return data.getData("text/plain");
  });
  expect(copied).toBe("이름\t값\r\n한글\t12");
});
