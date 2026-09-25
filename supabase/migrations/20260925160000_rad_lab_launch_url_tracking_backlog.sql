-- Backlog item: track opens of the URL button on the rad_lab_launch template.
-- A URL button sends no webhook event back when tapped (only quick-reply
-- buttons do), so it can't route to a bot flow - tracking needs a
-- redirect/UTM link or a paired quick-reply button.

insert into system_checklist_items (system_key, label, state, notes, sort_order)
select v.system_key, v.label, v.state, v.notes, v.sort_order
from (values
  ('rad_labs', 'Track URL opens for the rad_lab_launch template', 'not_started', 'Template is under Meta review. Its URL button fires no webhook on tap, so bot flows never see it. Options: tracked redirect/UTM link on the site, or add a quick-reply button alongside the URL button (Meta groups quick replies together).', 10)
) as v(system_key, label, state, notes, sort_order)
where exists (select 1 from systems_status where key = 'rad_labs')
  and not exists (
    select 1 from system_checklist_items existing
    where existing.system_key = v.system_key and existing.label = v.label
  );
