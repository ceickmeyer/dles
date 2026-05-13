import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export interface SchedulerResult {
	created: boolean;
	sessionName?: string;
	skippedReason?: 'no_schedule' | 'session_exists';
	finished?: number;
}

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
	const { data: existing } = await supabase
		.from('sessions')
		.select('id')
		.eq('date', todayStr)
		.limit(1);
	if (existing && existing.length > 0) return { created: false, skippedReason: 'session_exists', finished };

	// Look up today's weekly schedule
	const { data: schedule } = await supabase
		.from('weekly_schedule')
		.select('*')
		.eq('day_of_week', dayOfWeek)
		.maybeSingle();

	if (!schedule || (schedule.game_ids as string[]).length === 0) {
		return { created: false, skippedReason: 'no_schedule', finished };
	}

	// Auto-generate session name from date
	const readableDate = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/New_York',
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	}).format(now);
	const sessionName = `Game Night — ${readableDate}`;

	const { data: session, error } = await supabase
		.from('sessions')
		.insert({ name: sessionName, date: todayStr, status: 'active' })
		.select('id')
		.single();

	if (error || !session) return { created: false, finished };

	const gameInserts = (schedule.game_ids as string[]).map((gameId, i) => ({
		session_id: session.id,
		game_id: gameId,
		sort_order: i,
		is_special: gameId === schedule.special_game_id
	}));

	if (gameInserts.length > 0) {
		await supabase.from('session_games').insert(gameInserts);
	}

	return { created: true, sessionName, finished };
}
