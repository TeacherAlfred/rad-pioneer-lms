# Irene Primary Fitness Voting Platform — Plan of Action

**Version:** 1.0 · 11 August 2026
**Source brief:** `08-11_Irene_Voting_Platform_Developer_Brief.md`
**Status:** Tranche A checks complete, Tranche B not started

---

## 1. The real deadline structure

The brief carries one blanket deadline — "build by Wed 12 Aug" — but the platform has two separate gates, and only the first one is actually 24 hours away:

| Gate | Date | What must be true |
|---|---|---|
| **Gate 1 — Teacher voting opens** | Thu 13 Aug | Existing vote mechanic + phase control (already built). No consent/POPIA rebuild required — teachers aren't the marketing-consent audience. |
| **Gate 2 — Parent voting opens** | Mon 17 Aug | Consent block, storage, lead-engine handoff, tap-to-WhatsApp, confirmation-screen copy — all currently unbuilt. |
| **Gate 3 — Results announced** | ~Mon 24 Aug (pending §7) | Results broadcast capability + approved WhatsApp template + redaction/dashboard tooling. |

This gives **~5 days (Aug 12–16)** for the hard part — consent and the WhatsApp/lead integration — not the 1 day the brief's date implies, because the `parents` phase flag already exists and can gate the new consent UI so it never shows during teacher voting.

---

## 2. Tranche A — before Thursday (Gate 1)

| Item | Status | Notes |
|---|---|---|
| Vote mechanic (1/5/15 weighting) | ✅ Verified, matches spec | `page.tsx:24` |
| Phase control (setup/educators/parents/closed) | ✅ Verified, matches spec | Existing admin panel |
| Field-level anonymity (initials + grade/class + parent first name only) | ✅ Verified | Public page query at `page.tsx:188` explicitly excludes any full-name or media field; confirmed by an in-code comment |
| **"Verify" doesn't check `needs_name_review`** | ⚠️ **Gap found** | `handleToggleVerify` in `irene-entry/page.tsx:328` publishes a response with no check on the review flag. Free-text answers (why they started, funniest fail, etc.) are shown publicly and could contain identifying text that was flagged but never actually blocked. **Recommended fix:** require confirmation (or hard-block) verifying a record while `needs_name_review` is true. Small change, not yet applied — pending your go-ahead. |
| Redaction approach decision | 🔲 Decision, not code | Your comment resolves this: admin-controlled toggle, decided well ahead of the close, not a fixed "last N hours" rule. Needs to be locked in before the school-approval conversation. |
| Live vote-mechanic click-through | ⏸ Deferred | `.env.local` points at what looks like the live production Supabase project (shared with the WhatsApp webhook) — didn't want to write test rows into real campaign data without sign-off. |
| **WhatsApp template submission for results broadcast** | 🔲 Not started — **start today** | This is the one item with lead time outside your control. A proactive "results are live" message to ~200–300 people outside their 24-hour reply window needs a Meta-approved template. Submitting today is the difference between ready and blocked by the 24th. |

---

## 3. Tranche B — before Monday 17 Aug (Gate 2)

Everything here is currently unbuilt. This is the actual build.

### 3.1 Consent block
- Marketing checkbox, separate and unticked, alongside (not gating) the WhatsApp field.
- Copy per your resolution: 15× votes + results notification awarded unconditionally for providing the number; the **Parent's Guide is the thing gated behind marketing consent** — cleaner POPIA basis than the original draft framing.
- Render only during the `parents` phase (reuses existing phase state — no new gating mechanism needed).

### 3.2 Consent storage
- New fields on the voter/lead record: `consent_marketing`, `consent_timestamp`, `consent_wording_version`, `consent_source` (`irene_voting_platform`).
- **Fix required, not reuse:** the current `ip_address` field just mirrors `device_id` — it isn't a real captured IP. Consent evidence needs a genuinely server-captured IP.

### 3.3 Lead-engine handoff
- On consent, upsert into the `leads` table used by the WhatsApp webhook: `source: irene_ips`, school, class, name, whatsapp, full consent block, vote token.
- **Must reuse the phone-unique insert-first pattern already shipped in the webhook this session** (`whatsapp-webhook/route.ts`) — otherwise this reintroduces the exact duplicate-lead race we closed there.
- Referral case: the voter schema already has `referred_by_response_id` — when set, leave school/class null until consent is given, then request them (per your resolution in §7).

### 3.4 Tap-to-WhatsApp
- Generate a vote token per vote; `wa.me` deep link with prefilled `VOTE-<token>` message on the confirmation screen.
- Extend the webhook to match the token → award 15× votes → link the vote record to the WhatsApp record → deliver the guide.
- This rides on the webhook's existing signature verification and idempotency protections — no extra reliability work needed for this path.
- Keep the manual number field as fallback per the brief.

### 3.5 Confirmation screen
- Lead with the class prize, not the workshop (per brief).
- Second opt-in button for anyone who didn't consent on the vote form itself (per your comment in §6).

**Target:** all of 3.1–3.5 built and tested by end of day **Sun 16 Aug**, so Monday's parent-window open isn't a live-fire first test.

---

## 4. Tranche C — before results (~Mon 24 Aug), can trail launch

| Item | Depends on |
|---|---|
| Results date picker + actual broadcast send | Template approval from Tranche A |
| Redaction toggle (manual, admin-controlled) | Decision locked in Tranche A |
| Dashboard publish/hide toggle | — |
| Live dashboard: voter split by tier, consent rate, tap-through completion | — |
| Real CSV export (current export is a raw response dump, not voter/consent/leads data) | — |

None of this blocks either voting window opening. It blocks the results reveal on ~24 Aug.

---

## 5. Decisions still needed (not code)

1. **Redaction window** — confirm the admin-toggle approach before the school-approval conversation.
2. **Verify-gate fix** — confirm whether to hard-block or just warn when verifying a `needs_name_review` record.
3. **Parent window length** — your note about possibly extending toward the following Sunday (~23 Aug) pushes close against the ~24 Aug results date and the 29 Aug session redemption. Worth confirming there's still enough gap once this is decided, before it affects the Tranche C build.
4. **School approval** — must happen before the parent window opens (Gate 2), and should reference the finalized consent wording once 3.1 is drafted.

---

## 6. Cutoff dates at a glance

| Date | Milestone |
|---|---|
| **Tue 11 Aug (today)** | Tranche A checks complete. Submit WhatsApp template for approval. Lock redaction + verify-gate decisions. |
| **Wed 12 Aug** | Tranche A closed out. School-approval conversation. |
| **Thu 13 Aug** | **Gate 1 — teacher voting opens.** |
| Thu 13 – Sun 16 Aug | Tranche B build window, running alongside live teacher voting. |
| **Sun 16 Aug (EOD)** | Tranche B built and tested. |
| **Mon 17 Aug** | **Gate 2 — parent voting opens.** |
| Mon 17 – Thu 20 Aug (or later, pending decision) | Parent voting window live. |
| Final window before close | Podium redacted per admin toggle. |
| **~Mon 24 Aug** | **Gate 3 — results announced** (pending §5.3). Requires Tranche C + approved template. |
| **29 Aug** | Robotics Session 3 — vouchers redeemed. |

---

## 7. Out of scope (per brief §11)

Payment handling, winning-class session scheduling, and the nurture sequence itself all live in the WhatsApp engine — the same system this session's reliability fixes (signature verification, idempotency, race-condition close, admin-message handling) were applied to. Tranche B's lead handoff is the connection point between the two; nothing else in Project Irene needs to touch that system directly.
