import { Fragment, type ReactNode } from 'react';
import type { ReportContent, ReportSection, SubjectLevel } from '@/lib/reports/types';
import { REPORT_V2_SECTIONS } from '@/lib/reports/types';
import { STATUS_LABEL, formatIssued } from '@/lib/reports/generate';
import { reportFontVars } from './reportFonts';
import s from './ReportCard.module.css';

// The one report renderer (spec: "Two views share one report renderer").
// Used by the parent page /r/[token], the staff editor's live preview and
// the /r/print page headless Chrome turns into the PDF. No hooks, so it
// renders as a server component too. Everything it shows comes from the
// revision's content snapshot - never from live learner/template rows.

type Props = {
  content: ReportContent;
  mode?: 'web' | 'print';
  theme?: 'auto' | 'light';
  footer?: ReactNode;
  // Staff draft preview: diagonal DRAFT watermark (repeated on every printed
  // page) and a header label, so a draft PDF can't pass for the final one.
  draft?: boolean;
};

function LevelCard({ level }: { level: SubjectLevel }) {
  const top = level.rank >= level.max_rank;
  const lit = Math.max(1, Math.min(3, 3 - (level.max_rank - level.rank)));
  return (
    <div className={s.lvl}>
      <span className={s.mono}>{level.subject_label}</span>
      <span className={`${s.pill} ${top ? s.pillEx : s.pillGood}`}>{level.level_label}</span>
      <div className={`${s.leds} ${top ? s.ledsEx : s.ledsGood}`} aria-hidden>
        {[0, 1, 2].map(i => <i key={i} className={i < lit ? s.on : undefined} />)}
      </div>
    </div>
  );
}

function Strength({ section }: { section: ReportSection }) {
  const f = section.fields;
  return (
    <div className={s.strength}>
      {f.title && <h3>{f.title}</h3>}
      {f.body && <p>{f.body}</p>}
      {f.bigger_picture && (
        <div className={s.bp}>
          <span className={s.mono}>The bigger picture</span>
          <p>{f.bigger_picture}</p>
        </div>
      )}
    </div>
  );
}

function Assessed({ content, print }: { content: ReportContent; print: boolean }) {
  const body = (
    <div className={s.rubric}>
      {content.assessed.map(block => (
        <div key={block.subject}>
          <h4>{block.subject_label} · {block.level_label}</h4>
          <dl>
            {block.items.map(item => (
              <Fragment key={item.area_key}>
                <dt>{item.area_label}</dt>
                <dd>{item.descriptor}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
  if (print) return body;
  return (
    <details className={s.details}>
      <summary>Rubric descriptors at {content.learner.first_name}&apos;s level</summary>
      {body}
    </details>
  );
}

export default function ReportCard({ content, mode = 'web', theme = 'auto', footer, draft = false }: Props) {
  const print = mode === 'print';
  const name = content.learner.first_name;
  const strengths = content.sections.filter(x => x.type === 'strength');
  const growth = content.sections.find(x => x.type === 'growth');
  const note = content.sections.find(x => x.type === 'learner_note');
  const next = content.sections.find(x => x.type === 'whats_next');
  const facilitator = content.sections.find(x => x.type === 'facilitator_note' && x.fields.text?.trim());
  const k = content.lessons_to_catch_up;

  const assessedSection = (
    <section className={s.sec}>
      <span className={`${s.mono} ${s.label}`}>What we assessed</span>
      <Assessed content={content} print={print} />
    </section>
  );

  return (
    <div className={`${s.root} ${reportFontVars} ${print ? s.print : ''} ${theme === 'light' ? s.light : ''}`}>
      {draft && <div className={s.watermark} aria-hidden><span>DRAFT</span></div>}
      <article className={s.report}>
        <header className={s.head}>
          <div className={`${s.brand} ${s.mono}`}><b>RAD Academy</b><span>{draft ? 'Draft · not final' : 'Progress report'}</span></div>
          <h1>{name}</h1>
          <p>{content.programme.line} · issued {formatIssued(content.issued_on)}</p>
        </header>

        <section className={s.sec}>
          <span className={`${s.mono} ${s.label}`}>Skill levels</span>
          <div className={s.levels}>
            {content.levels.map(l => <LevelCard key={l.subject} level={l} />)}
          </div>
        </section>

        {strengths.length > 0 && (
          <section className={s.sec}>
            <span className={`${s.mono} ${s.label}`}>Strengths</span>
            {strengths.map((x, i) => (
              <Fragment key={x.id}>
                {i > 0 && <div className={s.divider} />}
                <Strength section={x} />
              </Fragment>
            ))}
          </section>
        )}

        {growth && (
          <section className={s.sec}>
            <span className={`${s.mono} ${s.label}`}>Area to grow</span>
            <div className={s.grow}>
              {growth.fields.title && <h3>{growth.fields.title}</h3>}
              {growth.fields.now && <p>{growth.fields.now}</p>}
              {growth.fields.next && <p>{growth.fields.next}</p>}
            </div>
            {REPORT_V2_SECTIONS && growth.fields.home && (
              <div className={s.home}><b>Try this at home.</b> {growth.fields.home}</div>
            )}
          </section>
        )}

        {REPORT_V2_SECTIONS && (
          <section className={s.sec}>
            <span className={`${s.mono} ${s.label}`}>Lesson progress</span>
            <div className={s.trackRow}>
              <span><span className={s.big}>{k}</span> lesson{k === 1 ? '' : 's'} to catch up</span>
              <span className={`${s.status} ${content.status === 'on_track' ? s.statusOn : s.statusCatch}`}>{STATUS_LABEL[content.status]}</span>
            </div>
          </section>
        )}

        {!print && assessedSection}

        {note?.fields.text && (
          <section className={s.sec}>
            <span className={`${s.mono} ${s.label}`}>A note for {name}</span>
            <p className={s.kid}>{note.fields.text}</p>
          </section>
        )}

        {next?.fields.text && (
          <section className={s.sec}>
            <span className={`${s.mono} ${s.label}`}>What&apos;s next</span>
            <p>{next.fields.text}</p>
          </section>
        )}

        {facilitator && (
          <section className={s.sec}>
            <span className={`${s.mono} ${s.label}`}>From your facilitator</span>
            <p className={s.facilitator}>{facilitator.fields.text}</p>
          </section>
        )}

        {print && assessedSection}
      </article>
      {footer}
    </div>
  );
}
