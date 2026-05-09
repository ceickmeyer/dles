import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export interface SchedulerResult {
	created: boolean;
	sessionName?: string;
	skippedReason?: 'no_schedule' | 'session_exists';
	finished?: number; // how many stale sessions were finished
}

// Returns today's date string and day-of-week in America/New_York timezone
function getNYDate(date: Date): { dateStr: string; dayOfWeek: number } {
	const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date);
	const [y, m, d] = dateStr.split('-').map(Number);
	const dayOfWeek = new Date(y, m - 1, d).getDay(); // 0=Sun … 6=Sat
	return { dateStr, dayOfWeek };
}

export async function runScheduler(supabase: SupabaseClient<Database>): Promise<SchedulerResult> {
	const now = new Date();
	const { dateStr: todayStr, dayOfWeek } = getNYDate(now);

	// Finish any active/lobby sessions from previous dates
	const { data: stale } = await supabase
		.from('sessions')
		.select('id')
		.in('status', ['active', 'lobby'])
		.lt('date', todayStr);
	if (stale && stale.length > 0) {
		await supabase
			.from('sessions')
			.update({ status: 'finished' })
			.in('id', stale.map(s => s.id));
	}
	const finished = stale?.length ?? 0;

	// If any session exists for today, don't create another one
	// (use limit+array, not maybeSingle — maybeSingle errors when >1 row exists)
	const { data: existing } = await supabase
		.from('sessions')
		.select('id')
		.eq('date', todayStr)
		.limit(1);

	if (existing && existing.length > 0) return { created: false, skippedReason: 'session_exists' };

	// Find the first active schedule that covers today
	const { data: schedules } = await supabase
		.from('schedules')
		.select('*')
		.eq('active', true)
		.order('created_at', { ascending: true });

	const schedule = schedules?.find(s => (s.days_of_week as number[]).includes(dayOfWeek));
	if (!schedule) return { created: false, skippedReason: 'no_schedule' };

	// Build session name (replace {date} with readable date in NY timezone)
	const dateStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }).format(now);
	const sessionName = schedule.session_name_template.replace('{date}', dateStr);

	const { data: session, error } = await supabase
		.from('sessions')
		.insert({ name: sessionName, date: todayStr, status: schedule.auto_activate ? 'active' : 'lobby' })
		.select('id')
		.single();

	if (error || !session) return { created: false };

	const gameInserts = (schedule.game_ids as string[]).map((gameId, i) => ({
		session_id: session.id,
		game_id: gameId,
		sort_order: i,
		is_special: gameId === schedule.special_game_id
	}));

	if (gameInserts.length > 0) {
		await supabase.from('session_games').insert(gameInserts);
	}

	return { created: true, sessionName };
}
