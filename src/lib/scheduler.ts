import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export interface SchedulerResult {
	created: boolean;
	sessionName?: string;
	skippedReason?: 'no_schedule' | 'session_exists';
}

export async function runScheduler(supabase: SupabaseClient<Database>): Promise<SchedulerResult> {
	const today = new Date();
	const dayOfWeek = today.getDay(); // 0=Sun … 6=Sat
	const todayStr = today.toISOString().split('T')[0];

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
	const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
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
