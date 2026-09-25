import { Fragment } from 'react';
import s from '@/app/labs/[slug]/rad-lab.module.css';

// Renders LabContent rich strings. Four inline tokens, no nesting:
//   **bold**   _emphasis_   ==highlighted concept==   [text](https://url)
// Anything else is plain text - content never carries HTML. Links always
// open in a new tab (they point at external tools like MakeCode).
const TOKEN = /(\*\*[^*]+\*\*|==[^=]+==|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|_[^_]+_)/g;
const LINK = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/;

export function Rich({ text }: { text: string }) {
  const parts = (text || '').split(TOKEN).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('==') && part.endsWith('==') && part.length > 4) return <mark key={i} className={s.concept}>{part.slice(2, -2)}</mark>;
        const link = part.match(LINK);
        if (link) {
          return (
            <a key={i} className={s.inlineLink} href={link[2]} target="_blank" rel="noopener noreferrer">
              {link[1]}<span aria-hidden="true"> ↗</span><span className={s.srOnly}> (opens in a new tab)</span>
            </a>
          );
        }
        if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) return <em key={i}>{part.slice(1, -1)}</em>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
