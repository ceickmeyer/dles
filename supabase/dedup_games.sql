-- Run once to remove duplicate games (keeps the oldest row per name)
delete from games
where id not in (
  select distinct on (name) id
  from games
  order by name, created_at asc
);

-- Fix max_score on existing rows (needed for quick-pick buttons)
update games set max_score = 6     where name = 'Wordle'     and max_score is null;
update games set max_score = 6     where name = 'Framed'     and max_score is null;
update games set max_score = 6     where name = 'Costcodle'  and max_score is null;
update games set max_score = 25000 where name = 'TimeGuessr' and max_score is null;
update games set max_score = 10    where name = 'Scrandle'   and max_score is null;
