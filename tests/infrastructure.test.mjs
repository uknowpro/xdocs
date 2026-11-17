import test from "node:test";
import assert from "node:assert/strict";
import { parseInfrastructure } from "../desktop/infrastructure-reader.mjs";
import {
  encodeInfrastructure,
  decodeInfrastructure,
  compareInfrastructure,
  infrastructureExample,
  infrastructureMarkdown,
} from "../shared/infrastructure.mjs";
test("Compose retains named relationships and omits values and host paths", () => {
  const result = parseInfrastructure(`services:
  web:
    environment: {PASSWORD: SECRET_VALUE}
    command: SECRET_COMMAND
    ports: ['8080:80']
    depends_on: [db]
    volumes: ['data:/data', '/SECRET_PATH:/private']
  db:
    deploy: {replicas: 2}
volumes: {data: {}}
`);
  assert.equal(result.format, "compose");
  assert.deepEqual(
    result.resources.find((r) => r.id === "service:web").dependencies,
    ["network:default", "service:db", "volume:data"],
  );
  assert.doesNotMatch(JSON.stringify(result), /SECRET_/);
  assert.equal(
    result.resources.find((r) => r.id === "service:db").properties.replicas,
    2,
  );
});
test("Kubernetes list and multi documents link selectors and secret references without secret content", () => {
  const resources = [
    {
      apiVersion: "v1",
      kind: "Service",
      metadata: { name: "web" },
      spec: { selector: { app: "web" } },
    },
    {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: "app", annotations: { private: "SECRET_VALUE" } },
      spec: {
        replicas: 2,
        template: {
          metadata: { labels: { app: "web" } },
          spec: {
            containers: [
              {
                name: "app",
                env: [
                  {
                    valueFrom: {
                      secretKeyRef: { name: "credentials", key: "password" },
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    },
    {
      apiVersion: "v1",
      kind: "Secret",
      metadata: { name: "credentials" },
      stringData: { password: "SECRET_VALUE" },
    },
  ];
  const result = parseInfrastructure(
    JSON.stringify({ kind: "List", items: resources }),
  );
  assert.deepEqual(
    result.resources.find((r) => r.kind === "Service").dependencies,
    ["Deployment:default:app"],
  );
  assert.deepEqual(
    result.resources.find((r) => r.kind === "Deployment").dependencies,
    ["Secret:default:credentials"],
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /SECRET_VALUE|password|annotations/,
  );
  assert.equal(
    parseInfrastructure(
      "apiVersion: v1\nkind: Namespace\nmetadata: {name: apps}\n---\napiVersion: v1\nkind: ConfigMap\nmetadata: {name: settings, namespace: apps}\ndata: {key: SECRET_VALUE}",
    ).resources.length,
    2,
  );
});
test("Terraform plan masks sensitive allowed fields and resolves configuration references", () => {
  const result = parseInfrastructure(
    JSON.stringify({
      format_version: "1.2",
      planned_values: {
        root_module: {
          resources: [
            {
              address: "aws_db_instance.db",
              type: "aws_db_instance",
              name: "db",
              values: { engine: "SECRET_VALUE", password: "SECRET_PASSWORD" },
            },
          ],
        },
      },
      resource_changes: [
        {
          address: "aws_db_instance.db",
          type: "aws_db_instance",
          name: "db",
          change: {
            actions: ["create"],
            after: { engine: "SECRET_VALUE", port: 5432 },
            after_sensitive: { engine: true },
          },
        },
      ],
      configuration: {
        root_module: {
          resources: [
            {
              address: "aws_db_instance.db",
              type: "aws_db_instance",
              name: "db",
            },
            {
              address: "aws_instance.api",
              type: "aws_instance",
              name: "api",
              expressions: {
                db: { references: ["aws_db_instance.db.endpoint"] },
              },
            },
          ],
        },
      },
    }),
  );
  assert.doesNotMatch(JSON.stringify(result), /SECRET_/);
  assert.deepEqual(
    result.resources.find((r) => r.name === "api").dependencies,
    ["aws_db_instance.db"],
  );
  assert.deepEqual(result.resources.find((r) => r.name === "db").actions, [
    "create",
  ]);
  assert.equal(
    result.resources.find((r) => r.name === "db").properties.port,
    5432,
  );
});
test("Reject invalid syntax, aliases, duplicate resources, unsupported versions and excessive input", () => {
  for (const input of [
    "services: {a: {}, a: {}}",
    "services: &a {loop: *a}",
    JSON.stringify({ format_version: "2.0" }),
    "not infrastructure",
    "x".repeat(20 * 1024 * 1024 + 1),
  ])
    assert.throws(() => parseInfrastructure(input));
  const item = {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name: "duplicate" },
  };
  assert.throws(() => parseInfrastructure(JSON.stringify([item, item])));
});
test("Snapshot round trips fenced text and detects retained field changes independently of notes and date", () => {
  const before = infrastructureExample();
  before.notes["service:web"] = "운영 ``` 메모";
  assert.deepEqual(decodeInfrastructure(encodeInfrastructure(before)), before);
  const after = structuredClone(before);
  after.importedAt = "later";
  after.notes = {};
  assert.deepEqual(compareInfrastructure(before, after), []);
  after.resources[0].properties.ports = "9000:80";
  after.resources.pop();
  after.resources.push({
    id: "service:new",
    kind: "Service",
    name: "new",
    scope: "compose",
    properties: {},
    dependencies: [],
    actions: [],
  });
  assert.deepEqual(
    compareInfrastructure(before, after).map((r) => r.kind),
    ["changed", "added", "removed"],
  );
  assert.match(infrastructureMarkdown(before), /service:web/);
  assert.throws(() =>
    compareInfrastructure(before, { ...after, format: "terraform" }),
  );
});
