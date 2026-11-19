import { isFolderPage } from "./page-parent.mjs";

export function pageKind(note) {
  if (note.pageKind) return note.pageKind;
  if (isFolderPage(note)) return "folder";
  if (note.sheet) return "sheets";
  if (/^<!-- xdocs:analyzer -->\r?$/m.test(note.body)) return "analyzer";
  const marker =
    /^```xdocs-(sheets|infra|architecture|builder|workflow|xcode)\r?$/m.exec(
      note.body,
    );
  if (marker?.[1] === "workflow") {
    const data = note.body.slice(marker.index + marker[0].length);
    return (
      data.match(
        /"kind"\s*:\s*"(actions|ansible|jenkins|cloudformation)"/,
      )?.[1] ?? "workflow"
    );
  }
  return marker?.[1] ?? (note.canvas ? "workflow" : "note");
}
