import type { Note } from "./types";
export function linksIn(body: string): string[] {
  return [
    ...new Set(
      [...body.replace(/```[\s\S]*?```/g, "").matchAll(/\[\[([^\]\n]+)\]\]/g)]
        .map((m) => m[1].split("|")[0].trim())
        .filter(Boolean),
    ),
  ];
}
export function resolveLink(target: string, notes: Note[]): Note | undefined {
  return (
    notes.find((n) => n.id === target) ||
    notes.find(
      (n) =>
        n.title === target ||
        n.path.replace(/\.md$/i, "").replaceAll("\\", "/") === target,
    )
  );
}
export function edgesFor(notes: Note[]) {
  return notes.flatMap((n) =>
    linksIn(n.body).flatMap((target) => {
      const to = resolveLink(target, notes);
      return to && to.id !== n.id ? [{ source: n.id, target: to.id }] : [];
    }),
  );
}
