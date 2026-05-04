import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export interface SchedulerResult {
	created: boolean;
	sessionName?: string;
	skippedReason?: 'no_schedule' | 'session_exists' | 'outside_window';
}

// Returns current date parts in America/New_York (handles EST/EDT automatically)
function getNYTime(date: Date) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/New_York',
		year: 'numeric', month: '2-digit', day: '2-digit',
		hour: 'numeric', hour12: false, weekday: 'short'
	}).formatToParts(date);
	const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
	return {
		hour: parseInt(get('hour'), 10),
		dateStr: `${get('year')}-${get('month')}-${get('day')}`,
		dayOfWeek: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(get('weekday'))
	};
}

export async function runScheduler(supabase: SupabaseClient<Database>): Promise<SchedulerResult> {
	const now = new Date();
	const { hour, dateStr: todayStr, dayOfWeek } = getNYTime(now);

	// Only run between 7 AM and midnight EST/EDT
	if (hour < 7) return { created: false, skippedReason: 'outside_window' };

	// If a session already exists for today, don't create another one
	const { data: existing } = await supabase
		.from('sessions')
		.select('id')
		.eq('date', todayStr)
		.maybeSingle();

	if (existing) return { created: false, skippedReason: 'session_exists' };

	// Find the first active schedule that covers today
	const { data: schedules } = await supabase
		.from('schedules')
		.select('*')
		.eq('active', true)
		.order('created_at', { ascending: true });

	const schedule = schedules?.find(s => (s.days_of_week as number[]).includes(dayOfWeek));
	if (!schedule) return { created: false, skippedReason: 'no_schedule' };

	// Build session name (replace {date} with readable date)
	const dateStr = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' });
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
		sort_order: i
	}));

	if (gameInserts.length > 0) {
		await supabase.from('session_games').insert(gameInserts);
	}

	return { created: true, sessionName };
}
