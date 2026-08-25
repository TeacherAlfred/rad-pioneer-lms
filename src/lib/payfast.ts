import { createHash } from 'node:crypto';

// PayFast's documented signature scheme, used both directions: on an
// outgoing payment request (if the merchant account has Payment Data
// Validation enabled, which a configured passphrase strongly implies) and
// on incoming ITN verification (see api/payfast/webhook/route.ts). Field
// order matters - concatenate in the order given, NOT alphabetized -
// because PayFast recomputes it over the fields as submitted.
export function computePayfastSignature(fields: Record<string, string | undefined>, passphrase?: string | null): string {
  let output = '';
  for (const [key, rawValue] of Object.entries(fields)) {
    if (key === 'signature') continue;
    const value = (rawValue ?? '').toString().trim();
    if (!value) continue;
    output += `${key}=${encodeURIComponent(value).replace(/%20/g, '+')}&`;
  }
  let getString = output.slice(0, -1);
  if (passphrase) {
    getString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  }
  return createHash('md5').update(getString).digest('hex');
}

// The ITN validate endpoint lives on the same domain as the process
// endpoint - sandbox transactions must validate against sandbox, live
// against live. Previously hardcoded to live regardless of PAYFAST_URL,
// which would silently fail validation for every sandbox transaction.
export function payfastValidateUrl(processUrl: string | undefined): string {
  const isSandbox = (processUrl || '').includes('sandbox.payfast.co.za');
  return isSandbox ? 'https://sandbox.payfast.co.za/eng/query/validate' : 'https://www.payfast.co.za/eng/query/validate';
}
