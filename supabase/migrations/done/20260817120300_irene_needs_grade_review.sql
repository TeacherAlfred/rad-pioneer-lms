-- Independent "class/grade needs confirming" tag, separate from needs_name_review.
-- Unlike needs_name_review (which blocks is_verified — free-text answers go public),
-- this one deliberately does NOT block verification: a response can be verified and
-- votable while its grade/class is still flagged for a teacher/admin to double-check.
alter table irene_responses
  add column needs_grade_review boolean not null default false;
