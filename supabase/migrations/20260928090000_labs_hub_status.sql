-- Systems Status: the /labs hub page shipped. The old checklist item bundled
-- it with the /labs vs /tutorials decision, which is still open - close the
-- page, and carry the decision (plus series grouping) as their own items.
update system_checklist_items
set state = 'done',
    label = '/labs hub page',
    notes = 'Flat list of every published lab (series order, then lab number) with per-device progress read from the step slider''s localStorage, a "pick up where you left off" banner, coming-soon series and a how-it-works strip. Lab pages link back via the nav + footer. Publishing a lab revalidates /labs.',
    updated_at = now()
where system_key = 'rad_labs' and label = '/labs index page + decision on /labs vs /tutorials overlap';

insert into system_checklist_items (system_key, label, state, notes, sort_order)
select v.system_key, v.label, v.state, v.notes, v.sort_order
from (values
  ('rad_labs', 'Decide /labs vs /tutorials overlap', 'not_started', 'Both cover MakeCode. Decide whether Labs link into / supersede the Tutorial Hub.', 11),
  ('rad_labs', 'Group the /labs hub by series', 'not_started', 'Hub is one flat list while there are few labs. Once labs grow, render one section per series (labsInSeries already groups them) in src/app/labs/page.tsx.', 12)
) as v(system_key, label, state, notes, sort_order)
where exists (select 1 from systems_status where key = 'rad_labs')
  and not exists (
    select 1 from system_checklist_items existing
    where existing.system_key = v.system_key and existing.label = v.label
  );
