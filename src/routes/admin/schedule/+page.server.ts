import { supabase } from '$lib/supabase';
import { loadWeeklySchedule } from '$lib/scheduler';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => loadWeeklySchedule(supabase);
