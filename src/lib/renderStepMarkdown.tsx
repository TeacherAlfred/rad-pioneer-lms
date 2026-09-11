import { Fragment, type ReactNode } from "react";

// Tutorial Hub step instructions support a small, inline-only subset of
// markdown (**bold**, *italic*/_italic_, `code`, [text](url)) - no
// dependency added, since steps are meant to be a glance, not a document
// (spec S2: "a step should be readable in a glance"). Block-level markdown
// (headings, lists, tables) is deliberately unsupported for the same
// reason. Line breaks in the source text become paragraph breaks.
const INLINE_TOKEN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(_[^_]+_|\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;

function renderLine(line: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  INLINE_TOKEN.lastIndex = 0;
  while ((match = INLINE_TOKEN.exec(line))) {
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index));

    const [full, code, bold, italic, link] = match;
    const key = `${keyPrefix}-${i++}`;
    if (code) {
      nodes.push(<code key={key} className="bg-slate-100 text-slate-800 rounded px-1.5 py-0.5 text-[0.9em] font-mono">{code.slice(1, -1)}</code>);
    } else if (bold) {
      nodes.push(<strong key={key} className="font-bold">{bold.slice(2, -2)}</strong>);
    } else if (italic) {
      nodes.push(<em key={key}>{italic.slice(1, -1)}</em>);
    } else if (link) {
      const linkMatch = link.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (linkMatch) {
        nodes.push(<a key={key} href={linkMatch[2]} target="_blank" rel="noreferrer" className="text-rad-blue underline underline-offset-2">{linkMatch[1]}</a>);
      } else {
        nodes.push(full);
      }
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < line.length) nodes.push(line.slice(lastIndex));
  return nodes;
}

export function renderStepMarkdown(text: string): ReactNode {
  const lines = (text || "").split("\n").filter((l, i, arr) => l.trim() !== "" || (i > 0 && i < arr.length - 1));
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {renderLine(line, String(i))}
        </Fragment>
      ))}
    </>
  );
}
