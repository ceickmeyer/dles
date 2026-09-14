import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Database } from './database.types';

// Service-role client — bypasses RLS entirely. Only ever constructed in
// server-only code (+server.ts / +page.server.ts), never sent to the browser.
export function createAdminClient(serviceRoleKey: string) {
	return createClient<Database>(PUBLIC_SUPABASE_URL, serviceRoleKey);
}
