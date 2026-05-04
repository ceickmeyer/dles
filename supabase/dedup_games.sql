-- Run once to remove duplicate games (keeps the oldest row per name)
delete from games
where id not in (
  select distinct on (name) id
  from games
  order by name, created_at asc
);
