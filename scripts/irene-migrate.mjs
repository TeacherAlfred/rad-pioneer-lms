// Phase 0 data reconciliation for Project Irene.
//
// Consolidates Neon's proj_irene_responses (625 rows, whole-school OCR bulk
// transcription) into Supabase's irene_responses shape (cubs[] grouped per
// parent), which is what the live app/admin tool actually use.
//
// Defaults to --dry-run: reads both databases, applies the class-alias
// mapping, flags candidate duplicates, and prints a report. Nothing is
// written anywhere unless you pass --commit.
//
// Usage:
//   node scripts/irene-migrate.mjs                 (dry run, prints report)
//   node scripts/irene-migrate.mjs --commit         (writes to Supabase)
//
// --commit requires the Phase 0 tables (irene_class_aliases,
// irene_merge_candidates) to already exist in Supabase (see the plan's
// section 1/2 SQL) and SUPABASE_SERVICE_ROLE_KEY to be set.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';
import { confidentAliases, needsReview } from './irene-class-aliases.mjs';

const COMMIT = process.argv.includes('--commit');

const sql = neon(process.env.DATABASE_URL);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  COMMIT ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function normName(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function canonicalize(rawGrade, rawClassName) {
  const hit = confidentAliases.find(a => a.raw_grade === rawGrade && a.raw_class_name === rawClassName);
  if (hit) return { grade: hit.canonical_grade, className: hit.canonical_class_name, resolved: true };

  const flagged = needsReview.find(n => n.raw_grade === rawGrade && n.raw_class_name === rawClassName);
  if (flagged) return { grade: rawGrade, className: rawClassName, resolved: false, note: flagged.note };

  // Anything not in either list is already a clean, unambiguous class
  // (e.g. "5G", "3V", "7J") — pass through as-is.
  return { grade: rawGrade, className: rawClassName, resolved: true };
}

async function main() {
  console.log(`\n=== Irene Phase 0 Migration — ${COMMIT ? 'COMMIT MODE' : 'DRY RUN'} ===\n`);

  const neonRows = await sql`SELECT * FROM proj_irene_responses ORDER BY created_at ASC`;
  const { data: supaRows, error: supaErr } = await supabase.from('irene_responses').select('id, parent_first_name, cubs');
  if (supaErr) throw new Error(`Failed to read Supabase irene_responses: ${supaErr.message}`);

  console.log(`Read ${neonRows.length} Neon rows, ${supaRows.length} existing Supabase parent records.\n`);

  // ---- 1. Canonicalize + coverage report ----
  const coverageByGrade = {};
  const unresolvedByGrade = {};
  const canonicalRows = neonRows.map(r => {
    const c = canonicalize(r.grade, r.class_name);
    const gradeKey = c.grade || '(blank)';
    coverageByGrade[gradeKey] = (coverageByGrade[gradeKey] || 0) + 1;
    if (!c.resolved) unresolvedByGrade[gradeKey] = (unresolvedByGrade[gradeKey] || 0) + 1;
    return { ...r, canonical_grade: c.grade, canonical_class_name: c.className, class_resolved: c.resolved };
  });

  console.log('--- Coverage by grade (after alias mapping) ---');
  for (const grade of Object.keys(coverageByGrade).sort()) {
    const total = coverageByGrade[grade];
    const unresolved = unresolvedByGrade[grade] || 0;
    console.log(`  ${grade.padEnd(12)} ${String(total).padStart(4)} rows${unresolved ? `   (${unresolved} need class review)` : ''}`);
  }
  console.log();

  // ---- 2. Group Neon rows into parent-level records (name + canonical grade) ----
  // Kept conservative on purpose: a parent with kids in two different grades
  // becomes two groups here rather than being auto-combined into one family
  // (a name-only match across grades is exactly the kind of thing that should
  // surface during the search-first reconciliation pass, not get silently
  // merged by a script).
  const parentGroups = new Map(); // key: normName(parent) + '::' + canonical_grade -> rows[]
  for (const r of canonicalRows) {
    const key = `${normName(r.parent_first_name)}::${r.canonical_grade}`;
    if (!parentGroups.has(key)) parentGroups.set(key, []);
    parentGroups.get(key).push(r);
  }

  // ---- 3. Within each group, dedupe exact repeats (same cub_initial + canonical class) ----
  // and record the removed extras as internal-duplicate merge candidates instead of
  // silently discarding them.
  const internalDupeCandidates = [];
  const dedupedGroups = new Map();
  for (const [key, rows] of parentGroups) {
    const byCub = new Map();
    for (const r of rows) {
      const cubKey = `${r.cub_initial}::${r.canonical_class_name}`;
      if (byCub.has(cubKey)) {
        internalDupeCandidates.push({ kept: byCub.get(cubKey), extra: r });
      } else {
        byCub.set(cubKey, r);
      }
    }
    dedupedGroups.set(key, [...byCub.values()]);
  }
  console.log(`--- Neon-internal exact duplicates: ${internalDupeCandidates.length} rows removed from their group, queued for review ---\n`);

  // ---- 4. Split groups into candidate-matches-against-Supabase vs net-new ----
  const supaByName = new Map();
  for (const s of supaRows) {
    const key = normName(s.parent_first_name);
    if (!supaByName.has(key)) supaByName.set(key, []);
    supaByName.get(key).push(s);
  }
  const netNewGroups = [];
  const supaMatchCandidates = [];
  for (const [key, rows] of dedupedGroups) {
    const parentName = normName(rows[0].parent_first_name);
    const matches = supaByName.get(parentName);
    if (matches && matches.length > 0) {
      supaMatchCandidates.push({ supabaseMatches: matches, neonRows: rows });
    } else {
      netNewGroups.push(rows);
    }
  }

  console.log('--- Parent-level grouping ---');
  console.log(`  ${dedupedGroups.size} distinct parent groups found in Neon (by name + canonical grade)`);
  console.log(`  ${supaMatchCandidates.length} resemble an existing Supabase parent (by name) — candidate merges, NOT auto-merged`);
  console.log(`  ${netNewGroups.length} appear net-new — will be inserted as fresh records\n`);

  console.log('--- Rows needing manual class review (inserted anyway per your instruction, flagged for the reconciliation pass) ---');
  const unresolvedRows = canonicalRows.filter(r => !r.class_resolved);
  console.log(`  ${unresolvedRows.length} rows total (see scripts/irene-class-aliases.mjs "needsReview" for why each is flagged)\n`);

  if (!COMMIT) {
    console.log('Dry run complete. No data was written. Re-run with --commit once:');
    console.log('  1) irene_class_aliases / irene_merge_candidates tables exist in Supabase (plan section 1/2 SQL)');
    console.log('  2) SUPABASE_SERVICE_ROLE_KEY is set\n');
    return;
  }

  // ---- COMMIT MODE ----
  // Class-unknown rows are NOT held back — inserted as-is with the raw grade/class
  // text preserved (so nothing is lost), needs_name_review is already true for
  // every Phase 0 row regardless, and the Data Reconciliation search + Coverage
  // Report (section 6) are where these actually get resolved against the physical
  // forms — per your instruction, this migration does not block on them.

  function buildInsertPayload(rows) {
    const first = rows[0];
    return {
      parent_first_name: first.parent_first_name,
      q_why_start: first.q_why_start || null,
      q_boss_level: first.q_boss_level || null,
      q_funny_fail: first.q_funny_fail || null,
      q_weird_habit: first.q_weird_habit || null,
      q_shoes: first.q_shoes ?? null,
      media_url: null,
      is_verified: false,
      is_flagged: false,
      needs_name_review: true,
      goal_tags: [],
      activity_tags: [],
      club_tags: [],
      cubs: rows.map(r => ({
        grade: r.canonical_grade,
        class_name: r.canonical_class_name,
        cub_initial: r.cub_initial,
      })),
    };
  }

  const insertPayloads = netNewGroups.map(buildInsertPayload);
  console.log(`Inserting ${insertPayloads.length} net-new parent records into irene_responses...`);

  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < insertPayloads.length; i += CHUNK) {
    const chunk = insertPayloads.slice(i, i + CHUNK);
    const { error } = await supabase.from('irene_responses').insert(chunk);
    if (error) throw new Error(`Insert failed at chunk starting ${i}: ${error.message}`);
    inserted += chunk.length;
    console.log(`  inserted ${inserted}/${insertPayloads.length}`);
  }

  // ---- Write merge candidates (cross-database matches + internal duplicates) ----
  const mergeCandidateRows = [
    ...supaMatchCandidates.flatMap(({ supabaseMatches, neonRows }) =>
      supabaseMatches.map(s => ({
        response_a_id: s.id,
        response_b_source: 'neon',
        response_b_payload: neonRows,
        confidence: 'medium', // name-only match; class/grade not cross-checked here
        status: 'pending',
      }))
    ),
    ...internalDupeCandidates.map(({ kept, extra }) => ({
      response_a_id: null, // kept row isn't inserted under a stable id here; payload carries both for the reviewer
      response_b_source: 'neon_internal',
      response_b_payload: { kept, extra },
      confidence: 'high',
      status: 'pending',
    })),
  ];

  console.log(`\nWriting ${mergeCandidateRows.length} merge candidates for admin review...`);
  for (let i = 0; i < mergeCandidateRows.length; i += CHUNK) {
    const chunk = mergeCandidateRows.slice(i, i + CHUNK);
    const { error } = await supabase.from('irene_merge_candidates').insert(chunk);
    if (error) throw new Error(`Merge-candidate insert failed at chunk starting ${i}: ${error.message}`);
  }

  console.log('\n=== Commit complete ===');
  console.log(`  ${inserted} new parent responses inserted (needs_name_review = true on all of them)`);
  console.log(`  ${mergeCandidateRows.length} merge candidates queued in irene_merge_candidates for the Data Reconciliation panel`);
  console.log(`  ${unresolvedRows.length} rows carry an unresolved/ambiguous class — searchable, flagged, not blocking\n`);
}

main().catch(err => {
  console.error('\nMigration script failed:', err);
  process.exit(1);
});
