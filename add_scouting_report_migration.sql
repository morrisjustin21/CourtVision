-- Run this in Supabase's SQL Editor to add scouting report support
-- to an existing database. (New databases get this automatically
-- from the updated schema.sql instead.)

alter table player_game_stats add column if not exists two_made int default 0;
alter table player_game_stats add column if not exists two_att int default 0;
alter table player_game_stats add column if not exists three_made int default 0;
alter table player_game_stats add column if not exists three_att int default 0;
alter table player_game_stats add column if not exists ft_made int default 0;
alter table player_game_stats add column if not exists ft_att int default 0;

alter table teams add column if not exists scouting_notes text;
