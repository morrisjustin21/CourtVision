-- Run this in Supabase's SQL Editor to add season tracking to an existing database.
-- (New databases get this automatically from the updated schema.sql instead.)

alter table games add column if not exists season text;

-- Optional: give your already-entered games a season label instead of leaving them blank.
-- Adjust the value below, then re-run for each batch of games that needs it, e.g.:
-- update games set season = '2025-26' where season is null;
