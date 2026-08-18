-- Optional: run this in Supabase's SQL Editor if you want your existing
-- teams' color dots to switch from the old amber to the new brand red.

alter table teams alter column color set default '#E31B23';

update teams set color = '#E31B23' where color = '#E8871E';
