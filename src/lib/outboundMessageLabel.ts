// Every outbound send in this app is logged into `messages` as bracketed
// text (see whatsapp-webhook/route.ts and send-template/route.ts) rather
// than structured columns - this turns that back into a short display
// label. Deliberately simpler than Message Activity's parser (no kind/
// status discrimination needed here, just "what was it" for a tooltip).
export function parseOutboundLabel(body: string): string {
  const b = body || '';

  let m = b.match(/^\[Delivered template: (.+)\]$/);
  if (m) return `Template: ${m[1]}`;
  m = b.match(/^\[FAILED to deliver template (.+?):/);
  if (m) return `Template: ${m[1]} (failed)`;

  m = b.match(/^\[Delivered flow: (.+)\]$/);
  if (m) return `Flow: ${m[1]}`;
  m = b.match(/^\[FAILED to deliver flow (.+?):/);
  if (m) return `Flow: ${m[1]} (failed)`;

  if (b === '[Delivered human-handoff acknowledgment]') return 'Human handoff acknowledgment';
  if (b.startsWith('[FAILED to deliver acknowledgment')) return 'Human handoff acknowledgment (failed)';

  if (b === '[Delivered opt-out confirmation]') return 'Opt-out confirmation';
  if (b === '[Delivered Irene voting support acknowledgment]') return 'Irene voting support acknowledgment';

  m = b.match(/^\[FAILED to deliver "(.+?)":/);
  if (m) return `${m[1]} (failed)`;
  m = b.match(/^\[Delivered (.+)\]$/);
  if (m) return m[1];

  return b.length > 60 ? `${b.slice(0, 60)}…` : (b || '(empty message)');
}

export function isFailedOutbound(body: string): boolean {
  return (body || '').startsWith('[FAILED');
}
