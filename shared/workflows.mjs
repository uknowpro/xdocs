import { parseDocument, isMap, isSeq, isScalar } from "yaml";

export const templates = {
  actions: {
    label: "GitHub Actions",
    name: "workflow.yml",
    source:
      "name: Build\non: workflow_dispatch\npermissions:\n  contents: read\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Build\n        run: echo build\n",
  },
  ansible: {
    label: "Ansible",
    name: "playbook.yml",
    source:
      "- name: Configure\n  hosts: all\n  tasks:\n    - name: Check connectivity\n      ansible.builtin.ping: {}\n",
  },
  jenkins: {
    label: "Jenkins Declarative",
    name: "Jenkinsfile",
    source:
      "pipeline {\n  agent any\n  stages {\n    stage('Build') {\n      steps {\n        echo 'build'\n      }\n    }\n  }\n}\n",
  },
  cloudformation: {
    label: "CloudFormation",
    name: "template.yaml",
    source:
      "AWSTemplateFormatVersion: '2010-09-09'\nResources:\n  Network:\n    Type: AWS::EC2::VPC\n    Properties:\n      CidrBlock: 10.0.0.0/16\n",
  },
};
const fence = /^```xdocs-workflow\r?\n([^]*?)\r?\n```$/m;
export function encodeWorkflow(m) {
  if (
    !Object.hasOwn(templates, m.kind) ||
    m.version !== 1 ||
    typeof m.source !== "string" ||
    m.source.length > 500000 ||
    !m.positions ||
    typeof m.positions !== "object"
  )
    throw Error("문서 형식 또는 크기를 확인하세요.");
  return (
    "```xdocs-workflow\n" +
    JSON.stringify(m).replaceAll("`", "\\u0060") +
    "\n```"
  );
}
export function decodeWorkflow(body) {
  const match = body.match(fence);
  if (!match) return null;
  const m = JSON.parse(match[1]);
  encodeWorkflow(m);
  return m;
}
export const replaceWorkflow = (body, m) =>
  body.replace(fence, () => encodeWorkflow(m));
