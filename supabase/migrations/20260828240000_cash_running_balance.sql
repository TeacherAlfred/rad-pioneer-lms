-- A running cash balance needs a real anchor point - without one, every
-- month before tracking started would silently be assumed to hold R0,
-- which is wrong. Single-row settings table (same pattern as
-- dashboard_settings): one opening balance, as of one date, admin-set.
-- The monthly Cash-in-Hand/Fully-Collected scenarios are untouched by
-- this - they stay a "does this month's priority order work" test;
-- running balance answers a different question ("what's our real
-- cumulative cash position"), so both are kept side by side rather than
-- merging into one figure.
create table cash_running_balance_settings (
  id uuid primary key default gen_random_uuid(),
  opening_balance numeric(12,2) not null default 0,
  opening_balance_date date not null default current_date,
  updated_at timestamptz not null default now()
);

insert into cash_running_balance_settings (opening_balance, opening_balance_date)
select 0, current_date
where not exists (select 1 from cash_running_balance_settings);
