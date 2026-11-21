"""Rebuild shared/cloud-inventory.mjs from terraform providers schema -json,
the Bicep types generated/index.json, the AWS SDK v3 clients directory listing,
and Google's preferred Discovery API list, in that argument order.
"""
import json
import sys
from pathlib import Path

schema_file, arm_file, aws_file, google_file = map(Path, sys.argv[1:])
schemas = json.loads(schema_file.read_text())["provider_schemas"]
providers = {"aws", "awscc", "azurerm", "azuread", "azapi", "google", "google-beta"}
managed = {key.split("/")[-1]: sorted(schema["resource_schemas"])
           for key, schema in schemas.items() if key.split("/")[-1] in providers}
if managed.keys() != providers:
    raise ValueError("All seven Terraform provider schemas are required")

arm = {}
for qualified in json.loads(arm_file.read_text())["resources"]:
    resource_type, version = qualified.rsplit("@", 1)
    key = resource_type.lower()
    rank = ("preview" not in version.lower(), version)
    if key not in arm or rank > arm[key][0]:
        arm[key] = (rank, qualified)

aws = sorted(row["name"].removeprefix("client-") for row in json.loads(aws_file.read_text())
             if row["name"].startswith("client-"))
google = {api["name"]: api["title"] for api in json.loads(google_file.read_text())["items"]}
inventory = {"managed": managed, "armTypes": [arm[k][1] for k in sorted(arm)],
             "awsServices": aws, "googleApis": google}
output = Path(__file__).resolve().parents[1] / "shared" / "cloud-inventory.mjs"
output.write_text("// Offline snapshot of Terraform managed resource schemas, Azure Bicep types, AWS SDK v3 clients and Google Discovery APIs.\n"
                  + "export default " + json.dumps(inventory, indent=2, ensure_ascii=False) + ";\n")
