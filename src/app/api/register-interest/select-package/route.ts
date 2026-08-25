import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { recordStageChange } from '@/lib/leadStageHistory';
import { notifyAdminOfRegistration, normalizePhone } from '@/lib/registerInterest';
import { sendWhatsAppMessage } from '@/lib/metaTemplate';

const resend = new Resend(process.env.RESEND_API_KEY);

// Public - the self-serve package picker's final step (RegisterInterest
// Modal's 'package' step). Turns a lead's tier choice into a real quotes
// row on the existing finance-v2 pipeline (spec: "reuse and adjust the
// existing quotes/quote_line_items/invoices tables"), sends it, and pings
// admin - the fully-automatic flow the founder asked for, no admin gate per
// lead (the gate is upstream, at publish time - see checkPublishGate in
// admin/api/featured-programs/route.ts).
export async function POST(req: Request) {
  try {
    const { leadId, eventPackageId } = await req.json();
    if (!leadId || !eventPackageId) return NextResponse.json({ error: 'leadId and eventPackageId are required' }, { status: 400 });

    const supabase = supabaseAdmin();

    const [{ data: lead, error: leadErr }, { data: eventPackage, error: epErr }] = await Promise.all([
      supabase.from('leads').select('id, name, email, phone, number_of_children, preferred_channel, interested_program_id, lifecycle_stage').eq('id', leadId).single(),
      supabase.from('event_packages').select('id, final_fee, featured_program_id, display_name, display_description, package:packages(id, name, description, event_type)').eq('id', eventPackageId).eq('published', true).single(),
    ]);
    if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (epErr || !eventPackage) return NextResponse.json({ error: 'Package not found or not published' }, { status: 404 });
    if (eventPackage.final_fee === null) return NextResponse.json({ error: 'This package has no final fee set yet' }, { status: 400 });

    const rawPkg: any = Array.isArray(eventPackage.package) ? eventPackage.package[0] : eventPackage.package;
    // The quote (line item, WhatsApp/email bullets) shows what the parent
    // actually picked - if this attachment has a display_name/description
    // override (e.g. this is the "Multi-Workshop Pass" attachment of a
    // package whose own name is generic), that's what goes out, not the
    // underlying package's own name.
    const pkg = { ...rawPkg, name: eventPackage.display_name || rawPkg.name, description: eventPackage.display_description || rawPkg.description };
    const numberOfChildren = Math.max(1, Number(lead.number_of_children || 1));
    const finalFee = Number(eventPackage.final_fee);
    const totalAmount = finalFee * numberOfChildren;

    // Always resolves against the program the lead actually registered for,
    // not the event_package's own featured_program_id - a globally-available
    // package (e.g. Priority Coaching, featured_program_id null) still needs
    // to bill against and email through whichever program the lead came in
    // on (spec's §2.4 quotes.program_id / §12 per-program email template).
    const { data: featuredProgram } = lead.interested_program_id
      ? await supabase.from('featured_programs').select('programs_id, default_session_id, quote_email_template_id').eq('id', lead.interested_program_id).single()
      : { data: null };
    if (!featuredProgram?.programs_id) {
      return NextResponse.json({ error: 'This program is not yet linked to a curriculum programme - quoting is blocked until an admin sets that up.' }, { status: 400 });
    }

    const { data: qmax } = await supabase.from('quotes').select('quote_number').order('quote_number', { ascending: false }).limit(1);
    const quoteNumber = (qmax?.[0]?.quote_number || 0) + 1;

    // Composition (package_items -> inventory_items) is descriptive here,
    // not priced per-line - the single line item below carries the real
    // charge (final_fee, which includes margin over raw cost) so the
    // quote's total can never drift from what quote_line_items sums to,
    // which the existing accept/invoice/PayFast flow depends on.
    const { data: items } = await supabase.from('package_items').select('inventory_item:inventory_items(name)').eq('package_id', pkg.id);
    const includesList = (items || []).map((i: any) => (Array.isArray(i.inventory_item) ? i.inventory_item[0] : i.inventory_item)?.name).filter(Boolean);
    const notes = [pkg.description, includesList.length ? `Includes: ${includesList.join(', ')}` : null].filter(Boolean).join('\n\n');

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        lead_id: leadId,
        program_id: featuredProgram.programs_id,
        session_id: featuredProgram.default_session_id || null,
        event_package_id: eventPackageId,
        source: 'self_serve',
        status: 'sent',
        total_amount: totalAmount,
        currency: 'ZAR',
        installment_count: 1,
        is_open_ended: false,
        expires_at: expiresAt,
        notes: notes || null,
        created_by: 'self_serve',
      })
      .select('id, quote_number')
      .single();
    if (quoteError) throw quoteError;

    const { error: lineError } = await supabase.from('quote_line_items').insert([{
      quote_id: quote.id,
      description: pkg.name,
      program_id: featuredProgram.programs_id,
      session_id: featuredProgram.default_session_id || null,
      quantity: numberOfChildren,
      unit_price: finalFee,
      discount_pct: 0,
      line_total: totalAmount,
      sort_order: 0,
    }]);
    if (lineError) throw lineError;

    // qualified/offered -> quote_sent -> customer, forward-only per
    // lead_lifecycle_model's convention (20260817120000_lead_lifecycle_model.sql).
    await supabase.from('leads').update({ lifecycle_stage: 'quote_sent' }).eq('id', leadId);
    await recordStageChange(supabase, leadId, { toStage: 'quote_sent', fromStage: lead.lifecycle_stage, reason: 'Self-serve package selection' });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const quoteLink = `${baseUrl}/quote-v2/${quote.id}`;
    await sendQuote(supabase, lead, quoteLink, pkg.name, includesList, featuredProgram.quote_email_template_id, quote.id, baseUrl);

    await notifyAdminOfRegistration(
      supabase,
      leadId,
      `💰 Self-serve quote sent.\nPackage: ${pkg.name}${includesList.length ? `\nIncludes: ${includesList.slice(0, 3).join(', ')}` : ''}\nTotal: R ${totalAmount.toLocaleString('en-ZA')}\nQuote: ${quoteLink}`
    );

    return NextResponse.json({ ok: true, quoteId: quote.id, quoteLink });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// WhatsApp first if that's the lead's preferred channel, falling back to
