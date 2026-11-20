/// <reference types="vite/client" />
import {firewallCase} from "../shared/azure-firewall-path.mjs";
import studies from "../catalog/case-studies.json";
import sources from "../catalog/sources.json";
import {
  architectureCatalog,
  fromCatalog,
} from "../shared/architecture-catalog.mjs";
import type { ArchitectureModel } from "./ArchitectureDocument";
const snapshots = import.meta.glob<ArchitectureModel>(
  "../catalog/snapshots/*.json",
  { import: "default" },
);
type CloudTemplate = {
  id: string;
  name: string;
  provider: string;
  study: string;
  kinds: string[];
  repo?: string;
  revision?: string;
  caseStudy?: boolean;
  review?: Record<string, string>;
};
export const cloudTemplates: CloudTemplate[] = [
  ...studies,
  ...architectureCatalog,
  ...sources.filter(template => !template.cardOnly),
];
export async function openCloudTemplate(
  id: string,
): Promise<ArchitectureModel> {
  const load = snapshots["../catalog/snapshots/" + id + ".json"];
  const model = load ? structuredClone(await load()) : fromCatalog(id);
  if (id === firewallCase) model.caseStudyId = id;
  return model;
}