function jenkinsNodes(source) {
  // Skip quotes and comments before matching balanced stage blocks. Unsupported Groovy stays editable as source.
  const tokens = [
    ...source.matchAll(
      /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|[A-Za-z_$][\w$]*|[^\s]/g,
    ),
  ].filter((t) => !t[0].startsWith("//") && !t[0].startsWith("/*"));
  const nodes = [],
    stack = [];
  let stage = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (
      t[0] === "stage" &&
      tokens[i + 1]?.[0] === "(" &&
      /^['"]/.test(tokens[i + 2]?.[0]) &&
      tokens[i + 3]?.[0] === ")" &&
      tokens[i + 4]?.[0] === "{"
    ) {
      stage = {
        id: "stage-" + nodes.length,
        label: tokens[i + 2][0].slice(1, -1),
        type: "Stage",
        start: t.index,
        end: 0,
        refs: [],
      };
      nodes.push(stage);
      i += 3;
      continue;
    }
    if (t[0] === "{") {
      stack.push(stage);
      stage = null;
    }
    if (t[0] === "}") {
      if (!stack.length) throw Error("중괄호를 확인하세요.");
      const closed = stack.pop();
      if (closed) {
        closed.end = t.index + 1;
        const parent = stack.findLast(Boolean);
        if (parent) closed.refs.push(parent.id);
      }
    }
  }
  if (
    stack.length ||
    nodes.some((n) => !n.end) ||
    !tokens.some((t) => t[0] === "pipeline")
  )
    throw Error("Declarative pipeline 블록을 확인하세요.");
  if (nodes.length > 300) throw Error("최대 300개 카드를 지원합니다.");
  return nodes;
}
export function workflowNodes(kind, source) {
  if (!Object.hasOwn(templates, kind) || source.length > 500000)
    throw Error("최대 500,000자까지 지원합니다.");
  if (kind === "jenkins") return jenkinsNodes(source);
  const doc = parseDocument(source, { uniqueKeys: true });
  if (doc.errors.length)
    throw Error(
      "YAML/JSON 구문을 확인하세요. " + doc.errors[0].message.split("\n")[0],
    );
  const nodes = [];
  function add(id, label, type, node, refs = []) {
    if (node?.range)
      nodes.push({
        id,
        label,
        type,
        start: node.range[0],
        end: node.range[1],
        refs,
      });
  }
  const val = (n) => (isScalar(n) ? String(n.value) : "");
  if (kind === "ansible") {
    if (!isSeq(doc.contents)) throw Error("Play 목록이 필요합니다.");
    doc.contents.items.forEach((play, i) => {
      if (!isMap(play)) return;
      const id = "play-" + i;
      add(
        id,
        val(play.get("name", true)) || val(play.get("hosts", true)) || id,
        "Play",
        play,
      );
      for (const section of [
        "pre_tasks",
        "roles",
        "tasks",
        "post_tasks",
        "handlers",
      ]) {
        const items = play.get(section, true);
        if (isSeq(items))
          items.items.forEach((task, j) =>
            add(
              id + "-" + section + j,
              isMap(task)
                ? val(task.get("name", true)) || val(task.items[0]?.key)
                : val(task),
              section,
              task,
              [id],
            ),
          );
      }
    });
  } else {
    const map = doc.get(kind === "actions" ? "jobs" : "Resources", true);
    if (!isMap(map))
      throw Error(
        kind === "actions"
          ? "jobs 맵이 필요합니다."
          : "Resources 맵이 필요합니다.",
      );
    for (const pair of map.items) {
      const id = val(pair.key),
        body = pair.value;
      if (!isMap(body)) continue;
      if (kind === "actions") {
        const needs = body.get("needs", true);
        add(
          id,
          id,
          "Job",
          body,
          isSeq(needs) ? needs.items.map(val) : needs ? [val(needs)] : [],
        );
        const steps = body.get("steps", true);
        if (isSeq(steps))
          steps.items.forEach((s, i) =>
            add(
              id + "/step" + i,
              isMap(s)
                ? val(s.get("name", true)) ||
                    val(s.get("uses", true)) ||
                    "Step " + (i + 1)
                : "Step",
              "Step",
              s,
              [id],
            ),
          );
      } else {
        const refs = new Set();
        function visit(n) {
          if (!n) return;
          if (n.tag === "!Ref" || n.tag === "!GetAtt")
            refs.add(val(n).split(".")[0]);
          if (isMap(n))
            for (const { key, value } of n.items) {
              const k = val(key);
              if (["Ref", "Fn::GetAtt", "DependsOn"].includes(k)) {
                for (const x of isSeq(value) ? value.items : [value])
                  refs.add(val(x).split(".")[0]);
              }
              visit(value);
            }
          if (isSeq(n)) n.items.forEach(visit);
        }
        visit(body);
        add(
          id,
          id,
          val(body.get("Type", true)),
          body,
          [...refs].filter((r) => map.has(r)),
        );
      }
    }
  }
  if (nodes.length > 300) throw Error("캔버스는 최대 300개 카드를 지원합니다.");
  return nodes;
}
export function addBlock(kind, source) {
  const nodes = workflowNodes(kind, source);
  let i = 1;
  while (nodes.some((n) => n.id === "task" + i || n.label === "Stage " + i))
    i++;
  if (kind === "ansible")
    return source.trimEnd() + "\n- name: New play\n  hosts: all\n  tasks: []\n";
  if (kind === "jenkins") {
    const last = nodes.filter((n) => !n.refs.length).at(-1);
    if (!last) throw Error("원문에서 첫 stage를 작성하세요.");
    return (
      source.slice(0, last.end) +
      "\n    stage('Stage " +
      i +
      "') { steps { echo 'stage' } }" +
      source.slice(last.end)
    );
  }
  const doc = parseDocument(source),
    map = doc.get(kind === "actions" ? "jobs" : "Resources", true);
  if (map.flow || !map.items.length)
    throw Error("인라인·JSON 맵은 전체 원문에서 항목을 추가하세요.");
  const pos = map.range[1],
    indent = " ".repeat(
      map.items[0].key.range[0] -
        source.lastIndexOf("\n", map.items[0].key.range[0] - 1) -
        1,
    );
  const lines =
    kind === "actions"
      ? [
          "task" + i + ":",
          "  runs-on: ubuntu-latest",
          "  steps:",
          "    - run: echo ready",
        ]
      : [
          "task" + i + ":",
          "  Type: AWS::S3::Bucket",
          "  DeletionPolicy: Retain",
        ];
  return (
    source.slice(0, pos).trimEnd() +
    "\n" +
    lines.map((l) => indent + l).join("\n") +
    "\n" +
    source.slice(pos)
  );
}