// email on failure - a website-sourced lead may not have an open Meta
// customer-service window (no prior WhatsApp message to the WABA number),
// so a freeform send can legitimately be rejected; this must not lose the
// quote silently the way that would.
async function sendQuote(
  supabase: any, lead: any, quoteLink: string, packageName: string, includesList: string[],
  templateId: string | null, quoteId: string, baseUrl: string
) {
  const bullets = includesList.slice(0, 3).join(', ');
  let sent = false;

  if (lead.preferred_channel === 'whatsapp' && lead.phone) {
    const text = `Hi ${lead.name || 'there'}, here's what your *${packageName}* includes: ${bullets || 'see the full quote'} — full quote here: ${quoteLink}`;
    const result = await sendWhatsAppMessage(normalizePhone(lead.phone), { type: 'text', text: { body: text } });
    sent = result.ok;
  }

  if (!sent && lead.email) {
    let subject = `Your RAD Academy Quote — ${packageName}`;
    let html = `<p>Hi ${lead.name || 'there'},</p><p>Thanks for your interest — here's what your <strong>${packageName}</strong> includes: ${bullets || 'see the full quote'}.</p><p><a href="${quoteLink}">View your quote</a></p>`;
    if (templateId) {
      const { data: template } = await supabase.from('email_templates').select('subject, body_content').eq('id', templateId).single();
      if (template?.body_content) {
        subject = template.subject || subject;
        html = template.body_content.replace(/\{\{baseUrl\}\}/g, baseUrl).replace(/\{\{docId\}\}/g, quoteId).replace(/\{\{name\}\}/g, lead.name || 'there');
      }
    }
    await resend.emails.send({ from: 'RAD Academy <onboarding@updates.radacademy.co.za>', to: [lead.email], subject, html });
    sent = true;
  }

  return sent;
}
