import type { NoteGraphNode } from "../../reader/_actions/notes";

export type NoteGroupReason = "note-tag" | "tag" | "author";

export interface NoteGroup {
  id: string;
  reason: NoteGroupReason;
  label: string;
  memberIds: string[];
}

/**
 * Groups are keyed by a shared attribute VALUE (a specific tag, a specific
 * author) rather than by graph connectivity - unlike connected-components,
 * this lets one note honestly belong to several groups at once (e.g. tagged
 * "Leadership" AND by "James Clear"). Cross-book only, mirroring the
 * constellation graph's own same-book skip - the point of this view is
 * connections a single-book grouping wouldn't show.
 */
export function deriveNoteGroups(
  nodes: NoteGraphNode[],
  noteTagNameById: Map<string, string>,
  bookTagNameById: Map<string, string>
): NoteGroup[] {
  const byNoteTag = new Map<string, { label: string; members: NoteGraphNode[] }>();
  const byBookTag = new Map<string, { label: string; members: NoteGraphNode[] }>();
  const byAuthor = new Map<string, { label: string; members: NoteGraphNode[] }>();

  nodes.forEach((node) => {
    node.tagIds.forEach((tagId) => {
      const label = noteTagNameById.get(tagId);
      if (!label) return;
      const entry = byNoteTag.get(tagId) ?? { label, members: [] };
      entry.members.push(node);
      byNoteTag.set(tagId, entry);
    });

    node.bookTagIds.forEach((tagId) => {
      const label = bookTagNameById.get(tagId);
      if (!label) return;
      const entry = byBookTag.get(tagId) ?? { label, members: [] };
      entry.members.push(node);
      byBookTag.set(tagId, entry);
    });

    if (node.bookAuthor) {
      const key = node.bookAuthor.toLowerCase().trim();
      const entry = byAuthor.get(key) ?? { label: node.bookAuthor.trim(), members: [] };
      entry.members.push(node);
      byAuthor.set(key, entry);
    }
  });

  const groups: NoteGroup[] = [];

  const collect = (map: Map<string, { label: string; members: NoteGraphNode[] }>, reason: NoteGroupReason) => {
    map.forEach((entry, key) => {
      const distinctBooks = new Set(entry.members.map((m) => m.bookId));
      if (entry.members.length < 2 || distinctBooks.size < 2) return;
      groups.push({
        id: `${reason}:${key}`,
        reason,
        label: entry.label,
        memberIds: entry.members.map((m) => m.id),
      });
    });
  };

  collect(byNoteTag, "note-tag");
  collect(byBookTag, "tag");
  collect(byAuthor, "author");

  return groups.sort((a, b) => b.memberIds.length - a.memberIds.length);
}

/** Maps noteId -> how many groups (besides whichever are currently selected) it also belongs to. */
export function computeOtherGroupCounts(groups: NoteGroup[], excludeGroupIds?: Set<string> | null): Map<string, number> {
  const counts = new Map<string, number>();
  groups.forEach((group) => {
    if (excludeGroupIds?.has(group.id)) return;
    group.memberIds.forEach((id) => {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
  });
  return counts;
}
