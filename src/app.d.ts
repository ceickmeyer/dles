import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
		}
		// interface PageData {}
		// interface Error {}
		// interface Platform {}
	}
}

export {};
