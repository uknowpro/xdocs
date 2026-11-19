import { test, expect } from "@playwright/test";

for (const width of [390, 1366])
  test(
    "note scroll reaches the end in each editor at " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 768 });
      await page.addInitScript(() => {
        const notes = ["긴 문서", "다른 긴 문서", "짧은 문서"].map(
          (title, i) => ({
            id: String(i),
            title,
            path: title + ".md",
            revision: "1",
            body:
              "# " +
              title +
              "\n\n" +
              (i < 2 ? "검토할 문단\n\n".repeat(120) : "") +
              "마지막 문단",
          }),
        );
        localStorage.setItem(
          "xdocs.preview.v1",
          JSON.stringify({ name: "워크스페이스", root: "미리보기", notes }),
        );
      });
      await page.goto("/");
      const main = page.locator("main");
      async function openNote(name: string) {
        const drawer = page.getByRole("button", { name: "왼쪽 메뉴 펼치기" });
        if (await drawer.isVisible()) await drawer.click();
        await page
          .getByRole("navigation", { name: "보관함 페이지" })
          .getByRole("button", { name, exact: true })
          .click();
        await expect(page.locator(".markdown h1")).toHaveText(name);
      }
      async function end() {
        await main.evaluate((el) => el.scrollTo(0, el.scrollHeight));
        await expect(page.locator(".document-end")).toBeInViewport();
        expect(
          await main.evaluate((el) => el.scrollWidth - el.clientWidth),
        ).toBeLessThanOrEqual(1);
      }
      await openNote("긴 문서");
      await page.locator(".markdown h1").hover();
      await page.mouse.wheel(0, 640);
      await expect
        .poll(() => main.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(0);
      await end();
      expect(await main.evaluate((el) => el.scrollTop)).toBeGreaterThan(500);
      await openNote("다른 긴 문서");
      await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBe(0);
      await page.getByRole("button", { name: "편집하기", exact: true }).click();
      await page
        .getByRole("button", { name: "블록 편집", exact: true })
        .click();
      await expect(page.locator(".tiptap")).toContainText("마지막 문단");
      await end();
      await page
        .getByRole("button", { name: "Markdown 원문", exact: true })
        .click();
      const editor = page.getByRole("textbox", { name: "노트 본문" });
      await expect(editor).toHaveValue(/마지막 문단/);
      expect(
        await editor.evaluate((el) => el.scrollHeight - el.clientHeight),
      ).toBeLessThanOrEqual(2);
      await end();
      await page
        .getByRole("button", { name: "읽기 모드", exact: true })
        .click();
      await openNote("짧은 문서");
      await expect(page.locator(".markdown h1")).toBeInViewport();
      await expect(page.locator(".document-end")).toBeInViewport();
    },
  );

for (const width of [390, 1366])
  test(
    "outline follows rendered headings and restores a revisited note at " +
      width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 768 });
      await page.addInitScript(() => {
        const notes = ["목차 문서", "둘째 문서"].map((title, i) => ({
          id: String(i),
          path: title + ".md",
          revision: "1",
          title,
          body:
            "# " +
            title +
            "\n\n## 시작\n\n" +
            "내용\n\n".repeat(90) +
            "\n## 결론\n\n" +
            "나머지\n\n".repeat(60),
        }));
        localStorage.setItem(
          "xdocs.preview.v1",
          JSON.stringify({ name: "워크스페이스", root: "미리보기", notes }),
        );
      });
      await page.goto("/");
      async function open(title: string) {
        const drawer = page.getByRole("button", { name: "왼쪽 메뉴 펼치기" });
        if (await drawer.isVisible()) await drawer.click();
        await page
          .getByRole("navigation", { name: "보관함 페이지" })
          .getByRole("button", { name: title, exact: true })
          .click();
        await expect(page.locator(".markdown h1")).toHaveText(title);
      }
      await open("목차 문서");
      if (width === 390) await page.locator(".compact-outline summary").click();
      const toc = page.getByRole("navigation", { name: "노트 목차" });
      await toc.getByRole("button", { name: "결론" }).click();
      const main = page.locator("main");
      await expect
        .poll(() => main.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(1000);
      const scroll = await main.evaluate((el) => el.scrollTop);
      await open("둘째 문서");
      await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBe(0);
      await open("목차 문서");
      await expect
        .poll(() => main.evaluate((el) => el.scrollTop), {
          message: "읽던 위치 복원",
        })
        .toBeCloseTo(scroll, -1);
      if (width === 390) await page.locator(".compact-outline summary").click();
      await expect(toc.getByRole("button", { name: "결론" })).toHaveAttribute(
        "aria-current",
        "location",
      );
    },
  );
