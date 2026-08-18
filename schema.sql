-- CourtVision database schema
-- Run this in Supabase: Project > SQL Editor > New Query > paste all > Run

create extension if not exists "pgcrypto";

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  league text,
  division text,
  color text default '#E31B23',
  is_my_team boolean default false,
  scouting_notes text,
  created_at timestamptz default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade not null,
  name text not null,
  jersey_number int,
  position text,
  created_at timestamptz default now()
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  game_date date not null default current_date,
  season text,
  home_team_id uuid references teams(id) not null,
  away_team_id uuid references teams(id) not null,
  home_score int,
  away_score int,
  notes text,
  created_at timestamptz default now()
);

create table if not exists player_game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  points int default 0,
  two_made int default 0,
  two_att int default 0,
  three_made int default 0,
  three_att int default 0,
  ft_made int default 0,
  ft_att int default 0,
  rebounds int default 0,
  assists int default 0,
  steals int default 0,
  blocks int default 0,
  turnovers int default 0,
  fouls int default 0,
  minutes int default 0,
  created_at timestamptz default now(),
  unique(game_id, player_id)
);

-- Row Level Security: only signed-in users (i.e. you) can read or write.
-- Since this app has no public sign-up, the only account that can log in
-- is the one you create manually in Supabase's Authentication tab.

alter table teams enable row level security;
alter table players enable row level security;
alter table games enable row level security;
alter table player_game_stats enable row level security;

create policy "Authenticated full access" on teams
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access" on players
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access" on games
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated full access" on player_game_stats
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
