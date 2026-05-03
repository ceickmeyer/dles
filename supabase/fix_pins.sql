-- Assign a real random PIN to any player still using the '0000' default
update players
set pin = lpad((floor(random() * 9000) + 1000)::int::text, 4, '0')
where pin = '0000';
