// Seeds the bot_flows rows for the warm-list menu restructure
// (RAD_Academy_Dev_Spec_Warm-List_Menu_Voucher_Attribution.md §1).
//
// Content flagged TODO below (event date/time, running-club identifiers)
// is a placeholder lifted straight from the spec - edit it from
// /admin/bot-flows after seeding, same as any other flow. Idempotent:
// upserts on trigger_button_id, safe to re-run.
//
// Usage:
//   node scripts/seed-warmlist-menu.mjs             (dry run, prints rows)
//   node scripts/seed-warmlist-menu.mjs --commit     (writes to Supabase)

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const COMMIT = process.argv.includes('--commit');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// §1.1 Message 1 buttons: "Get the Guide" reuses whatever bot_flows row
// already handles btn_guide (existing bot_media flow) - not touched here.
// "What's On" and "Talk to Us" are new trigger ids this menu introduces;
// they need to be entered as the quick-reply button payloads on Message 1's
// Meta template once that template is submitted/approved (not something
// this script or any code change can do - template creation is manual, in
// Meta Business Manager).
const rows = [
  {
    trigger_button_id: 'btn_whats_on',
    label: "Warm-list: What's On menu",
    action_type: 'message',
    message_body: "Here's what's coming up — tap what suits you:",
    message_buttons: [
      { id: 'btn_whatson_webinar', title: '🖥️ Online Webinar' },
      { id: 'btn_whatson_pretoria', title: '🏛️ Pretoria' },
      { id: 'btn_whatson_polokwane', title: '📍 Polokwane' },
    ],
    skip_human_handoff: true,
    notify_admin: false,
    notify_admin_immediate: false,
  },
  {
    // §1.3: with only three top-level buttons, this is now the explicit
    // human-ask - instant ping + SLA clock, not the buffered default.
    trigger_button_id: 'btn_talk_human',
    label: 'Warm-list: Talk to Us',
    action_type: 'message',
    message_body: 'Got it! 👤 One of our educators will be in touch with you shortly.',
    message_buttons: [],
    skip_human_handoff: false,
    notify_admin: true,
    notify_admin_immediate: true,
  },
  {
    trigger_button_id: 'btn_whatson_webinar',
    label: "Warm-list What's On: Online Webinar",
    action_type: 'message',
    // TODO: replace [date/time] with the actual next session before going live.
    message_body: 'Our next live session is [date/time] — 45 minutes, hands-on, from anywhere. Want me to hold you a spot?',
    message_buttons: [{ id: 'btn_wl_register_webinar', title: '✅ Register Me' }],
    set_source: 'warm_list_whats_on_webinar',
    skip_human_handoff: true,
    notify_admin: false,
  },
  {
    trigger_button_id: 'btn_whatson_pretoria',
    label: "Warm-list What's On: Pretoria",
    action_type: 'message',
    // TODO: replace [dates] with the actual session dates before going live.
    message_body: 'Robotics Sessions coming up: [dates]. Real hardware, small groups. Want to hold a seat?',
    message_buttons: [{ id: 'btn_wl_hold_pretoria', title: '✅ Hold My Spot' }],
    set_source: 'warm_list_whats_on_pretoria',
    skip_human_handoff: true,
    notify_admin: false,
  },
  {
    trigger_button_id: 'btn_whatson_polokwane',
    label: "Warm-list What's On: Polokwane",
    action_type: 'message',
    message_body: 'Two-day Robotics Circuit — 3 & 4 October, right before Term 4 starts. Want to hold a seat?',
    message_buttons: [{ id: 'btn_wl_hold_polokwane', title: '✅ Hold My Spot' }],
    set_source: 'warm_list_whats_on_polokwane',
    skip_human_handoff: true,
    notify_admin: false,
  },
  // §1.2 CTA taps: these are meant to "drop straight into the existing
  // structured-ask flow" per the spec, which doesn't exist yet (no
  // name/email/children+ages wizard, no 48h hold/quote_sent pipeline - see
  // the track-1/track-2 split discussed before this build). As an interim
  // stand-in, reuse the existing single-question expects_reply capture so a
  // tap still produces a real, admin-visible lead_notes entry instead of
  // silently falling to the generic handoff. Replace with the real
  // structured intake once that pipeline is built.
  {
    trigger_button_id: 'btn_wl_register_webinar',
    label: 'Warm-list CTA: Register for Webinar (interim capture)',
    action_type: 'message',
    message_body: "Great! To lock in your spot, reply with your name, email, and your child's name + age — I'll pass it straight to the team.",
    message_buttons: [],
    skip_human_handoff: true,
    notify_admin: false,
    expects_reply: true,
    reply_label: 'Webinar registration (name/email/child+age)',
    reply_confirmation: "Thanks! I've passed your details to the team — they'll confirm your spot shortly. 🎉",
    completion_tag: 'webinar_registration_requested',
  },
  {
    trigger_button_id: 'btn_wl_hold_pretoria',
    label: 'Warm-list CTA: Hold Seat, Pretoria (interim capture)',
    action_type: 'message',
    message_body: "Awesome! Reply with your name, email, and your child's name + age, and I'll hold your seat while the team confirms.",
    message_buttons: [],
    skip_human_handoff: true,
    notify_admin: false,
    expects_reply: true,
    reply_label: 'Pretoria seat hold (name/email/child+age)',
    reply_confirmation: "Thanks! I've passed your details to the team — they'll confirm your seat shortly. 🎉",
    completion_tag: 'pretoria_seat_requested',
  },
  {
    trigger_button_id: 'btn_wl_hold_polokwane',
    label: 'Warm-list CTA: Hold Seat, Polokwane (interim capture)',
    action_type: 'message',
    message_body: "Awesome! Reply with your name, email, and your child's name + age, and I'll hold your seat while the team confirms.",
    message_buttons: [],
    skip_human_handoff: true,
    notify_admin: false,
    expects_reply: true,
    reply_label: 'Polokwane seat hold (name/email/child+age)',
    reply_confirmation: "Thanks! I've passed your details to the team — they'll confirm your seat shortly. 🎉",
    completion_tag: 'polokwane_seat_requested',
  },
];

console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} - ${rows.length} bot_flows rows to upsert:\n`);
for (const r of rows) {
  console.log(`  ${r.trigger_button_id} -> "${r.label}"`);
}

if (!COMMIT) {
  console.log('\nDry run only - pass --commit to write these to Supabase.');
  process.exit(0);
}

const { data, error } = await supabase
  .from('bot_flows')
  .upsert(
    rows.map(r => ({
      action_type: r.action_type,
      message_buttons: [],
      template_variables: [],
      template_variable_names: [],
      template_button_payloads: [],
      add_tags: [],
      notify_admin: false,
      notify_admin_immediate: false,
      expects_reply: false,
      active: true,
      ...r,
    })),
    { onConflict: 'trigger_button_id' }
  )
  .select();

if (error) {
  console.error('❌ Seed failed:', error.message);
  process.exit(1);
}
console.log(`\n✅ Upserted ${data.length} rows.`);
