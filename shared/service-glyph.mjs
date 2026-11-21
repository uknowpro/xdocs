// Monochrome paths are shared by the desktop palette and standalone SVG exports.
const symbols = [
  [
    /lambda|cloudfunctions|cloud_functions|function_app/,
    "M4 3h5l7 14h4M3 17l6-10",
  ],
  [
    /key_vault|keyvault|kms|secret/,
    "M12 2a5 5 0 1 0 4 8l4-4-2-2-2 2-2-2M8 7h.01",
  ],
  [
    /identity|azuread|iam_|entra|principal/,
    "M11 2a4 4 0 1 0 .1 0M3 19v-2c0-6 16-6 16 0v2z",
  ],
  [
    /firewall|security_group|waf|security_policy/,
    "M10 1l8 3v6q0 6-8 10Q2 16 2 10V4zM6 10l3 3 5-6",
  ],
  [
    /bucket|storage_account|storageaccount|(^|_)s3_/,
    "M2 4q8-4 16 0l-2 13q-6 4-12 0zM2 4q8 5 16 0",
  ],
  [
    /database|dynamodb|sql|bigquery|cosmos|redis/,
    "M2 4a8 3 0 1 0 16 0a8 3 0 1 0-16 0v12c0 4 16 4 16 0V4M2 10c0 4 16 4 16 0",
  ],
  [
    /router|gateway|nat_|route_table|load_balancer/,
    "M2 8h16v8H2zM5 5l3-3 3 3M8 2v6m4 3h3m-10 2h1",
  ],
  [
    /vpc|subnet|subnetwork|network|peering/,
    "M7 1h6v5H7zM1 14h6v5H1zM13 14h6v5h-6zM10 6v4H4v4m6-4h6v4",
  ],
  [
    /cluster|k8s_|kubernetes|ecs_|eks_|container/,
    "M10 1l8 4v10l-8 4-8-4V5zM2 5l8 5 8-5m-8 5v9",
  ],
  [/backup|recovery|snapshot/, "M2 8a8 8 0 1 1 0 5M2 3v5h5m3-4v6l4 2"],
  [/queue|topic|pubsub|sqs_|sns_/, "M2 3h16v4H2zM2 9h16v4H2zM2 15h16v4H2z"],
  [
    /instance|machine|compute|ec2/,
    "M4 4h12v12H4zM7 1v3m6-3v3M7 16v3m6-3v3M1 7h3m12 0h3M1 13h3m12 0h3",
  ],
];
export function serviceGlyph(kind, container = false) {
  return (
    symbols.find(([pattern]) => pattern.test(kind))?.[1] ||
    (container
      ? "M2 4h6l2 3h8v10H2z"
      : "M5 16a4 4 0 0 1-1-8 6 6 0 0 1 12-1 5 5 0 0 1 0 10H5z")
  );
}
