/// <reference types="vite/client" />
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
export const cloudTemplates = [...architectureCatalog, ...sources];
export async function openCloudTemplate(
  id: string,
): Promise<ArchitectureModel> {
  const load = snapshots["../catalog/snapshots/" + id + ".json"];
  return load ? structuredClone(await load()) : fromCatalog(id);
}
