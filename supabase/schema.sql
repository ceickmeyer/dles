-- Run this in the Supabase SQL editor to set up the database

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pin text not null default '0000',
  created_at timestamptz default now()
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  icon_emoji text,
  scoring_direction text not null check (scoring_direction in ('higher_is_better', 'lower_is_better')),
  max_score integer,
  share_parser text,
  created_at timestamptz default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null default current_date,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'finished')),
  created_at timestamptz default now()
);

create table if not exists session_games (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  game_id uuid references games(id),
  sort_order integer not null default 0,
  unique(session_id, game_id)
);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  game_id uuid references games(id),
  player_id uuid references players(id),
  raw_score numeric not null,
  share_text text,
  submitted_at timestamptz default now(),
  unique(session_id, game_id, player_id)
);

-- RLS policies

alter table players enable row level security;
alter table games enable row level security;
alter table sessions enable row level security;
alter table session_games enable row level security;
alter table scores enable row level security;

-- Players: anyone can read/insert; PIN is readable (it's a casual 4-digit code, not a secret)
create policy "players_select" on players for select using (true);
create policy "players_insert" on players for insert with check (true);

-- Games: anyone can read; only authenticated admin can write
create policy "games_select" on games for select using (true);
create policy "games_insert" on games for insert with check (auth.role() = 'authenticated');
create policy "games_update" on games for update using (auth.role() = 'authenticated');
create policy "games_delete" on games for delete using (auth.role() = 'authenticated');

-- Sessions: anyone can read; only authenticated admin can write
create policy "sessions_select" on sessions for select using (true);
create policy "sessions_insert" on sessions for insert with check (auth.role() = 'authenticated');
create policy "sessions_update" on sessions for update using (auth.role() = 'authenticated');
create policy "sessions_delete" on sessions for delete using (auth.role() = 'authenticated');

-- Session games: anyone can read; only authenticated admin can write
create policy "session_games_select" on session_games for select using (true);
create policy "session_games_insert" on session_games for insert with check (auth.role() = 'authenticated');
create policy "session_games_update" on session_games for update using (auth.role() = 'authenticated');
create policy "session_games_delete" on session_games for delete using (auth.role() = 'authenticated');

-- Scores: anyone can insert/read/update; only authenticated admin can delete
create policy "scores_select" on scores for select using (true);
create policy "scores_insert" on scores for insert with check (true);
create policy "scores_upsert" on scores for update using (true);
create policy "scores_delete" on scores for delete using (auth.role() = 'authenticated');

-- Enable realtime for scores
alter publication supabase_realtime add table scores;

-- Seed starter games
insert into games (name, url, icon_emoji, scoring_direction, share_parser) values
  ('Wordle', 'https://www.nytimes.com/games/wordle/index.html', '🟩', 'lower_is_better', 'wordle'),
  ('Framed', 'https://framed.wtf', '🎥', 'lower_is_better', 'framed'),
  ('TimeGuessr', 'https://timeguessr.com', '🕰️', 'higher_is_better', 'timeguessr'),
  ('Costcodle', 'https://costcodle.com', '🛒', 'lower_is_better', 'costcodle')
on conflict do nothing;
