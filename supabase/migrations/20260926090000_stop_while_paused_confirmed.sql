-- A bot_paused lead's own Stop Receiving Messages tap (or "stop"/"unsubscribe"
-- text) now still opts them out - bot_paused only suppresses AUTOMATED
-- replies, it was never meant to block a lead's own compliance request. It
-- previously hit the hard "bot paused, nothing auto-sent" stop before ever
-- reaching opt-out handling, so the tap did nothing at all (see
-- whatsapp-webhook/route.ts's BOT PAUSED block).
--
-- Goes straight to opt_out_state = 'confirmed', skipping 'pending' entirely:
-- no automated confirm/cancel prompt can go out while paused anyway, and any
-- later freeform message from a 'confirmed' (non-pending) opt-out already
-- auto-reactivates them (see the "text us again anytime" rule earlier in the
-- webhook) - exactly what most leads who tap this by mistake then do. Leaving
-- them 'pending' instead would have been a dead end: nothing could ever ask
-- them to confirm, so they'd sit there forever with no way to answer.
--
-- Backfill, found 2026-09-26 by searching bot_paused leads' message history:

-- 1. Two leads tapped "Stop Receiving Messages" while already paused, before
--    this fix existed - the tap was silently dropped (opted_out was never
--    set at all).
update leads
set opted_out = true, opted_out_at = coalesce(opted_out_at, now()), opt_out_state = 'confirmed'
where phone in ('27733035599', '27728428376') and opted_out = false and merged_into_id is null;

-- 2. Any bot_paused lead already sitting in opt_out_state = 'pending' is the
--    same dead end - paused, so no prompt could ever have reached them to
--    answer. Covers *6188 (Vuyo Twabu, pending since the 2026-09-25 backfill)
--    and anyone else in the same spot.
update leads
set opt_out_state = 'confirmed'
where bot_paused = true and opt_out_state = 'pending' and merged_into_id is null;
