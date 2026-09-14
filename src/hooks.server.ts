import { createServerClient } from '@supabase/ssr';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

const supabaseHandle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});

	// getUser() re-validates the JWT against Supabase rather than trusting
	// whatever the client claims — getSession() alone isn't safe to gate on.
	event.locals.safeGetSession = async () => {
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error || !user) return { session: null, user: null };

		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

// This is the actual admin gate — every other admin auth check in this app
// was client-side only (a component's onMount), which meant every admin
// +page.server.ts load function ran, unguarded, before that check ever fired.
const authGuard: Handle = async ({ event, resolve }) => {
	const { session } = await event.locals.safeGetSession();

	const isAdminRoute = event.url.pathname.startsWith('/admin');
	const isLoginRoute = event.url.pathname === '/admin/login';

	if (isAdminRoute && !isLoginRoute && !session) {
		redirect(303, '/admin/login');
	}

	return resolve(event);
};

export const handle: Handle = sequence(supabaseHandle, authGuard);
