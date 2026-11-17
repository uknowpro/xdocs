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

test("delayed filesystem refresh does not replace a newer draft", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const note = {
      id: "file-note",
      title: "원본",
      body: "# 원본\n\n첫 내용",
      revision: "v1",
      path: "note.md",
    };
    const workspace = { root: "test", name: "test", notes: [note] };
    (window as any).__reads = 0;
    (window as any).xdocs = {
      load: async () => workspace,
      onChanged: (callback: any) => {
        (window as any).__change = callback;
        return () => {};
      },
      readNote: async () => {
        (window as any).__reads++;
        return new Promise((resolve) => {
          (window as any).__resolveRead = () =>
            resolve({ ...note, body: "# 외부 내용", revision: "v2" });
        });
      },
      save: async (input: any) => {
        (window as any).__saved = input.body;
        return { ...note, ...input, revision: "v3" };
      },
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "편집하기", exact: true }).click();
  await page.evaluate(() => {
    (window as any).__change({
      root: "test",
      name: "test",
      notes: [
        {
          id: "file-note",
          title: "원본",
          body: "preview",
          revision: "v1",
          path: "note.md",
          unloaded: true,
        },
      ],
    });
  });
  expect(await page.evaluate(() => (window as any).__reads)).toBe(0);
  await page.evaluate(() => {
    (window as any).__change({
      root: "test",
      name: "test",
      notes: [
        {
          id: "file-note",
          title: "원본",
          body: "preview",
          revision: "v2",
          path: "note.md",
          unloaded: true,
        },
      ],
    });
  });
  await page.waitForFunction(
    () => typeof (window as any).__resolveRead === "function",
  );
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .fill("# 내가 쓰는 새 내용");
  await page.evaluate(() => (window as any).__resolveRead());
  await expect(page.getByRole("textbox", { name: "노트 본문" })).toHaveValue(
    "# 내가 쓰는 새 내용",
  );
  await page.waitForFunction(
    () => (window as any).__saved === "# 내가 쓰는 새 내용",
  );
});

test("infrastructure example saves operating notes and renders all themes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "인프라 문서", exact: true }).click();
  await page.getByRole("button", { name: "예제로 살펴보기" }).click();
  await page.getByRole("button", { name: "인프라 노트 생성" }).click();
  await page
    .getByRole("textbox", { name: "리소스 운영 메모" })
    .fill("브라우저 저장 확인");
  await expect(page.locator(".save-state")).toContainText("브라우저에 저장됨");
  await page.reload();
  await page
    .getByRole("button", { name: "인프라 · 예제 compose.yaml", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "리소스 운영 메모" }),
  ).toHaveValue("브라우저 저장 확인");
  for (const theme of ["light", "gray", "dark"]) {
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    await expect(
      page.getByRole("heading", { name: "Docker Compose", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("tab", { name: "관계", exact: true }).click();
  await expect(page.getByLabel("리소스 관계 그래프")).toBeVisible();
});

test("creating a note suspends the old editor until the new note is ready", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const old = {
      id: "old",
      title: "기존 노트",
      body: "# 기존 노트",
      revision: "v1",
      path: "old.md",
    };
    const w = { root: "test", name: "test", notes: [old] };
    (window as any).xdocs = {
      load: async () => w,
      create: () =>
        new Promise((resolve) => {
          (window as any).__finishCreate = () =>
            resolve({
              id: "new",
              title: "새 노트",
              body: "# 새 노트\n\n",
              revision: "v1",
              path: "new.md",
            });
        }),
      save: async (n: any) => {
        (window as any).__savedNew = n;
        return { ...n, title: "새 노트", path: "new.md", revision: "v2" };
      },
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "편집하기", exact: true }).click();
  await page.getByRole("button", { name: "새 노트", exact: true }).click();
  await page.waitForFunction(
    () => typeof (window as any).__finishCreate === "function",
  );
  await expect(page.getByRole("textbox", { name: "노트 본문" })).toHaveCount(0);
  await page.evaluate(() => (window as any).__finishCreate());
  await page
    .getByRole("textbox", { name: "노트 본문" })
    .fill("# 새 노트 입력 보존");
  await page.waitForFunction(
    () => (window as any).__savedNew?.body === "# 새 노트 입력 보존",
  );
  expect(await page.evaluate(() => (window as any).__savedNew.id)).toBe("new");
});
