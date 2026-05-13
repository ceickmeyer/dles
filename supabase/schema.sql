-- Run this in the Supabase SQL editor to set up the database
-- Safe to re-run: uses IF NOT EXISTS and DROP IF EXISTS throughout

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
  status text not null default 'lobby' check (status in ('lobby', 'active', 'paused', 'finished')),
  expires_at timestamptz,
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

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  days_of_week integer[] not null default '{}',
  game_ids uuid[] not null default '{}',
  session_name_template text not null default 'Game Night — {date}',
  auto_activate boolean not null default false,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Column migrations (safe to re-run on existing tables)
alter table players  add column if not exists pin           text        not null default '0000';
alter table players  add column if not exists alias         text;
alter table sessions add column if not exists expires_at   timestamptz;
alter table sessions add column if not exists scores_hidden boolean    not null default false;
alter table games    add column if not exists allow_dnf     boolean    not null default false;
alter table games    add column if not exists share_regex   text;
alter table games    add column if not exists input_mode    text        not null default 'auto';
alter table games    drop constraint if exists games_input_mode_check;
alter table games    add constraint games_input_mode_check
  check (input_mode in ('auto', 'buttons', 'parser', 'manual'));

-- Recreate scores→players FK with cascade so deleting a player removes their scores
alter table scores drop constraint if exists scores_player_id_fkey;
alter table scores add constraint scores_player_id_fkey
  foreign key (player_id) references players(id) on delete cascade;

-- Update status check constraint to include 'paused'
alter table sessions drop constraint if exists sessions_status_check;
alter table sessions add constraint sessions_status_check
  check (status in ('lobby', 'active', 'paused', 'finished'));

-- RLS policies (drop first so this script is safe to re-run)
alter table players      enable row level security;
alter table games        enable row level security;
alter table sessions     enable row level security;
alter table session_games enable row level security;
alter table scores       enable row level security;

drop policy if exists "players_select" on players;
drop policy if exists "players_insert" on players;
drop policy if exists "players_update" on players;
drop policy if exists "players_delete" on players;
create policy "players_select" on players for select using (true);
create policy "players_insert" on players for insert with check (true);
create policy "players_update" on players for update using (auth.role() = 'authenticated');
create policy "players_delete" on players for delete using (auth.role() = 'authenticated');

drop policy if exists "games_select"  on games;
drop policy if exists "games_insert"  on games;
drop policy if exists "games_update"  on games;
drop policy if exists "games_delete"  on games;
create policy "games_select" on games for select using (true);
create policy "games_insert" on games for insert with check (auth.role() = 'authenticated');
create policy "games_update" on games for update using  (auth.role() = 'authenticated');
create policy "games_delete" on games for delete using  (auth.role() = 'authenticated');

drop policy if exists "sessions_select" on sessions;
drop policy if exists "sessions_insert" on sessions;
drop policy if exists "sessions_update" on sessions;
drop policy if exists "sessions_delete" on sessions;
create policy "sessions_select" on sessions for select using (true);
create policy "sessions_insert" on sessions for insert with check (auth.role() = 'authenticated');
create policy "sessions_update" on sessions for update using  (auth.role() = 'authenticated');
create policy "sessions_delete" on sessions for delete using  (auth.role() = 'authenticated');

drop policy if exists "session_games_select" on session_games;
drop policy if exists "session_games_insert" on session_games;
drop policy if exists "session_games_update" on session_games;
drop policy if exists "session_games_delete" on session_games;
create policy "session_games_select" on session_games for select using (true);
create policy "session_games_insert" on session_games for insert with check (auth.role() = 'authenticated');
create policy "session_games_update" on session_games for update using  (auth.role() = 'authenticated');
create policy "session_games_delete" on session_games for delete using  (auth.role() = 'authenticated');

drop policy if exists "scores_select" on scores;
drop policy if exists "scores_insert" on scores;
drop policy if exists "scores_upsert" on scores;
drop policy if exists "scores_delete" on scores;
create policy "scores_select" on scores for select using (true);
create policy "scores_insert" on scores for insert with check (true);
create policy "scores_upsert" on scores for update using (true);
create policy "scores_delete" on scores for delete using (auth.role() = 'authenticated');

alter table schedules enable row level security;
drop policy if exists "schedules_select" on schedules;
drop policy if exists "schedules_insert" on schedules;
drop policy if exists "schedules_update" on schedules;
drop policy if exists "schedules_delete" on schedules;
create policy "schedules_select" on schedules for select using (true);
create policy "schedules_insert" on schedules for insert with check (auth.role() = 'authenticated');
create policy "schedules_update" on schedules for update using (auth.role() = 'authenticated');
create policy "schedules_delete" on schedules for delete using (auth.role() = 'authenticated');

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  player_name text not null,
  content text not null check (char_length(content) <= 500),
  created_at timestamptz default now()
);

alter table messages enable row level security;
drop policy if exists "messages_select" on messages;
drop policy if exists "messages_insert" on messages;
create policy "messages_select" on messages for select using (true);
create policy "messages_insert" on messages for insert with check (true);

alter table session_games add column if not exists is_special boolean not null default false;
alter table schedules    add column if not exists special_game_id uuid references games(id) on delete set null;

-- Enable realtime for scores and sessions (safe to re-run)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'scores'
  ) then
    alter publication supabase_realtime add table scores;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

-- Weekly schedule: one row per day of week (0=Sun … 6=Sat)
create table if not exists weekly_schedule (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  game_ids uuid[] not null default '{}',
  special_game_id uuid references games(id) on delete set null
);

-- Seed all 7 days (safe to re-run)
insert into weekly_schedule (day_of_week)
values (0),(1),(2),(3),(4),(5),(6)
on conflict (day_of_week) do nothing;

alter table weekly_schedule enable row level security;
create policy "weekly_schedule_select" on weekly_schedule for select using (true);
create policy "weekly_schedule_insert" on weekly_schedule for insert with check (auth.role() = 'authenticated');
create policy "weekly_schedule_update" on weekly_schedule for update using (auth.role() = 'authenticated');
create policy "weekly_schedule_delete" on weekly_schedule for delete using (auth.role() = 'authenticated');
