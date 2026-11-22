import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

const children = (el: Document | Element, name: string) =>
  Array.from(el.getElementsByTagNameNS("*", name));
const marker = /\{\{\s*([\p{L}_][\p{L}\d_]*)\s*\}\}/gu;
type Scalar = string | number | boolean;
export type OfficeTemplate = Awaited<ReturnType<typeof inspectForm>>;
export const templateFiles = new WeakMap<object, File>();
export function formInstruction(form: OfficeTemplate) {
  const schema = form.advanced ? form.excerpt : JSON.stringify(form.fields.map(({id,label})=>({id,label})));
  return form.name + " 양식을 첨부 근거로 채우세요. 최종 답변은 JSON 객체로 반환하세요. values는 필드별 값, sources는 필드마다 파일명#시트!셀 또는 파일명#문단 번호 형식의 문자열이나 배열, conflicts는 상충하는 필드별 근거 설명입니다. 누락·충돌 값은 생략하세요. 반복 행은 배열로 반환하세요. 양식 필드: " + schema;
}
export type FormField = { id: string; label: string; original:string };
export async function inspectForm(file: File) {
  if (file.size > 8 * 1024 * 1024) throw Error("8MB 이하 양식을 선택하세요.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let expanded = 0;
  const parts = unzipSync(bytes, {
    filter(entry) {
      expanded += entry.originalSize;
      if (expanded > 32 * 1024 * 1024)
        throw Error("양식의 압축 해제 한도를 초과합니다.");
      return true;
    },
  });
  function xml(path: string) {
    if (!parts[path]) throw Error("양식 구성 파일을 찾을 수 없습니다.");
    const doc = new DOMParser().parseFromString(
      strFromU8(parts[path]),
      "application/xml",
    );
    if (children(doc, "parsererror").length)
      throw Error("양식 XML을 읽지 못했습니다.");
    return doc;
  }
  const word = /\.docx$/i.test(file.name);
  const fields = new Map<string, FormField>(),
    descriptions: string[] = [];
  let advanced = false;
  function process(values: Record<string, Scalar>, write: boolean) {
    const output = { ...parts };
    function save(path: string, doc: Document) {
      if (write)
        output[path] = strToU8(new XMLSerializer().serializeToString(doc));
    }
    function field(id: string,label:string,original="") {
      if(!write) fields.set(id,{id,label,original});
      if (fields.size > 1500)
        throw Error("양식 입력란은 1,500개까지 지원합니다.");
      return Object.hasOwn(values, id) && values[id] !== ""
        ? values[id]
        : undefined;
    }
    if (word) {
      for (const path of Object.keys(parts).filter((p) =>
        /^word\/(document|header\d+|footer\d+)\.xml$/.test(p),
      )) {
        const doc = xml(path);
        for (const [i, control] of children(doc, "sdt").entries()) {
          const pr = children(control, "sdtPr")[0];
          const content = children(control, "sdtContent")[0];
          if (!pr || !content || !children(pr, "text").length || children(pr, "lock").length || children(pr, "dataBinding").length) continue;
          const labelNode = children(pr, "alias")[0] || children(pr, "tag")[0];
          const label = labelNode?.getAttributeNS(pr.namespaceURI, "val") || "텍스트 입력란 " + (i+1);
          const runs = children(content, "t");
          const value = field(path+"#control"+i,label,runs.map(run=>run.textContent || "").join(""));
          if (write && value !== undefined && runs.length) {
            runs.forEach((run, index) => { run.textContent = index ? "" : String(value); });
            children(pr, "showingPlcHdr")[0]?.remove();
          }
        }
        for (const [paragraphIndex, p] of children(doc, "p").entries()) {
          const nodes = children(p, "t").filter(
            (n) =>
              !n.closest("sdt, w\\:sdt") && (n.closest("p, w\\:p") === p || n.parentElement?.parentElement === p),
          );
          const original = nodes.map((n) => n.textContent || "");
          const text = original.join("");
          if (!write && text.trim()) descriptions.push(text);
          if (/{[%#]|{{/.test(text.replace(marker, ""))) advanced = true;
          const spans = [...text.matchAll(marker), ...text.matchAll(/_{3,}/g)].sort((a,b) => b.index! - a.index!);
          for (const match of spans) {
            const id = match[1] || path+"#blank"+paragraphIndex+"-"+match.index;
            const val = field(id, match[1] || text.slice(Math.max(0,match.index!-48), match.index).trim() || "밑줄 입력 후보",match[0]);
            if (!write || val === undefined) continue;
            let offset = 0;
            original.forEach((s, i) => {
              const left = match.index! - offset,
                right = left + match[0].length;
              if (right > 0 && left < s.length) {
                const node = nodes[i],
                  current = node.textContent || "";
                node.textContent =
                  current.slice(0, Math.max(0, left)) +
                  (left >= 0 ? String(val) : "") +
                  current.slice(Math.max(0, right));
                node.setAttributeNS(
                  "http://www.w3.org/XML/1998/namespace",
                  "xml:space",
                  "preserve",
                );
              }
              offset += s.length;
            });
          }
        }
        for (const [i, cell] of children(doc, "tc").entries()) {
          if (
            children(cell, "t").some((n) => n.textContent?.trim()) ||
            children(cell, "tbl").length ||
            children(cell, "drawing").length ||
            children(cell, "vMerge").length
          )
            continue;
          const p = children(cell, "p")[0],
            label = cell.previousElementSibling?.textContent?.trim();
          if (!p || !label) continue;
          const id = path + "#cell" + i,
            val = field(id, label.slice(0, 80));
          if (write && val !== undefined) {
            const r = doc.createElementNS(p.namespaceURI, "w:r"),
              t = doc.createElementNS(p.namespaceURI, "w:t");
            t.textContent = String(val);
            r.append(t);
            p.append(r);
          }
        }
        save(path, doc);
      }
    } else {
      const book = xml("xl/workbook.xml"),
        rels = children(xml("xl/_rels/workbook.xml.rels"), "Relationship");
      const strings = parts["xl/sharedStrings.xml"]
        ? children(xml("xl/sharedStrings.xml"), "si").map(
            (s) => s.textContent || "",
          )
        : [];
      for (const sheet of children(book, "sheet")) {
        if (
          sheet.getAttribute("state") &&
          sheet.getAttribute("state") !== "visible"
        )
          continue;
        const rel = rels.find(
          (r) =>
            r.getAttribute("Id") ===
            sheet.getAttributeNS(
              "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
              "id",
            ),
        );
        const path = new URL(
          rel?.getAttribute("Target") || "",
          "https://local/xl/workbook.xml",
        ).pathname.slice(1);
        if (!/^xl\/worksheets\/[^/]+\.xml$/.test(path)) continue;
        const doc = xml(path);
        if (children(doc, "sheetProtection").length) continue;
        const merged = children(doc, "mergeCell").map((n) =>
          (n.getAttribute("ref") || "").split(":"),
        );
        const column = (s: string) => s.replace(/\d/g, "");
        const colNum = (s: string) =>
          [...column(s)].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
        const rowNum = (s: string) => Number(s.replace(/[A-Z]/g, ""));
        for (const row of children(doc, "row")) {
          let previous = "";
          for (const c of children(row, "c")) {
            const addr = c.getAttribute("r") || "",
              raw = children(c, "v")[0]?.textContent || "",
              type = c.getAttribute("t");
            const text =
              type === "s"
                ? strings[Number(raw)] || ""
                : type === "inlineStr"
                  ? c.textContent || ""
                  : raw;
            if (children(c, "f").length) continue;
            const placeholder = [...text.matchAll(marker)][0];
            if (text.trim() && placeholder?.[0] !== text) {
              previous = text;
              continue;
            }
            if (
              !addr ||
              merged.some(
                ([a, b]) =>
                  b &&
                  a !== addr &&
                  colNum(addr) >= colNum(a) &&
                  colNum(addr) <= colNum(b) &&
                  rowNum(addr) >= rowNum(a) &&
                  rowNum(addr) <= rowNum(b),
              )
            )
              continue;
            const id = sheet.getAttribute("name") + "!" + addr;
            const val = field(id, placeholder?.[1] || previous || id,text);
            if (!write || val === undefined) continue;
            c.replaceChildren();
            if (typeof val === "number" || typeof val === "boolean") {
              c.setAttribute("t", typeof val === "boolean" ? "b" : "n");
              const v = doc.createElementNS(c.namespaceURI, "v");
              v.textContent =
                typeof val === "boolean" ? String(+val) : String(val);
              c.append(v);
            } else {
              c.setAttribute("t", "inlineStr");
              const item = doc.createElementNS(c.namespaceURI, "is"),
                t = doc.createElementNS(c.namespaceURI, "t");
              t.textContent = val;
              item.append(t);
              c.append(item);
            }
          }
        }
        save(path, doc);
      }
      if (write) {
        let calc = children(book, "calcPr")[0];
        if (!calc) {
          calc = book.createElementNS(
            book.documentElement.namespaceURI,
            "calcPr",
          );
          book.documentElement.append(calc);
        }
        calc.setAttribute("fullCalcOnLoad", "1");
        save("xl/workbook.xml", book);
      }
    }
    return output;
  }
  process({}, false);
  if (!advanced && !fields.size)
    throw Error(
      "입력란을 찾지 못했습니다. Word에는 {{ 필드명 }} 또는 항목명 옆의 빈 표 셀을, Excel에는 자리표시자나 서식 있는 빈 셀을 사용하세요.",
    );
  return {
    name: file.name,
    bytes,
    advanced,
    identity: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join(""),
    fields: [...fields.values()],
    excerpt: descriptions.join("\n").slice(0, 30000),
    render: (values: Record<string, Scalar>) => zipSync(process(values, true)),
  };
}
