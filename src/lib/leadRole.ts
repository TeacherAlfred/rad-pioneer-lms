// "Is this lead a parent or a student?" was recorded in four unrelated places
// that never talked to each other: leads.is_confirmed_parent and
// leads.is_potential_student (Lead Funnel list toggles), the
// respondent_is_parent qualification check (Messages page + Lead Journey),
// and the segment_parent / segment_student tags the bot's "I'm a parent /
// I'm a student" buttons stamp. Filling one in left the others blank.
//
// applyLeadRole() is now the ONE writer - every path that sets the answer
// (list toggles, the Parent/Child buttons, the bot buttons, lab opt-ins)
// goes through it, so all four stay in step and every screen reads the same
// thing. roleFromLead() is the one reader.
//
// Deliberate asymmetry: only an explicit "Child" press in the qualify
// endpoint disqualifies a lead to Lost (see that route). A student marked
// from the list or a bot tap is just a recorded role - it never writes a
// failed check, so it can't drop anyone out of the funnel.

export type LeadRole = 'parent' | 'student' | null;

export const SEGMENT_PARENT_TAG = 'segment_parent';
export const SEGMENT_STUDENT_TAG = 'segment_student';

export function roleFromLead(
  lead: { is_confirmed_parent?: boolean | null; is_potential_student?: boolean | null; tags?: string[] | null },
  check?: boolean | null,
): LeadRole {
  // The admin's explicit qualification answer outranks everything else.
  if (check === true) return 'parent';
  if (check === false) return 'student';
  if (lead.is_confirmed_parent) return 'parent';
  if (lead.is_potential_student) return 'student';
  const tags = lead.tags || [];
  if (tags.includes(SEGMENT_PARENT_TAG)) return 'parent';
  if (tags.includes(SEGMENT_STUDENT_TAG)) return 'student';
  return null;
}

export async function applyLeadRole(supabase: any, leadId: string, role: LeadRole): Promise<void> {
  const { data: lead, error } = await supabase.from('leads').select('tags').eq('id', leadId).maybeSingle();
  if (error) throw error;
  if (!lead) return;

  const tags = new Set<string>((lead.tags || []).filter((t: string) => t !== SEGMENT_PARENT_TAG && t !== SEGMENT_STUDENT_TAG));
  if (role === 'parent') tags.add(SEGMENT_PARENT_TAG);
  if (role === 'student') tags.add(SEGMENT_STUDENT_TAG);

  const { error: updateError } = await supabase.from('leads').update({
    is_confirmed_parent: role === 'parent',
    is_potential_student: role === 'student',
    tags: Array.from(tags),
  }).eq('id', leadId);
  if (updateError) throw updateError;

  if (role === 'parent') {
    await supabase.from('lead_qualification_checks').upsert(
      { lead_id: leadId, stage_key: 'respondent_is_parent', passed: true, detail: null, checked_at: new Date().toISOString(), checked_by: 'role_sync', notes: null },
      { onConflict: 'lead_id,stage_key' },
    );
  } else {
    // No longer a parent: a passed check would contradict the new role. A
    // failed one (an explicit Child disqualification) is left alone - moving
    // the role must never quietly erase a recorded disqualification.
    await supabase.from('lead_qualification_checks')
      .delete()
      .eq('lead_id', leadId)
      .eq('stage_key', 'respondent_is_parent')
      .eq('passed', true);
  }
}
