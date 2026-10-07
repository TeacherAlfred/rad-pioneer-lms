-- Attendance for a session's roster. Nullable boolean rather than a
-- default false, so "never checked" (null) is distinguishable from
-- "checked and they were absent" (false) - the roster UI needs to tell
-- those apart.
alter table enrolments add column attended boolean;
alter table enrolments add column attended_at timestamptz;
comment on column enrolments.attended is 'null = not yet marked, true = present, false = absent (no-show).';
comment on column enrolments.attended_at is 'When attendance was recorded, regardless of present/absent.';
