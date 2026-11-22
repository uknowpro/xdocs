type SourceValue =
  | { kind: "date"; value: string }
  | { kind: "number"; value: number; unit: string };

function isoDate(year: number, month: number, day: number) {
  if (year < 1000 || year > 9999) return;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return;
  return [year, month, day].map((n) => String(n).padStart(2, "0")).join("-");
}

const units: Record<string, string> = {
  "₩": "KRW",
  원: "KRW",
  $: "$",
  "€": "EUR",
  "£": "GBP",
  KRW: "KRW",
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
};
function readValue(input: unknown): SourceValue | undefined {
  if (typeof input !== "string" && typeof input !== "number") return;
  const value = String(input).normalize("NFKC").trim();
  const date =
    /^(\d{4})\s*(?:[-/.]|년)\s*(\d{1,2})\s*(?:[-/.]|월)\s*(\d{1,2})(?:\s*일|\.)?$/.exec(
      value,
    );
  if (date) {
    const normalized = isoDate(
      Number(date[1]),
      Number(date[2]),
      Number(date[3]),
    );
    if (normalized) return { kind: "date", value: normalized };
    return;
  }
  const amount =
    /^(?:(₩|\$|€|£|KRW|USD|EUR|GBP)\s*)?([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*([%₩$€£]|[\p{L}]{1,12})?$/u.exec(
      value,
    );
  if (!amount || (amount[1] && amount[3])) return;
  const number = Number(amount[2].replaceAll(",", ""));
  if (!Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER)
    return;
  const unit = amount[1] || amount[3] || "";
  return {
    kind: "number",
    value: number,
    unit: units[unit.toUpperCase()] || unit,
  };
}
export function compareOfficeValue(proposed: unknown, source: string) {
  if (proposed === null || proposed === undefined || proposed === "") return;
  const a = readValue(proposed),
    b = readValue(source);
  if (!a && !b) return;
  if (!a || !b || a.kind !== b.kind) return "값 또는 날짜 형식 확인";
  if (a.kind === "date" && b.kind === "date")
    return a.value === b.value ? undefined : "날짜가 다릅니다.";
  if (a.kind === "number" && b.kind === "number") {
    if (a.unit !== b.unit) return "금액 또는 수치의 단위 확인";
    if (a.value !== b.value) return "숫자가 다릅니다.";
  }
}

export function workbookCellFormatter(
  styles: Document | undefined,
  date1904: boolean,
) {
  const formats = new Map(
    Array.from(styles?.getElementsByTagNameNS("*", "numFmt") || [], (entry) => [
      Number(entry.getAttribute("numFmtId")),
      entry.getAttribute("formatCode") || "",
    ]),
  );
  const cellFormats = Array.from(
    styles?.getElementsByTagNameNS("*", "cellXfs")[0]?.children || [],
    (entry) => Number(entry.getAttribute("numFmtId")),
  );
  return (raw: string, style: string | null, type: string | null) => {
    if (type === "d") return raw.replace(/T00:00:00(?:\.0+)?Z?$/, "");
    if ((type && type !== "n") || !raw.trim()) return raw;
    const formatId = style === null ? 0 : cellFormats[Number(style)];
    const custom = formats.get(formatId) || "";
    const dateTokens = custom.replace(/"[^"]*"|\\.|\[[^\]]*\]/g, "");
    const value = Number(raw);
    if (!Number.isFinite(value)) return raw;
    if (
      [
        14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 34, 35, 36, 50, 51, 52, 53, 54,
        55, 56, 57, 58,
      ].includes(formatId) ||
      (/[dy]/i.test(dateTokens) && /[mdy]/i.test(dateTokens))
    ) {
      // Serial 60 is Excel's fictitious 1900-02-29. Keep it unconverted.
      if (value < 0 || (!date1904 && Math.floor(value) === 60)) return raw;
      const offset = date1904 ? 24107 : value < 60 ? 25568 : 25569;
      const date = new Date(Math.round((value - offset) * 86_400_000));
      if (Number.isFinite(date.getTime()))
        return date.toISOString().replace(/T00:00:00\.000Z$/, "");
    }
    const currency =
      /\[\$(KRW|USD|EUR|GBP|₩|€|£)(?:-[^\]]+)?\]|"(KRW|USD|EUR|GBP|원|₩|€|£)"|([₩€£])/i.exec(
        custom,
      );
    if (currency)
      return (
        raw + " " + (currency[1] || currency[2] || currency[3]).toUpperCase()
      );
    if (formatId === 9 || formatId === 10 || dateTokens.includes("%"))
      return String(Number((value * 100).toPrecision(15))) + "%";
    return raw;
  };
}
