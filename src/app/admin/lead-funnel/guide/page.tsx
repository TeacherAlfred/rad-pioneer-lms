"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft, GitBranch, MessageSquare, ClipboardList, FileText, Send,
  Users, Users2, Tag, StickyNote, GraduationCap, Megaphone, Layers, AlertTriangle, BellOff,
} from "lucide-react";

// Reference/help content only - no data fetching. Written to answer "how
// does this actually work right now", not to restate the aspirational
// spec (RAD_Lead_Stages_and_Followup_Spec.md) as if all of it were built.
// Every "Not built yet" marker below was checked against the live code
// and live data on 2026-08-18, not assumed from the spec.

function Section({ id, icon: Icon, title, blurb, defaultOpen, children }: {
  id: string; icon: any; title: string; blurb: string; defaultOpen?: boolean; children: ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} className="bg-white rounded-2xl border border-slate-200 overflow-hidden group scroll-mt-6">
      <summary className="cursor-pointer list-none px-5 py-4 flex items-center gap-3 hover:bg-slate-50">
        <Icon size={18} className="text-slate-400 shrink-0" />
        <div className="min-w-0">
          <div className="font-black text-slate-800">{title}</div>
          <div className="text-xs text-slate-400 truncate">{blurb}</div>
        </div>
        <span className="ml-auto text-slate-300 text-xs shrink-0 group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-5 pb-5 pt-1 space-y-3 text-sm text-slate-600 border-t border-slate-100">
        {children}
      </div>
    </details>
  );
}

function Gap({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs bg-amber-50 text-amber-700 rounded-lg px-3 py-2">
      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
      <span><b>Not built yet:</b> {children}</span>
    </div>
  );
}

function Field({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <code className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0 h-fit">{name}</code>
      <span className="text-slate-500">{desc}</span>
    </div>
  );
}

const CONTENTS = [
  { id: 'overview', label: 'Why four separate things, not one "status"' },
  { id: 'entry', label: 'How a lead enters the funnel' },
  { id: 'stages', label: 'Lifecycle stages' },
  { id: 'activities', label: 'Contact outcomes (lead_activities)' },
  { id: 'customer', label: 'Customer status' },
  { id: 'bot-flows', label: 'Bot Flows' },
  { id: 'notifications', label: 'Notification buffering & Do Not Disturb' },
  { id: 'bot-media', label: 'Bot Media' },
  { id: 'templates', label: 'Meta templates & the 24hr window' },
  { id: 'households', label: 'Households' },
  { id: 'annotations', label: 'Tags, Notes, Potential Student' },
  { id: 'ads', label: 'Ad attribution' },
  { id: 'stages-dashboard', label: 'Funnel Stages dashboard' },
  { id: 'message-activity', label: 'Message Activity dashboard' },
  { id: 'table', label: 'The Lead Funnel table itself' },
  { id: 'warm-list', label: 'Warm List import' },
  { id: 'roadmap', label: "What's not built yet (full list)" },
];

