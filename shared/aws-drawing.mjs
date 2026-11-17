// Diagram coordinates for services are relative to their account frame.
export const services = {
  dynamodb: {
    label: "DynamoDB",
    color: "#455ac5",
    path: "M5 7C5 3 23 3 23 7C23 11 5 11 5 7M5 7V20C5 24 23 24 23 20V7M5 13C5 17 23 17 23 13",
  },
  rds: {
    label: "Amazon RDS",
    color: "#4056af",
    path: "M6 8C6 4 22 4 22 8C22 12 6 12 6 8M6 8V19C6 24 22 24 22 19V8M2 10V5H7M21 23H26V18",
  },
  vault: {
    label: "Backup vault",
    color: "#397946",
    path: "M4 7H24V24H4ZM3 7L6 3H22L25 7M17 14A3 3 0 1 0 11 14A3 3 0 1 0 17 14M14 17V21",
  },
  kms: {
    label: "KMS key",
    color: "#b93743",
    path: "M13 13A5 5 0 1 0 6 12L4 15V23H8V20H11V16ZM17 9H25V21H15M18 14H22",
  },
  s3: {
    label: "Amazon S3",
    color: "#397946",
    path: "M4 7Q14 1 24 7L21 22Q14 26 7 22ZM4 7Q14 13 24 7",
  },
  ec2: {
    label: "Amazon EC2",
    color: "#a65b1e",
    path: "M6 6H22V22H6ZM10 2V6M17 2V6M10 22V26M17 22V26M2 10H6M22 17H26",
  },
};
const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export const blankDrawing = () => ({
  organization: "AWS Organizations",
  accounts: [],
  items: [],
  arrows: [],
});
export function backupDrawing() {
  const d = blankDrawing();
  for (let row = 0; row < 2; row++) {
    const y = 70 + row * 276,
      left = "source" + row,
      right = "central" + row;
    d.accounts.push(
      {
        id: left,
        label: "Management account",
        region: "US East (Ohio)",
        x: 22,
        y,
      },
      {
        id: right,
        label: "Central Backup account",
        region: "US East (Ohio)",
        x: 506,
        y,
      },
    );
    const item = (suffix, account, kind, label, x, y) => {
      const id = suffix + row;
      d.items.push({ id, account, kind, label, x, y });
      return id;
    };
    const db = item(
        "database",
        left,
        row ? "rds" : "dynamodb",
        row ? "Amazon RDS" : "DynamoDB",
        80,
        83,
      ),
      v = item("vault", left, "vault", "Source backup vault", 268, 83),
      k = item("key", left, "kms", "Source vault key", 268, 163),
      managed = item("managed", left, "kms", "AWS managed key", 80, 163),
      dest = item("dest", right, "vault", "Destination vault", 105, 83),
      dk = item(
        "destinationkey",
        right,
        "kms",
        "Destination vault key",
        280,
        163,
      );
    for (const [from, to, label] of [
      [managed, db, ""],
      [k, v, ""],
      [dk, dest, ""],
      [v, dest, row ? "✕  검토 필요" : "✓  설계 경로"],
    ])
      d.arrows.push({ id: from + "_" + to, from, to, label });
  }
  return d;
}
const coord = (v) => Number.isFinite(v) && v >= 0 && v <= 12000;
const str = (v) => typeof v === "string" && v.length <= 200;
export function validateDrawing(d) {
  if (
    !d ||
    !str(d.organization) ||
    ![d.accounts, d.items, d.arrows].every(
      (a) => Array.isArray(a) && a.length <= 300,
    )
  )
    throw Error("AWS 드로잉 형식을 확인하세요.");
  const all = [...d.accounts, ...d.items, ...d.arrows];
  if (
    all.some((o) => !o || !/^\w[\w-]{0,99}$/.test(o.id) || !str(o.label)) ||
    new Set(all.map((o) => o.id)).size !== all.length
  )
    throw Error("AWS 드로잉 항목을 확인하세요.");
  const accountIds = new Set(d.accounts.map((a) => a.id)),
    ids = new Set(d.items.map((i) => i.id));
  if (
    d.accounts.some((a) => !str(a.region) || !coord(a.x) || !coord(a.y)) ||
    d.items.some(
      (i) =>
        !Object.hasOwn(services, i.kind) ||
        !accountIds.has(i.account) ||
        !coord(i.x) ||
        !coord(i.y) ||
        i.x > 400 ||
        i.y > 206,
    ) ||
    d.arrows.some((a) => !ids.has(a.from) || !ids.has(a.to) || a.from === a.to)
  )
    throw Error("AWS 드로잉 경계 또는 연결을 확인하세요.");
  return d;
}
export function drawingSVG(d, selected = "") {
  validateDrawing(d);
  const width = Math.max(480, ...d.accounts.map((a) => a.x + 444)),
    height = Math.max(280, ...d.accounts.map((a) => a.y + 261));
  const txt = (x, y, str, size = 14, extra = "") =>
    '<text x="' +
    x +
    '" y="' +
    y +
    '" font-size="' +
    size +
    '" ' +
    extra +
    ">" +
    esc(str) +
    "</text>";
  const account = new Map(d.accounts.map((a) => [a.id, a]));
  const ids = new Map(
    d.items.map((i) => {
      const a = account.get(i.account);
      return [i.id, { x: a.x + i.x, y: a.y + i.y }];
    }),
  );
  const frames = d.accounts
    .map(
      (a) =>
        '<g data-id="' +
        esc(a.id) +
        '" transform="translate(' +
        a.x +
        " " +
        a.y +
        ')"><rect width="418" height="238" fill="#fff" stroke="' +
        (selected === a.id ? "#1766b2" : "#74879a") +
        '" stroke-dasharray="5 3"/><rect width="418" height="32" fill="#edf1f5"/>' +
        txt(12, 21, a.label, 15, 'font-weight="650"') +
        txt(12, 52, a.region, 12, 'fill="#526578"') +
        "</g>",
    )
    .join("");
  const paths = d.arrows
    .map((e) => {
      const a = ids.get(e.from),
        b = ids.get(e.to),
        dx = b.x - a.x,
        dy = b.y - a.y,
        h = Math.abs(dx) >= Math.abs(dy),
        sx = a.x + (h ? Math.sign(dx) * 22 : 0),
        sy = a.y + (h ? 0 : Math.sign(dy) * 20),
        tx = b.x - (h ? Math.sign(dx) * 24 : 0),
        ty = b.y - (h ? 0 : Math.sign(dy) * 22),
        mx = (sx + tx) / 2,
        my = (sy + ty) / 2;
      const path =
        "M" +
        sx +
        " " +
        sy +
        (h
          ? " H" + mx + " V" + ty + " H" + tx
          : " V" + my + " H" + tx + " V" + ty);
      return (
        '<g data-id="' +
        esc(e.id) +
        '"><path d="' +
        path +
        '" fill="none" stroke="transparent" stroke-width="14"/><path d="' +
        path +
        '" fill="none" stroke="' +
        (selected === e.id ? "#1766b2" : "#455563") +
        '" stroke-width="1.6" marker-end="url(#aws-arrow)"/>' +
        txt(
          mx,
          my - 7,
          e.label,
          13,
          'text-anchor="middle" paint-order="stroke" stroke="white" stroke-width="4" fill="#344453"',
        ) +
        "</g>"
      );
    })
    .join("");
  const nodes = d.items
    .map((i) => {
      const p = ids.get(i.id),
        s = services[i.kind];
      return (
        '<g data-id="' +
        esc(i.id) +
        '" transform="translate(' +
        p.x +
        " " +
        p.y +
        ')"><title>' +
        esc(i.label) +
        "</title>" +
        (selected === i.id
          ? '<rect x="-24" y="-24" width="48" height="48" rx="5" fill="none" stroke="#1e67aa" stroke-width="2"/>'
          : "") +
        '<rect x="-20" y="-20" width="40" height="40" rx="3" fill="' +
        s.color +
        '"/><path transform="translate(-14 -14)" d="' +
        s.path +
        '" fill="none" stroke="white" stroke-width="1.7" stroke-linejoin="round"/>' +
        txt(
          0,
          37,
          i.label,
          12,
          'text-anchor="middle" paint-order="stroke" stroke="white" stroke-width="3"',
        ) +
        "</g>"
      );
    })
    .join("");
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    width +
    " " +
    height +
    '" font-family="sans-serif" fill="#243442"><title>' +
    esc(d.organization) +
    '</title><defs><marker id="aws-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#455563"/></marker></defs><rect x="1" y="1" width="' +
    (width - 2) +
    '" height="' +
    (height - 2) +
    '" fill="white" stroke="#657588"/><rect x="1" y="1" width="42" height="40" fill="#a13b72"/><path d="M16 7h12v9H16zM22 16v5M11 21h22M11 21v5m11-5v5m11-5v5M7 26h8v7H7zM18 26h8v7h-8zM29 26h8v7h-8z" stroke="white" fill="none"/>' +
    txt(55, 28, d.organization, 18, 'font-weight="650"') +
    frames +
    paths +
    nodes +
    "</svg>"
  );
}
