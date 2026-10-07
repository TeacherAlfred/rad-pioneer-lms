-- A student can only be enrolled once per session, regardless of
-- whether that enrolment came from a direct /admin/kids "Enroll" or a
-- redeemed pass credit. Without this, redeeming a pass credit for a kid
-- already enrolled in that session (e.g. enrolled manually first, paid
-- with a pass after) created a second row and double-counted them on
-- the session roster/attendance.
alter table enrolments add constraint enrolments_student_id_session_id_key unique (student_id, session_id);
