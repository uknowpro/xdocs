import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  COMPONENTS,
  newArchitecture,
  newComponent,
  generateArchitecture,
} from "../shared/architecture.mjs";
const root = process.argv[2];
if (!root) throw Error("Output path required");
const m = newArchitecture();
m.title = "Generated validation fixture";
for (const kind of Object.keys(COMPONENTS)) {
  const n = newComponent(kind);
  for (const [key, f] of Object.entries(COMPONENTS[kind].fields))
    if (f.ref) n.props[key] = m.nodes.find((n) => n.kind === f.ref).id;
  if (kind.includes("bucket"))
    n.props.name = "xdocs-fixture-bucket-" + m.nodes.length;
  if (kind.includes("storage_account"))
    n.props.name = "xdocsfixturestore" + m.nodes.length;
  if (kind === "aws_instance") n.props.ami = "ami-0123456789abcdef0";
  if (kind === "azurerm_linux_virtual_machine")
    n.props.ssh_key =
      "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDDUkK5+wnHE9gjotq/ZGpGKVdD6U2mpGd+d1SD+fZZSsvN80JNz7Na+AvPMmIj7/GrUAZL/wc22vWqDJdkLrqlrv8QrUoUduG28fuLd8b+yltaRSp59LpB4X5oG1FLvdbOr3DAzaPwQpi+WktpH5WSBTdjSXyDjODtu7+ML3bWQMsRIKI5cc4XS68uH7/hPdGFnPQcVTWtaLXQnFnMCUOatSHdZp+nqBeJWYiHAZ+jcqUxXUlE2s0ANcHM278cOLLDFjvUdHLGmdE0TTCdpl+02O8EPRbMJPbfeonz5SCGk6pSl3EsQOajHDMqPnAye7zwaSMUrd7aKsQ7OIpo003H xdocs-validation-only";
  m.nodes.push(n);
}
const r = generateArchitecture(m);
if (r.errors.length) throw Error(r.errors.join("\n"));
for (const [name, body] of Object.entries(r.files)) {
  const p = path.join(root, name);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, body);
}
console.log("Generated", Object.keys(r.files).length, "validation files");
