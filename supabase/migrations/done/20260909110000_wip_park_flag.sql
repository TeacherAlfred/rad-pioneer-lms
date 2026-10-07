-- Lets a WIP book be hidden from the Inbox review queue without touching
-- its status ('wip' stays 'wip' - it isn't published, isn't deleted, just
-- set aside until there's more info to review it properly). A plain boolean
-- is enough since this only ever matters while status = 'wip'; it becomes
-- moot the moment a book is published or removed.

alter table rad_books add column is_wip_parked boolean not null default false;