export default function LeadFunnelGuidePage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/admin/lead-funnel" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 mb-4">
          <ArrowLeft size={14} /> Lead Funnel
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">How the Lead Funnel Works</h1>
          <p className="text-sm text-slate-500 mt-1">
            A practical reference for everything under Lead Funnel - what each piece does, how they connect, and honestly, what's designed but not built yet. Click a section to expand it.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Contents</h3>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
            {CONTENTS.map(c => (
              <a key={c.id} href={`#${c.id}`} className="text-xs text-slate-500 hover:text-slate-800 hover:underline">{c.label}</a>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Section id="overview" icon={Layers} title='Why four separate things, not one "status"' defaultOpen
            blurb="lifecycle_stage, contact outcome, is_customer, engagement recency - each on its own clock.">
            <p>
              Before this, everything lived in one <code className="bg-slate-100 px-1 rounded">status</code> field, and questions like <i>"does contacted become no_response?"</i> had no good answer - not because it was hard, but because the question didn't make sense. A single field was doing four unrelated jobs.
            </p>
            <p>Each lead now sits in one value on each of four independent axes, simultaneously:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Lifecycle stage</b> - where they are toward the <i>next</i> purchase. Moves forward and back.</li>
              <li><b>Contact outcome</b> - the result of the most recent outreach attempt. Overwritten each attempt, logged as its own row.</li>
              <li><b>Customer status</b> - have they ever paid. <b>Never regresses</b>, even years later.</li>
              <li><b>Engagement recency</b> - how warm they are right now. Meant to be computed automatically.</li>
            </ul>
            <Gap>The computation exists (a nightly cron at <code className="bg-slate-100 px-1 rounded">/api/lead-funnel/cron</code> turns "days since last inbound" into active/cooling/dormant/cold, plus per-stage health) but as of 2026-08-18 there's no confirmed evidence it's actually being triggered in production - most likely <code className="bg-slate-100 px-1 rounded">CRON_SECRET</code> isn't set in the real deploy environment yet, only locally. Both values are visible per-lead in the edit panel once this is wired up; until then they reflect whenever a migration last recomputed them, not "right now."</Gap>
          </Section>

          <Section id="entry" icon={Users2} title="How a lead enters the funnel"
            blurb="WhatsApp inbound, Irene voting consent, or a Warm List import commit.">
            <ul className="list-disc pl-5 space-y-1">
              <li><b>WhatsApp inbound</b> - a new phone number messaging the bot creates a lead at stage <code className="bg-slate-100 px-1 rounded">new</code>. <code className="bg-slate-100 px-1 rounded">leads.phone</code> is unique, so a race between two near-simultaneous first messages can't create duplicates.</li>
              <li><b>Irene voting consent form</b> - a parent who consents to marketing on the voting page creates a lead the same way, tagged <code className="bg-slate-100 px-1 rounded">source: irene_ips</code>.</li>
              <li><b>Warm List commit</b> - see the Warm List section below. Never overwrites an existing lead's stage.</li>
            </ul>
            <p>Once created, a lead's <i>first</i> inbound message doesn't move them off <code className="bg-slate-100 px-1 rounded">new</code> - that message is what created the record. Any inbound message <i>after</i> that auto-advances <code className="bg-slate-100 px-1 rounded">new → engaged</code>. A lead auto-closed as <code className="bg-slate-100 px-1 rounded">lost</code> with reason <code className="bg-slate-100 px-1 rounded">auto_expired</code> would also reopen to <code className="bg-slate-100 px-1 rounded">engaged</code> on any new inbound - though see the Roadmap section, nothing sets that reason yet, so this reopening logic is currently dormant.</p>
          </Section>

          <Section id="stages" icon={GitBranch} title="Lifecycle stages"
            blurb="new → engaged → qualified → offered → won / re_nurture / lost / opted_out.">
            <div className="space-y-2">
              <Field name="new" desc="Just created. Nothing's happened yet." />
              <Field name="engaged" desc="Replied, or receiving nurture. Set automatically on a lead's second+ inbound message." />
              <Field name="qualified" desc="Asked about a specific session or price. Manual only - nothing detects this from conversation content." />
              <Field name="offered" desc="A quote was sent, a seat held. Manual only." />
              <Field name="won" desc="Paid. Sets is_customer permanently - see Customer Status below." />
              <Field name="re_nurture" desc="Past customer, or expired interest. Manual only." />
              <Field name="lost" desc="Explicit no, or auto-closed. Requires typing a reason - enforced both in the UI and the API." />
              <Field name="opted_out" desc="POPIA withdrawal. Also flips leads.opted_out to true. Terminal - reactive replies only." />
            </div>
            <p>Every stage change writes a row to <code className="bg-slate-100 px-1 rounded">lead_stage_history</code> (who, when, from, to, why) - that's what the Funnel Stages dashboard's time-in-stage and messages-to-advance numbers are computed from.</p>
            <Gap>Stall thresholds (e.g. offered stalls after 48 hours, matching the seat-hold window) are read by the nightly cron and surfaced as a stage-health badge in the edit panel - but see the roadmap section for why that cron isn't confirmed to actually be running in production yet.</Gap>
            <Gap>Auto-moving a qualified/offered lead to re_nurture the day after their tracked session passes unpaid is built (checks <code className="bg-slate-100 px-1 rounded">interested_session_id</code> against the session's date and attendance) - same "is the cron actually running" caveat.</Gap>
          </Section>

          <Section id="activities" icon={MessageSquare} title="Contact outcomes (lead_activities)"
            blurb="Contacted / No Response / Follow-up Set - logged as attempts, never move lifecycle_stage.">
            <p>
              Every WhatsApp pipeline alert you get (new lead, guide downloaded, button tapped, etc.) carries three buttons: <b>Contacted</b>, <b>No Response</b>, <b>Follow-up Set</b>. Tapping one writes a row to <code className="bg-slate-100 px-1 rounded">lead_activities</code> (channel, direction, outcome, who logged it) and clears <code className="bg-slate-100 px-1 rounded">needs_human</code> - it does <b>not</b> touch the lead's lifecycle stage. A lead can be "Contacted" five times while still sitting at <code className="bg-slate-100 px-1 rounded">qualified</code>, and that's correct - the outcome and the stage are different questions. A bot_flow marked "expects a reply" (see Bot Flows below) also writes here once the reply is captured.
            </p>
            <p>Visible per-lead as a chronological feed in the edit panel (pencil icon) on the Lead Funnel table, alongside lifecycle stage, customer status, and engagement recency - the closest thing to a consolidated "all four axes at once" view today. There's still no dedicated page to browse contact-attempt history <i>across</i> every lead at once.</p>
          </Section>

          <Section id="customer" icon={GraduationCap} title="Customer status"
            blurb="is_customer, first_purchase_at, last_purchase_at - set once at won, never regresses.">
            <p>
              Moving a lead to <code className="bg-slate-100 px-1 rounded">won</code> sets <code className="bg-slate-100 px-1 rounded">is_customer = true</code> permanently, stamps <code className="bg-slate-100 px-1 rounded">first_purchase_at</code> (only the first time) and <code className="bg-slate-100 px-1 rounded">last_purchase_at</code> (every time). A two-year-old customer stays <code className="bg-slate-100 px-1 rounded">is_customer: true</code> forever, even after their lifecycle stage moves on to <code className="bg-slate-100 px-1 rounded">re_nurture</code> for the next thing. This is the field that makes "existing customer buying again" distinguishable from "brand new lead" - the exact diagnosis that started this whole redesign. Visible per-lead in the edit panel as "Customer since &lt;date&gt;".
            </p>
            <Gap>No lifetime_value tracking yet - is_customer is a yes/no, not a running total.</Gap>
          </Section>

          <Section id="bot-flows" icon={GitBranch} title="Bot Flows"
            blurb="Admin-configured automated responses keyed by button id - /admin/bot-flows">
            <p>Every button tap in this system - from the welcome message, from a bot_media document, from another flow's own buttons, or from a Meta template's quick-reply button - is looked up by its id against <code className="bg-slate-100 px-1 rounded">bot_flows.trigger_button_id</code>. No button behavior is hardcoded in the webhook anymore; if there's no matching row, the tap falls through to a generic "an educator will be in touch" handoff.</p>
            <p>Three action types:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Message</b> - a freeform send, optionally with up to 3 of its own buttons. Those buttons' ids can be <i>another flow's</i> trigger id, which is how multi-step menus chain (e.g. "What's On" → pick a city → "Hold My Spot") without any code change per step.</li>
              <li><b>Template</b> - fires an approved Meta template, with {'{{column}}'} auto-fill from the lead's own row and optional button-payload overrides.</li>
              <li><b>Bot Media</b> - delivers a file, picked from a dropdown of real <code className="bg-slate-100 px-1 rounded">bot_media</code> items (not free text), so the flow can't reference a keyword that doesn't actually match anything.</li>
            </ul>
            <p>Any flow can also: stamp <code className="bg-slate-100 px-1 rounded">source</code> on the lead (attribution - which flow actually converts), add tags, notify you when it fires, choose whether it stays self-serve or still flags <code className="bg-slate-100 px-1 rounded">needs_human</code>, and mark that it <b>expects a reply</b> - the lead's next freeform message gets captured as a note instead of falling into the generic welcome, with a configurable confirmation and an optional tag once captured.</p>
            <p className="text-xs text-slate-400">Historical note: the "Get Free Guide" button used to be hardcoded directly in the webhook file. It's now just a regular Bot Media-type flow, same as anything else you'd configure.</p>
          </Section>

          <Section id="notifications" icon={BellOff} title="Notification buffering & Do Not Disturb"
            blurb="/admin/lead-funnel/notifications - batch pipeline alerts into one message per lead, plus quiet hours.">
            <p>
              A brand-new lead, a POPIA opt-out, and a bot_media delivery failure still ping you immediately - those are the only three. Everything else a lead does (button taps, media downloads, bot_flow fires, reply captures) writes a row to <code className="bg-slate-100 px-1 rounded">admin_notification_buffer</code> instead of sending right away.
            </p>
            <p>
              The window is <b>fixed per lead</b>: it starts on that lead's first buffered action and always flushes exactly <i>N</i> minutes later (set on the settings page), no matter how many more actions they take in between - it can't be pushed back indefinitely by someone tapping through a menu quickly. When it flushes, you get <b>one message for that lead</b> listing everything they did, with the same Contacted/No Response/Follow-up Set buttons a single-event alert has today. A different lead's actions never get mixed into the same message.
            </p>
            <p>
              <b>Do Not Disturb</b> hours hold back <i>everything</i>, including the three immediate-tier alerts - nothing sends during the window, and whatever accumulated flushes the moment it ends.
            </p>
            <Gap>The flush is driven by an external scheduler hitting <code className="bg-slate-100 px-1 rounded">GET /api/lead-funnel/notify-flush</code> (authenticated via the <code className="bg-slate-100 px-1 rounded">WABA_API</code> env var as a bearer token) - specifically a cron-job.org job, not Vercel Cron, since Vercel's Hobby tier only allows daily cron jobs, too coarse for a 5-10 minute buffer. If that external job isn't configured or stops running, buffered messages accumulate in the database but never actually send - this page has no way to detect that from inside the app.</Gap>
          </Section>

          <Section id="bot-media" icon={FileText} title="Bot Media"
            blurb="Files the bot can deliver, matched by keyword - /admin/bot-media">
            <p>PDFs and other files the bot can send, each with one or more trigger keywords. A lead typing "guide" is matched the same way a Bot Flows keyword-based flow is - by searching active <code className="bg-slate-100 px-1 rounded">bot_media</code> rows for a keyword match.</p>
            <p>A <code className="bg-slate-100 px-1 rounded">tag_filter</code> lets the same keyword resolve to a different file for a specific audience (e.g. a lead tagged "Irene Primary" gets a different guide than everyone else) - the tagged version wins over the generic one when the lead actually has that tag.</p>
            <p><b>Deactivate</b> (temporarily stop matching), <b>Archive</b> (also deactivates, and hides it from being picked as a new Bot Flows target), and <b>Delete</b> (permanent) are three different actions - archiving is the safe default if you might reuse it.</p>
          </Section>

          <Section id="templates" icon={Send} title="Meta templates & the 24-hour window"
            blurb="Only way to message someone outside the customer-service window - button payloads are a send-time setting.">
            <p>WhatsApp only allows freeform (non-template) messages within 24 hours of that number last messaging you. Outside that window, only a pre-approved template gets through. Templates get sent from two places: manually, via Lead Funnel's <b>Send Template</b> bulk action, or automatically, from a Bot Flows row with action type Template.</p>
            <p>A quick-reply button's <b>payload</b> - the value that comes back when it's tapped - can only be set when you actually send the templated message, never when the template itself was created in Meta Business Manager. That's why both the Send Template modal and the Bot Flows template form show a payload dropdown once you pick a template: set a button's payload to a real trigger id (e.g. <code className="bg-slate-100 px-1 rounded">btn_events</code>) and tapping it routes through Bot Flows exactly like any other button.</p>
          </Section>

          <Section id="households" icon={Users2} title="Households"
            blurb="Group 2+ leads (e.g. both parents) for counting, without merging their records.">
            <p>Select 2 or more leads on the Lead Funnel table and click <b>Link as Household</b>. Each lead keeps its own independent conversation, stage, and history - linking only groups them for counting (the "Households" stat is the de-duped "how many actual families" number, separate from raw "Total Leads") and for display, via a badge under their name.</p>
          </Section>

          <Section id="annotations" icon={Tag} title="Tags, Notes, Potential Student"
            blurb="Manual admin annotations - opened via the pencil icon on a lead's name.">
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Tags</b> - free-form, a lead can carry several at once. Used both for real categorization (e.g. "Irene Primary", "Referral") and for one bit of system mechanics: a lead tagged <code className="bg-slate-100 px-1 rounded">Inhouse</code> (test/staff/teacher accounts) is excluded from every stat on Lead Funnel and Funnel Stages, though it stays in the database and can be shown again via the "Show inhouse" filter toggle.</li>
              <li><StickyNote size={11} className="inline -mt-0.5" /> <b>Notes</b> - a running timestamped log (location, feedback from a call). Distinct from lead_activities above - notes are free-text and admin-written, activities are structured outcome logs.</li>
              <li><GraduationCap size={11} className="inline -mt-0.5" /> <b>Potential Student</b> - flags a lead who is themselves within RAD's student age range, not a parent enquiring for a child. Doesn't create a Kids record on its own, since attending still needs a guardian's consent.</li>
            </ul>
          </Section>

          <Section id="ads" icon={Megaphone} title="Ad attribution"
            blurb="ad_id / ad_headline / ctwa_clid - captured first-touch only.">
            <p>When someone messages via a click-to-WhatsApp ad, Meta attaches a referral object to that first message. It's captured onto the lead at creation time only - never overwritten if they later click a different ad - so it always reflects which ad actually brought them in, not the most recent one they happened to click. Visible as a badge on the Source column, and its own breakdown chart on Lead Funnel.</p>
          </Section>

          <Section id="stages-dashboard" icon={GitBranch} title="Funnel Stages dashboard"
            blurb="/admin/lead-funnel/stages - counts per stage, time in stage, messages to advance.">
            <p>Shows a bar per lifecycle stage (how many leads are there now), average days in stage for leads currently there, and average messages it took to move a lead <i>out</i> of that stage - computed only from leads who've actually completed that stage, so "no data yet" is normal until enough leads move through one. The per-lead table lets you change anyone's stage directly via a dropdown (moving to Lost requires typing a reason).</p>
          </Section>

          <Section id="message-activity" icon={MessageSquare} title="Message Activity dashboard"
            blurb="/admin/lead-funnel/messages - every send and every button tap, parsed from `messages`.">
            <p>Every outbound send and inbound button tap is already logged into <code className="bg-slate-100 px-1 rounded">messages</code> as plain bracketed text (e.g. <code className="bg-slate-100 px-1 rounded">[Delivered template: X]</code>) - this page parses that back into delivered/failed counts, a by-type breakdown, button-tap engagement, reply rate, and template performance by name.</p>
          </Section>

          <Section id="table" icon={Users} title="The Lead Funnel table itself"
            blurb="Status, Source, Tags, Created, Last Sent, Inhouse - filters, sort, bulk select.">
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Status</b> column - the lifecycle stage pill, plus a "Needs Reply" badge if <code className="bg-slate-100 px-1 rounded">needs_human</code> is set, and an "Awaiting: X" badge if a Bot Flow is mid-capturing a reply from them.</li>
              <li><b>Source</b> - free text plus an ad badge if attributed (see above).</li>
              <li><b>Tags</b> - includes a Potential Student badge when relevant.</li>
              <li><b>Last Sent</b> - relative time since their most recent outbound message of any kind, amber if within the last 24 hours (a "you probably don't need to send again yet" signal), rose if that send failed. Hover for the exact template/flow name and timestamp.</li>
              <li>Checkbox selection persists across filter changes and pages - used for bulk <b>Send Template</b> (max 50 at once) and <b>Link as Household</b> (min 2).</li>
              <li>The pencil icon next to a name opens the edit panel: a read-only summary (lifecycle stage, stage health, engagement recency, customer status, contact-outcome history) at the top, then the editable fields below it - contact details, Potential Student, Tags, Notes.</li>
            </ul>
          </Section>

          <Section id="warm-list" icon={ClipboardList} title="Warm List import"
            blurb="/admin/warm-list - bulk CSV import, per-row review, then Commit into real leads.">
            <p>A one-time/periodic bulk import tool, separate from the always-on bot. Raw imported rows sit in a staging table for you to review and approve individually (or in bulk) before anything touches the real <code className="bg-slate-100 px-1 rounded">leads</code> table. Committing an approved row that matches an existing lead (by phone, then email) never overwrites that lead's stage or history - it only merges in any new tags.</p>
          </Section>

          <Section id="roadmap" icon={AlertTriangle} title="What's not built yet (full list)"
            blurb="Everything below is designed in the spec but not implemented as of 2026-08-18.">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Engagement recency and stage health <i>computation</i> exists (nightly cron, plus the values are correct as of 2026-08-18 after a formula bug was fixed) - but there's no confirmed evidence the cron actually runs in production yet, most likely because <code className="bg-slate-100 px-1 rounded">CRON_SECRET</code> was only ever set locally, not in the real deploy environment.</li>
              <li>Auto-expiry to Lost after 180 days of no inbound and no purchase - the logic exists in the same nightly cron, same caveat as above about whether it's actually firing.</li>
              <li>Session-date-based auto-move of qualified/offered leads to re_nurture the day after their session, tagged with which one they missed - also built into the cron, same caveat.</li>
              <li>Follow-up scheduling and its three notifications (morning digest, 15-minute admin alert with deep link, 60-minute lead reminder template) - no <code className="bg-slate-100 px-1 rounded">follow_ups</code> table or UI yet.</li>
              <li>Batch/deferred-save stage editing - shift-click range select, a pending-changes bar, one-transaction commit. Today, each stage change on Funnel Stages saves immediately, one lead at a time.</li>
              <li>A page to browse lead_activities <i>across</i> every lead at once - per-lead it's now visible in the edit panel.</li>
              <li>Lifetime value tracking.</li>
              <li>A separate stage-threshold set for B2B/school leads (their cycle is months, not days - today's thresholds would flag every one as stalled once stall-flagging is confirmed running).</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
