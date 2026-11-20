import {networkCases} from "./network-case-layouts.mjs";
import {firewallCase,firewallDiagram} from "./azure-firewall-path.mjs";
import {enterpriseCases} from "./enterprise-case-layouts.mjs";
import {regionalCases} from "./regional-case-layouts.mjs";
// Coordinates are in the reference design's view box. A resource address resolves
// against the current canvas; conceptual frames never introduce Terraform dependencies.
const zone = (z, y) => [
  ["frame", "ap-northeast-2" + z, 225, y, 745, 199],
  [
    "aws_subnet.public_" + z,
    "Public-" + z.toUpperCase(),
    245,
    y + 31,
    335,
    151,
  ],
  [
    "aws_subnet.private_" + z,
    "Private-" + z.toUpperCase(),
    604,
    y + 31,
    345,
    151,
  ],
  ["aws_eip.egress_" + z, "Elastic IP", 260, y + 74, 123, 40],
  ["aws_nat_gateway.egress_" + z, "NAT Gateway", 425, y + 74, 133, 40],
  [
    "aws_route_table_association.public_" + z,
    "Public association",
    260,
    y + 130,
    174,
    37,
  ],
  ["aws_route_table.private_" + z, "Private routes", 620, y + 74, 138, 40],
  ["aws_route.egress_" + z, "0.0.0.0/0", 789, y + 74, 143, 40],
  [
    "aws_route_table_association.private_" + z,
    "Private association",
    620,
    y + 130,
    175,
    37,
  ],
];
const seoul = [
  ["frame", "AWS · Asia Pacific (Seoul)", 8, 8, 1150, 516],
  ["aws_vpc.seoul", "VPC · 10.42.0.0/16", 24, 47, 955, 456],
  ["aws_internet_gateway.internet", "Internet Gateway", 43, 130, 154, 45],
  ["aws_route.internet", "0.0.0.0/0", 43, 205, 154, 41],
  ["aws_route_table.public", "Public routes", 43, 285, 154, 42],
  ...zone("a", 78),
  ...zone("c", 288),
].map(([key, label, x, y, w, h]) => [
  key,
  label,
  key === "frame" && x === 8 ? x : key.startsWith("aws_eip.") ? 25 : x + 155,
  y,
  w,
  h,
]);
const eks = [
  ["frame", "AWS · Asia Pacific (Seoul)", 8, 8, 985, 520],
  ["aws_vpc.seoul", "VPC · Multi-AZ", 24, 48, 954, 409],
  ["frame", "Private subnets · ap-northeast-2a / 2c", 195, 87, 593, 345],
  ["aws_eks_cluster.platform", "Amazon EKS · private API", 210, 120, 563, 297],
  ["kubernetes_namespace_v1.ingress", "Ingress", 225, 158, 164, 96],
  ["helm_release.gateway", "Traefik", 239, 201, 135, 39],
  ["kubernetes_namespace_v1.application", "Application", 403, 158, 162, 96],
  ["aws_eks_node_group.workers", "Worker nodes · A/C", 581, 178, 170, 43],
  ["kubernetes_namespace_v1.logging", "Logging", 225, 277, 164, 115],
  ["helm_release.logs", "Fluent Bit", 239, 328, 135, 38],
  ["kubernetes_namespace_v1.monitoring", "Monitoring", 404, 277, 348, 115],
  ["helm_release.metrics", "OpenTelemetry", 419, 328, 149, 38],
  ["helm_release.dashboards", "Grafana", 584, 328, 148, 38],
  ["aws_subnet.public_a", "Public-A", 44, 155, 131, 42],
  ["aws_subnet.public_c", "Public-C", 44, 225, 131, 42],
  ["aws_efs_file_system.shared", "Encrypted EFS", 808, 196, 150, 43],
  [
    "aws_cloudwatch_log_group.application",
    "CloudWatch Logs",
    208,
    470,
    177,
    40,
  ],
  ["aws_prometheus_workspace.metrics", "Managed Prometheus", 434, 470, 205, 40],
];
const retail = [
  ["frame", "Retail · governed data exchange", 8, 8, 985, 450],
  ["frame", "AWS · Order ingestion", 24, 58, 263, 353],
  ["aws_s3_bucket.orders", "S3 · raw orders", 42, 130, 228, 46],
  ["aws_s3_bucket_versioning.orders", "Version history", 42, 218, 228, 42],
  [
    "aws_s3_bucket_public_access_block.orders",
    "Public access block",
    42,
    288,
    228,
    42,
  ],
  ["frame", "GCP · Analytics and forecasting", 315, 58, 347, 353],
  ["google_storage_bucket.curated", "GCS · curated Parquet", 333, 130, 310, 46],
  [
    "google_bigquery_dataset.retail",
    "BigQuery · retail dataset",
    333,
    205,
    310,
    105,
  ],
  ["google_bigquery_table.orders", "External orders table", 352, 255, 272, 40],
  [
    "google_vertex_ai_dataset.forecast",
    "Vertex AI · forecast dataset",
    333,
    338,
    310,
    42,
  ],
  [
    "azurerm_resource_group.reporting",
    "Azure · Regional reporting",
    691,
    58,
    282,
    353,
  ],
  ["azurerm_data_factory.reporting", "Data Factory", 708, 130, 246, 46],
  ["azurerm_storage_account.regional", "ADLS Gen2", 708, 210, 246, 151],
  [
    "azurerm_storage_data_lake_gen2_filesystem.published",
    "Published reports",
    723,
    278,
    215,
    42,
  ],
];
const layouts = {
  ...networkCases,
  ...regionalCases,
  ...enterpriseCases,
  [firewallCase]:firewallDiagram,
  "seoul-zonal-egress": {
    boxes: seoul,
    links: [
      ["aws_route.internet", "aws_internet_gateway.internet", "gateway_id"],
      ["aws_route.internet", "aws_route_table.public", "route_table_id"],
      ...["a", "c"].flatMap((z) => [
        ["aws_nat_gateway.egress_" + z, "aws_eip.egress_" + z, "allocation_id"],
        [
          "aws_route.egress_" + z,
          "aws_nat_gateway.egress_" + z,
          "nat_gateway_id",
        ],
        [
          "aws_route_table_association.public_" + z,
          "aws_route_table.public",
          "route_table_id",
        ],
      ]),
    ],
  },
  "eks-platform-operations": {
    boxes: eks,
    links: [
      [
        "helm_release.logs",
        "aws_cloudwatch_log_group.application",
        "logs",
        true,
      ],
      [
        "helm_release.metrics",
        "aws_prometheus_workspace.metrics",
        "remote write",
        true,
      ],
      [
        "helm_release.gateway",
        "kubernetes_namespace_v1.application",
        "HTTP",
        true,
      ],
    ],
  },
  "retail-data-estate": {
    boxes: retail,
    links: [
      ["aws_s3_bucket.orders", "google_storage_bucket.curated", "batch", true],
      [
        "google_storage_bucket.curated",
        "google_bigquery_table.orders",
        "Parquet",
      ],
      [
        "google_bigquery_table.orders",
        "google_vertex_ai_dataset.forecast",
        "features",
        true,
      ],
      [
        "google_bigquery_table.orders",
        "azurerm_data_factory.reporting",
        "aggregate",
        true,
      ],
    ],
  },
};
// Simple service-family symbols keep dense subnet and route diagrams readable.
const symbols = [
  [
    /subnet|virtual_network|vpc$/,
    "M3 11h18v9H3z M7 11V8a5 5 0 0 1 10 0v3 M12 14v3",
    "#7754a5",
  ],
  [/gateway/, "M3 7h17l-4-4 M21 17H4l4 4 M20 7l-4 4 M4 17l4-4", "#7954a9"],
  [
    /route_table|aws_route$/,
    "M3 4h18v16H3z M3 9h18 M9 9v11 M12 13h6 M12 17h6",
    "#6b539b",
  ],
  [
    /aws_eip/,
    "M3 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M13 12h8l-3-3 M21 12l-3 3",
    "#bb651c",
  ],
  [
    /bucket|storage|file_system|log_group|dataset|bigquery/,
    "M4 6c0-4 16-4 16 0s-16 4-16 0v12c0 4 16 4 16 0V6 M4 12c0 4 16 4 16 0",
    "#32735b",
  ],
  [
    /eks|kubernetes|helm/,
    "M12 2l9 5v10l-9 5-9-5V7z M7 9l5 3 5-3 M12 12v6",
    "#3567ac",
  ],
];
const esc = (value) =>
  String(value).replace(
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
export function caseDiagram(model, selected = "", planLabels = {}) {
  const spec =
    Object.hasOwn(layouts, model.caseStudyId) && layouts[model.caseStudyId];
  if (!spec) return "";
  const nodes = new Map(model.nodes.map((n) => [n.address, n]));
  const boxes = spec.boxes.filter(([key]) => key === "frame" || key.startsWith("op:") || key.startsWith("step:") || nodes.has(key));
  const byKey = new Map(boxes.map((b) => [b[0], b]));
  const text = (x, y, label, size) =>
    `<text x="${x}" y="${y}" font-family="system-ui,sans-serif" font-size="${size}" fill="#243445">${esc(label)}</text>`;
  const rects = boxes.map(([key, label, x, y, w, h]) => {
    const node = nodes.get(key),
      frame = h > 75;
    const color = key.includes("private")
      ? "#2574a4"
      : key.includes("public")
        ? "#438044"
        : key.startsWith("kubernetes")
          ? "#5570a6"
          : "#66778b";
    const symbol = node && symbols.find(([pattern]) => pattern.test(node.kind));
    const glyph = symbol
      ? `<g transform="translate(${x + 8} ${y + (frame ? 6 : 11)}) scale(.74)"><rect width="24" height="24" rx="4" fill="${symbol[2]}"/><path d="${symbol[1]}" fill="none" stroke="white" stroke-width="1.6"/></g>`
      : "";
    return `<g${node ? ' data-resource="' + esc(node.id) + '" tabindex="0" role="button" aria-label="' + esc(label) + '"' : ""}><title>${esc(node?.address || label)}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${frame ? "#f4f8fb" : "white"}" stroke="${node?.id === selected ? "#0567bf" : color}" stroke-width="${node?.id === selected ? 3 : 1.2}" ${key === "frame" || key.startsWith("op:") ? 'stroke-dasharray="6 4"' : ""}/>${glyph}${text(x + (glyph ? 31 : 10), y + (frame ? 20 : 25), (node && planLabels[node.id] ? planLabels[node.id]+" · " : "")+label, frame ? 14 : 12)}</g>`;
  });
  const lines = spec.links.map(([source, target, label, planned]) => {
    const a = byKey.get(source),
      b = byKey.get(target);
    if (!a || !b) return "";
    const ax = a[2] + a[4] / 2,
      ay = a[3] + a[5] / 2,
      bx = b[2] + b[4] / 2,
      by = b[3] + b[5] / 2;
    const horiz = Math.abs(ax - bx) > Math.abs(ay - by);
    const x1 = horiz ? ax + (Math.sign(bx - ax) * a[4]) / 2 : ax,
      y1 = horiz ? ay : ay + (Math.sign(by - ay) * a[5]) / 2;
    const x2 = horiz ? bx - (Math.sign(bx - ax) * b[4]) / 2 : bx,
      y2 = horiz ? by : by - (Math.sign(by - ay) * b[5]) / 2;
    const mx = (x1 + x2) / 2,
      my = (y1 + y2) / 2;
    // Route EIP references above the resources and NAT references below them.
    if (label === "nat_gateway_id" || label === "allocation_id") {
      const bottom = label === "nat_gateway_id";
      const start = a[3] + (bottom ? a[5] : 0), end = b[3] + (bottom ? b[5] : 0);
      const lane = bottom ? Math.max(start, end) + 12 : Math.min(start, end) - 11;
      return `<g pointer-events="none"><path d="M${ax} ${start} V${lane} H${bx} V${end}" fill="none" stroke="#49586e" marker-end="url(#case-arrow)"/>${text((ax + bx) / 2 - 24, lane - 4, label, 10)}</g>`;
    }
    return `<g pointer-events="none"><path d="M${x1} ${y1} ${horiz ? "H" + mx + " V" + y2 : "V" + my + " H" + x2} L${x2} ${y2}" fill="none" stroke="#49586e" ${planned ? 'stroke-dasharray="4 3"' : ""} marker-end="url(#case-arrow)"/><text x="${horiz ? mx : mx + 8}" y="${horiz ? my - 5 : my + 3}" text-anchor="${horiz ? "middle" : "start"}" font-size="10" font-family="monospace" fill="#364559" stroke="white" stroke-width="3" paint-order="stroke">${esc(label)}</text></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${spec.boxes[0][4] + 16} ${spec.boxes[0][5] + 24}"><defs><marker id="case-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10" fill="#49586e"/></marker></defs>${rects.join("")}${lines.join("")}</svg>`;
}
