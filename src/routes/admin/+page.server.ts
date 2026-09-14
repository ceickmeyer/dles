import { supabase } from '$lib/supabase';
import type { PageServerLoad } from './$types';

// The scheduler used to also run inline here on every dashboard visit, with
// its errors silently swallowed and never logged anywhere. Now that the
// cron hitting /api/run-scheduler is confirmed working (and logs every run
// to scheduler_runs), that duplicate, unlogged trigger path was removed --
// this is just a read. Use the "Run Scheduler" button (admin/schedule) or
// check scheduler_runs directly if the cron ever needs a manual nudge.
export const load: PageServerLoad = async () => {
	const { data: sessions } = await supabase
		.from('sessions')
		.select('id, name, date, status')
		.order('date', { ascending: false });

	return { sessions: sessions ?? [] };
};
